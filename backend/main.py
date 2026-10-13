from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import httpx
import asyncio
import json
import aiosqlite
import re
import os
from datetime import datetime
from database import (
    init_db, save_analysis, get_analysis, get_all_analyses,
    create_user, get_user_by_email, get_user_by_id, get_user_by_google_id
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_user
)
import anthropic_service

app = FastAPI(title="GitHub Repository Analyzer", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.on_event("startup")
async def startup():
    await init_db()


# ── Auth Models ───────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str


# ── Auth Endpoints ────────────────────────────────────────────────

@app.post("/auth/register")
async def register(request: RegisterRequest):
    # Check if email already exists
    existing = await get_user_by_email(request.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate password length
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Hash password and create user
    hashed = hash_password(request.password)
    user = await create_user(
        email=request.email,
        hashed_password=hashed,
        name=request.name,
    )

    # Create token
    token = create_access_token(user["id"], user["email"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user.get("avatar_url"),
        }
    }


@app.post("/auth/login")
async def login(request: LoginRequest):
    # Find user by email
    user = await get_user_by_email(request.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if user signed up with Google (no password)
    if not user.get("hashed_password"):
        raise HTTPException(status_code=400, detail="This account uses Google login")

    # Verify password
    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create token
    token = create_access_token(user["id"], user["email"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user.get("avatar_url"),
        }
    }


@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await get_user_by_id(int(current_user["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

class GoogleAuthRequest(BaseModel):
    token: str  # Google ID token from frontend


@app.post("/auth/google")
async def google_auth(request: GoogleAuthRequest):
    """Verify Google token and login/register user."""
    
    # Verify token with Google
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={request.token}"
        )
    
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    
    google_data = response.json()
    
    # Verify the token was meant for our app
    if google_data.get("aud") != os.environ.get("GOOGLE_CLIENT_ID"):
        raise HTTPException(status_code=401, detail="Token not intended for this app")
    
    email = google_data.get("email")
    name = google_data.get("name", "")
    google_id = google_data.get("sub")
    avatar_url = google_data.get("picture", "")
    
    if not email:
        raise HTTPException(status_code=400, detail="Could not get email from Google")
    
    # Check if user exists by Google ID
    user = await get_user_by_google_id(google_id)
    
    if not user:
        # Check if email already registered with password
        user = await get_user_by_email(email)
        
        if user:
            # User exists with email — link Google ID to their account
            async with aiosqlite.connect("analyzer.db") as db:
                await db.execute(
                    "UPDATE users SET google_id = ?, avatar_url = ? WHERE email = ?",
                    (google_id, avatar_url, email)
                )
                await db.commit()
        else:
            # New user — create account
            user = await create_user(
                email=email,
                name=name,
                google_id=google_id,
                avatar_url=avatar_url,
            )
    
    # Create our JWT token
    token = create_access_token(user["id"], user["email"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", name),
            "avatar_url": user.get("avatar_url", avatar_url),
        }
    }

# ── Repo Analysis ─────────────────────────────────────────────────

class RepoRequest(BaseModel):
    url: str
    github_token: str | None = None

def parse_github_url(url: str) -> tuple[str, str]:
    url = url.strip().rstrip("/")
    patterns = [
        r"github\.com/([^/]+)/([^/]+?)(?:\.git)?$",
        r"^([^/]+)/([^/]+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1), match.group(2)
    raise ValueError(f"Invalid GitHub URL: {url}")


async def fetch_github_data(owner: str, repo: str, token: str | None) -> dict:
    headers = {"Accept": "application/vnd.github.v3+json"}
    active_token = token or os.environ.get("GITHUB_TOKEN")
    if active_token:
        headers["Authorization"] = f"token {active_token}"

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:

        async def get(path):
            r = await client.get(f"https://api.github.com{path}", headers=headers)
            if r.status_code == 404:
                raise HTTPException(status_code=404, detail="Repository not found or is private")
            if r.status_code == 403:
                raise HTTPException(status_code=403, detail="GitHub rate limit exceeded. Add a GitHub token.")
            r.raise_for_status()
            return r.json()

        repo_data, languages, contributors, commits_raw, issues_raw, contents_raw = await asyncio.gather(
            get(f"/repos/{owner}/{repo}"),
            get(f"/repos/{owner}/{repo}/languages"),
            get(f"/repos/{owner}/{repo}/contributors?per_page=10"),
            get(f"/repos/{owner}/{repo}/commits?per_page=10"),
            get(f"/repos/{owner}/{repo}/issues?state=all&per_page=20"),
            get(f"/repos/{owner}/{repo}/contents"),
        )

        readme_content = ""
        try:
            readme = await get(f"/repos/{owner}/{repo}/readme")
            import base64
            readme_content = base64.b64decode(readme.get("content", "")).decode("utf-8", errors="ignore")[:3000]
        except Exception:
            pass

        file_samples = {}
        important_files = ["requirements.txt", "package.json", "Dockerfile", ".github/workflows", "setup.py", "pyproject.toml"]
        root_files = [f["name"] for f in contents_raw if isinstance(contents_raw, list)]

        for fname in important_files:
            if fname in root_files:
                try:
                    fdata = await get(f"/repos/{owner}/{repo}/contents/{fname}")
                    if fdata.get("encoding") == "base64":
                        import base64
                        file_samples[fname] = base64.b64decode(fdata["content"]).decode("utf-8", errors="ignore")[:1000]
                except Exception:
                    pass

        commits = [
            {"message": c["commit"]["message"][:100], "date": c["commit"]["author"]["date"]}
            for c in (commits_raw if isinstance(commits_raw, list) else [])
        ]

        open_issues = [i for i in (issues_raw if isinstance(issues_raw, list) else []) if i.get("state") == "open" and "pull_request" not in i]
        closed_issues = [i for i in (issues_raw if isinstance(issues_raw, list) else []) if i.get("state") == "closed" and "pull_request" not in i]

        return {
            "name": repo_data.get("name"),
            "full_name": repo_data.get("full_name"),
            "description": repo_data.get("description", ""),
            "stars": repo_data.get("stargazers_count", 0),
            "forks": repo_data.get("forks_count", 0),
            "watchers": repo_data.get("watchers_count", 0),
            "open_issues_count": repo_data.get("open_issues_count", 0),
            "created_at": repo_data.get("created_at"),
            "updated_at": repo_data.get("updated_at"),
            "pushed_at": repo_data.get("pushed_at"),
            "size_kb": repo_data.get("size", 0),
            "default_branch": repo_data.get("default_branch", "main"),
            "topics": repo_data.get("topics", []),
            "license": repo_data.get("license", {}).get("name") if repo_data.get("license") else None,
            "has_wiki": repo_data.get("has_wiki", False),
            "has_pages": repo_data.get("has_pages", False),
            "languages": languages,
            "contributors_count": len(contributors) if isinstance(contributors, list) else 0,
            "top_contributors": [
                {"login": c["login"], "contributions": c["contributions"]}
                for c in (contributors[:5] if isinstance(contributors, list) else [])
            ],
            "recent_commits": commits,
            "open_issues": [{"title": i["title"], "labels": [l["name"] for l in i.get("labels", [])]} for i in open_issues[:10]],
            "closed_issues_count": len(closed_issues),
            "root_files": root_files,
            "readme": readme_content,
            "file_samples": file_samples,
            "html_url": repo_data.get("html_url"),
            "homepage": repo_data.get("homepage"),
        }


@app.post("/api/analyze")
async def analyze_repo(
    request: RepoRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    try:
        owner, repo = parse_github_url(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    repo_key = f"{owner}/{repo}"
    user_id = int(current_user["sub"]) if current_user else None

    # Check cache
    cached = await get_analysis(repo_key, user_id)
    if cached:
        age = (datetime.utcnow() - datetime.fromisoformat(cached["analyzed_at"])).total_seconds()
        if age < 300:
            return {**cached, "cached": True}

    # Fetch and analyze
    github_data = await fetch_github_data(owner, repo, request.github_token)
    analysis = await anthropic_service.analyze_repository(github_data)

    result = {
        "repo_key": repo_key,
        "github_data": github_data,
        "analysis": analysis,
        "analyzed_at": datetime.utcnow().isoformat(),
        "cached": False,
    }

    await save_analysis(repo_key, result, user_id)
    return result


@app.get("/api/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    return await get_all_analyses(user_id)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}