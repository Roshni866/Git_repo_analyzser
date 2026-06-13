import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Github, Zap, Shield, Code2, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
const API_BASE = process.env.REACT_APP_API_URL || '';

const EXAMPLES = [
  'https://github.com/tiangolo/fastapi',
  'https://github.com/facebook/react',
  'https://github.com/microsoft/vscode',
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');   // GitHub token input
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const navigate = useNavigate();
  const { token: authToken } = useAuth();       // JWT auth token

  const messages = [
    'Fetching repository data…',
    'Analysing code structure…',
    'Running AI code review…',
    'Extracting skills & insights…',
    'Generating recommendations…',
  ];

  async function handleAnalyze(repoUrl = url) {
    if (!repoUrl.trim()) return;
    setError('');
    setLoading(true);
    let i = 0;
    setLoadingMsg(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 1800);
     try {
      const res = await axios.post(
  `${API_BASE}/api/analyze`,
  { url: repoUrl, github_token: null },
  authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}
);
   
      sessionStorage.setItem('analysis_result', JSON.stringify(res.data));
      navigate('/analysis');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to analyze. Check the URL and try again.');
    } finally {
      setLoading(false);
      clearInterval(interval);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingTop: '3rem' }}>

      {/* Hero section */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(88,166,255,0.1)',
          border: '1px solid rgba(88,166,255,0.25)',
          borderRadius: 99, padding: '4px 14px',
          fontSize: 12, color: 'var(--accent-blue)',
          fontFamily: 'var(--font-mono)', marginBottom: '1.5rem',
        }}>
          <Zap size={12} /> AI-powered · Free · No sign-up
        </div>

        <h1 style={{
          fontSize: 42, fontWeight: 600, lineHeight: 1.2,
          marginBottom: '1rem', letterSpacing: '-0.02em',
        }}>
          Understand any{' '}
          <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
            repository
          </span>
          <br />in seconds
        </h1>

        <p style={{
          color: 'var(--text-secondary)', fontSize: 16,
          lineHeight: 1.7, maxWidth: 500, margin: '0 auto',
        }}>
          Paste a GitHub URL and get AI-generated code quality scores,
          skill extraction, security issues, and actionable recommendations.
        </p>
      </div>

      {/* Input card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Github size={16} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
            }} />
            <input
              type="text"
              placeholder="https://github.com/owner/repository"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => handleAnalyze()}
            disabled={loading || !url.trim()}
            style={{ whiteSpace: 'nowrap', minWidth: 110 }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14 }} />{' '}</>
              : <Search size={15} />
            }
            {loading ? 'Analyzing' : 'Analyze'}
          </button>
        </div>

        {/* Loading message */}
        {loading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0', color: 'var(--text-secondary)', fontSize: 13,
          }}>
            <span className="spinner" />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{loadingMsg}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(248,81,73,0.1)',
            border: '1px solid rgba(248,81,73,0.3)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
            color: 'var(--accent-red)', fontSize: 13, marginTop: 8,
          }}>
            {error}
          </div>
        )}

        {/* GitHub token toggle */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowToken(!showToken)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Shield size={12} />
            GitHub token (optional — avoids rate limits)
            <ChevronRight size={12} style={{
              transform: showToken ? 'rotate(90deg)' : 'none',
              transition: '0.2s',
            }} />
          </button>
          {showToken && (
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={e => setToken(e.target.value)}
              style={{ marginTop: 8 }}
            />
          )}
        </div>
      </div>

      {/* Example repos */}
      <div style={{ marginBottom: '3rem' }}>
        <p style={{
          fontSize: 12, color: 'var(--text-muted)',
          marginBottom: 8, fontFamily: 'var(--font-mono)',
        }}>
          try an example →
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              className="btn btn-secondary"
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
              onClick={() => { setUrl(ex); handleAnalyze(ex); }}
            >
              {ex.replace('https://github.com/', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          {
            icon: <Code2 size={18} color="var(--accent-blue)" />,
            title: 'Code quality',
            desc: 'Architecture, maintainability & tech debt scores',
          },
          {
            icon: <Shield size={18} color="var(--accent-orange)" />,
            title: 'Security scan',
            desc: 'Detect missing best practices & vulnerabilities',
          },
          {
            icon: <Zap size={18} color="var(--accent-green)" />,
            title: 'Skill extractor',
            desc: 'Auto-generate resume bullets from the codebase',
          },
        ].map(f => (
          <div key={f.title} className="card" style={{
            background: 'var(--bg-tertiary)',
            textAlign: 'center', padding: '1.25rem 1rem',
          }}>
            <div style={{ marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}