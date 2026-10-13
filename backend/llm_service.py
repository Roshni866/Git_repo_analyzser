"""LLM service for RepoLens.

Production uses Groq (Llama 3.3 70B). The Anthropic (Claude) branch is wired in behind
LLM_PROVIDER=anthropic but is NOT enabled in production: the Claude API needs paid API credits,
so it is planned for when the app has subscription revenue.
"""
import asyncio
import json
import os

PROVIDER = os.environ.get("LLM_PROVIDER", "groq").lower()

if PROVIDER == "anthropic":
    import anthropic                                   # pip install anthropic (only needed for this provider)
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-5")
else:
    from groq import Groq
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    MODEL = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")


ANALYSIS_PROMPT = """You are an expert software engineer and code reviewer. Analyze this GitHub repository and provide a comprehensive evaluation.

Repository Data:
{repo_data}

Respond with ONLY valid JSON, no markdown, no explanation, just the raw JSON object:

{{
  "overall_score": <0-100>,
  "grade": "<A+/A/B+/B/C+/C/D/F>",
  "summary": "<2-3 sentence executive summary>",

  "scores": {{
    "code_quality": <0-100>,
    "documentation": <0-100>,
    "architecture": <0-100>,
    "security": <0-100>,
    "maintainability": <0-100>,
    "activity": <0-100>
  }},

  "skills_detected": [
    {{"name": "<skill>", "level": "<beginner|intermediate|advanced>", "evidence": "<why>"}}
  ],

  "strengths": [
    {{"title": "<strength title>", "detail": "<explanation>"}}
  ],

  "issues": [
    {{"severity": "<critical|high|medium|low>", "category": "<security|performance|documentation|testing|architecture>", "title": "<issue title>", "detail": "<explanation>", "fix": "<suggested fix>"}}
  ],

  "recommendations": [
    {{"priority": "<high|medium|low>", "title": "<recommendation>", "detail": "<how to implement>", "impact": "<expected improvement>"}}
  ],

  "tech_stack": {{
    "primary_language": "<language>",
    "frameworks": ["<framework>"],
    "tools": ["<tool>"],
    "ci_cd": <true|false>,
    "containerized": <true|false>,
    "has_tests": <true|false>
  }},

  "resume_bullets": [
    "<ready-to-use resume bullet point for this project>"
  ]
}}"""


def _call_llm(prompt: str) -> str:
    """Blocking call to the configured provider. Returns the raw text of the reply."""
    if PROVIDER == "anthropic":
        resp = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096,
        temperature=0.3,
    )
    return resp.choices[0].message.content.strip()


def _parse_json(raw: str) -> dict:
    # Strip markdown fences if the model adds them
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw)


async def analyze_repository(github_data: dict) -> dict:
    repo_summary = {
        "name": github_data["name"],
        "description": github_data.get("description", "No description"),
        "languages": github_data.get("languages", {}),
        "stars": github_data.get("stars", 0),
        "forks": github_data.get("forks", 0),
        "size_kb": github_data.get("size_kb", 0),
        "license": github_data.get("license"),
        "topics": github_data.get("topics", []),
        "root_files": github_data.get("root_files", [])[:30],
        "recent_commits": github_data.get("recent_commits", [])[:5],
        "open_issues": github_data.get("open_issues", [])[:5],
        "closed_issues_count": github_data.get("closed_issues_count", 0),
        "contributors_count": github_data.get("contributors_count", 0),
        "has_wiki": github_data.get("has_wiki", False),
        "has_pages": github_data.get("has_pages", False),
        "readme_preview": github_data.get("readme", "")[:2000],
        "file_samples": github_data.get("file_samples", {}),
        "created_at": github_data.get("created_at"),
        "pushed_at": github_data.get("pushed_at"),
    }

    prompt = ANALYSIS_PROMPT.format(repo_data=json.dumps(repo_summary, indent=2))

    # The SDK call is blocking; run it in a worker thread so the event loop stays free for other requests.
    raw = await asyncio.to_thread(_call_llm, prompt)
    return _parse_json(raw)
