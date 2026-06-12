import aiosqlite
import json
from datetime import datetime

DB_PATH = "analyzer.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_key TEXT UNIQUE NOT NULL,
                data TEXT NOT NULL,
                analyzed_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.commit()

async def save_analysis(repo_key: str, data: dict):
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO analyses (repo_key, data, analyzed_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(repo_key) DO UPDATE SET
                data = excluded.data,
                analyzed_at = excluded.analyzed_at,
                updated_at = excluded.updated_at
        """, (repo_key, json.dumps(data), data.get("analyzed_at", now), now))
        await db.commit()

async def get_analysis(repo_key: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT data FROM analyses WHERE repo_key = ?", (repo_key,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return json.loads(row[0])
    return None

async def get_all_analyses() -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT repo_key, analyzed_at FROM analyses ORDER BY updated_at DESC LIMIT 20"
        ) as cursor:
            rows = await cursor.fetchall()
            return [{"repo_key": r["repo_key"], "analyzed_at": r["analyzed_at"]} for r in rows]