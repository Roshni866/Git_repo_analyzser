import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Github, Clock, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
const API_BASE = process.env.REACT_APP_API_URL || '';

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState('');
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    axios.get(`${API_BASE}/api/history`)
      .then(r => { setItems(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function loadAnalysis(repoKey) {
    setAnalyzing(repoKey);
    try {
     const res = await axios.post(
  `${API_BASE}/api/analyze`,
  { url: `https://github.com/${repoKey}` },
  { headers: { Authorization: `Bearer ${token}` } }
);
      sessionStorage.setItem('analysis_result', JSON.stringify(res.data));
      navigate('/analysis');
    } catch (e) {
      alert('Failed to load analysis. Try again.');
    } finally {
      setAnalyzing('');
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        <span className="spinner" />
        <p style={{ marginTop: 12 }}>Loading history...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Analysis history</h1>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {items.length} repo{items.length !== 1 ? 's' : ''} analyzed
        </span>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Github size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 500, marginBottom: 8 }}>No analyses yet</p>
          <p style={{ fontSize: 12, marginBottom: 20 }}>Analyze a repository to see it here</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            <Search size={14} /> Analyze a repo
          </button>
        </div>
      ) : (
        <>
          {/* Info text */}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Click any repo to reload its analysis instantly from cache.
          </p>

          {/* History list */}
          {items.map(item => (
            <div
              key={item.repo_key}
              className="card"
              onClick={() => loadAnalysis(item.repo_key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: 8, cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            >
              {/* Icon */}
              <Github size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />

              {/* Repo info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14,
                  fontWeight: 500, marginBottom: 3,
                }}>
                  {item.repo_key}
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Clock size={11} />
                  {new Date(item.analyzed_at).toLocaleString()}
                </div>
              </div>

              {/* Loading or arrow */}
              {analyzing === item.repo_key
                ? <span className="spinner" style={{ width: 16, height: 16, flexShrink: 0 }} />
                : <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              }
            </div>
          ))}
        </>
      )}
    </div>
  );
}