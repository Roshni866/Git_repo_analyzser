import aiosqlite
import json
from datetime import datetime

DB_PATH = "analyzer.db"


async def init_db():
    """Create all tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT,
                name TEXT,
                google_id TEXT,
                avatar_url TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # Analyses table with user_id
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_key TEXT NOT NULL,
                data TEXT NOT NULL,
                user_id INTEGER,
                analyzed_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        await db.commit()


# ── User operations ───────────────────────────────────────────────

async def create_user(email: str, hashed_password: str = None, name: str = None, google_id: str = None, avatar_url: str = None) -> dict:
    """Create a new user and return their data."""
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO users (email, hashed_password, name, google_id, avatar_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (email, hashed_password, name, google_id, avatar_url, now))
        await db.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "email": email, "name": name, "avatar_url": avatar_url}


async def get_user_by_email(email: str) -> dict | None:
    """Find a user by email address."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def get_user_by_google_id(google_id: str) -> dict | None:
    """Find a user by their Google ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE google_id = ?", (google_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


async def get_user_by_id(user_id: int) -> dict | None:
    """Find a user by their ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?",
            (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
    return None


# ── Analysis operations ───────────────────────────────────────────

async def save_analysis(repo_key: str, data: dict, user_id: int = None):
    """Save analysis result, linked to a user if provided."""
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        # Check if this user already has an analysis for this repo
        if user_id:
            async with db.execute(
                "SELECT id FROM analyses WHERE repo_key = ? AND user_id = ?",
                (repo_key, user_id)
            ) as cursor:
                existing = await cursor.fetchone()

            if existing:
                await db.execute("""
                    UPDATE analyses SET data = ?, analyzed_at = ?, updated_at = ?
                    WHERE repo_key = ? AND user_id = ?
                """, (json.dumps(data), data.get("analyzed_at", now), now, repo_key, user_id))
            else:
                await db.execute("""
                    INSERT INTO analyses (repo_key, data, user_id, analyzed_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (repo_key, json.dumps(data), user_id, data.get("analyzed_at", now), now))
        else:
            # No user — save as anonymous
            await db.execute("""
                INSERT INTO analyses (repo_key, data, user_id, analyzed_at, updated_at)
                VALUES (?, ?, NULL, ?, ?)
            """, (repo_key, json.dumps(data), data.get("analyzed_at", now), now))

        await db.commit()


async def get_analysis(repo_key: str, user_id: int = None) -> dict | None:
    """Get cached analysis for a repo, optionally filtered by user."""
    async with aiosqlite.connect(DB_PATH) as db:
        if user_id:
            query = "SELECT data FROM analyses WHERE repo_key = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1"
            params = (repo_key, user_id)
        else:
            query = "SELECT data FROM analyses WHERE repo_key = ? ORDER BY updated_at DESC LIMIT 1"
            params = (repo_key,)

        async with db.execute(query, params) as cursor:
            row = await cursor.fetchone()
            if row:
                return json.loads(row[0])
    return None


async def get_all_analyses(user_id: int = None) -> list:
    """Get history — only for the specific user if user_id provided."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            query = """
                SELECT repo_key, analyzed_at 
                FROM analyses 
                WHERE user_id = ? 
                ORDER BY updated_at DESC 
                LIMIT 20
            """
            params = (user_id,)
        else:
            query = """
                SELECT repo_key, analyzed_at 
                FROM analyses 
                ORDER BY updated_at DESC 
                LIMIT 20
            """
            params = ()

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [{"repo_key": r["repo_key"], "analyzed_at": r["analyzed_at"]} for r in rows]