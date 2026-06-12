
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import asyncio
import json
import re
from datetime import datetime
from database import init_db, save_analysis, get_analysis, get_all_analyses
#import anthropic_service

app = FastAPI(title="GitHub Repository Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

class RepoRequest(BaseModel):
    url: str
    github_token: str | None = None

def parse_github_url(url: str) -> tuple[str, str]:
    """Extract owner and repo from GitHub URL."""
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
    """Fetch comprehensive repo data from GitHub API."""
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
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

        # Try to fetch README
        readme_content = ""
        try:
            readme = await get(f"/repos/{owner}/{repo}/readme")
            import base64
            readme_content = base64.b64decode(readme.get("content", "")).decode("utf-8", errors="ignore")[:3000]
        except Exception:
            pass

        # Try to fetch key files
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
async def analyze_repo(request: RepoRequest):
    try:
        owner, repo = parse_github_url(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    repo_key = f"{owner}/{repo}"

    # Check cache (5 min)
    cached = await get_analysis(repo_key)
    if cached:
        age = (datetime.utcnow() - datetime.fromisoformat(cached["analyzed_at"])).total_seconds()
        if age < 300:
            return {**cached, "cached": True}

    # Fetch GitHub data
    github_data = await fetch_github_data(owner, repo, request.github_token)

    # Run AI analysis
   # analysis = await anthropic_service.analyze_repository(github_data)

    result = {
        "repo_key": repo_key,
        "github_data": github_data,
        "analysis": analysis,
        "analyzed_at": datetime.utcnow().isoformat(),
        "cached": False,
    }

    await save_analysis(repo_key, result)
    return result

@app.get("/api/history")
async def get_history():
    return await get_all_analyses()

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}