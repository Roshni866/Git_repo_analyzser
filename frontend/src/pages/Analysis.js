import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, PolarGrid, PolarAngleAxis,
  Radar, ResponsiveContainer, Tooltip
} from 'recharts';
import {
  Star, GitFork, Eye, AlertTriangle, CheckCircle,
  Copy, Check, ArrowLeft, ExternalLink
} from 'lucide-react';

// ── Score Ring Component ──────────────────────────────────────────
function ScoreRing({ score, size = 96, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? '#3fb950' : score >= 60 ? '#d29922' : '#f85149';
  const dash = (score / 100) * circ;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#21262d" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 600, color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{score}</div>
        <div style={{ fontSize: size * 0.12, color: 'var(--text-muted)' }}>/100</div>
      </div>
    </div>
  );
}

// ── Progress Bar Row ──────────────────────────────────────────────
function ProgressRow({ label, value }) {
  const color = value >= 80 ? '#3fb950' : value >= 60 ? '#d29922' : '#f85149';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color }}>{value}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Copy Button ───────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: copied ? 'var(--accent-green)' : 'var(--text-muted)', padding: 4,
    }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ── Severity badge colour ─────────────────────────────────────────
const SEVERITY_BADGE = {
  critical: 'badge-red',
  high: 'badge-orange',
  medium: 'badge-blue',
  low: 'badge-purple',
};
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ── Main Component ────────────────────────────────────────────────
export default function Analysis() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = sessionStorage.getItem('analysis_result');
    if (!raw) { navigate('/'); return; }
    setData(JSON.parse(raw));
  }, [navigate]);

  if (!data) return null;

  const { github_data: gh, analysis: a } = data;

  // Build radar chart data from scores
  const radarData = a.scores ? Object.entries(a.scores).map(([k, v]) => ({
    subject: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    score: v,
  })) : [];

  // Sort issues by severity
  const sortedIssues = [...(a.issues || [])].sort(
    (x, y) => (SEVERITY_ORDER[x.severity] ?? 4) - (SEVERITY_ORDER[y.severity] ?? 4)
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => navigate('/')}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {gh.full_name}
            </h1>
            <a href={gh.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
              <ExternalLink size={14} />
            </a>
          </div>
          {gh.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>
              {gh.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[
          { icon: <Star size={13} />, val: gh.stars?.toLocaleString(), label: 'stars' },
          { icon: <GitFork size={13} />, val: gh.forks?.toLocaleString(), label: 'forks' },
          { icon: <Eye size={13} />, val: gh.watchers?.toLocaleString(), label: 'watchers' },
          { icon: null, val: gh.license || 'No license', label: 'license' },
        ].map(s => (
          <div key={s.label} className="card" style={{
            padding: '6px 14px', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            {s.icon}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{s.val}</span>
            <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
        {(gh.topics || []).map(t => (
          <span key={t} className="badge badge-blue">{t}</span>
        ))}
      </div>

      {/* ── Score ring + Radar + Progress bars ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Overall score */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ScoreRing score={a.overall_score} size={110} stroke={10} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
              {a.grade}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Overall Grade</div>
          </div>
        </div>

        {/* Category scores */}
        <div className="card">
          <div className="section-title">Category scores</div>
          {Object.entries(a.scores || {}).map(([k, v]) => (
            <ProgressRow
              key={k}
              label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              value={v}
            />
          ))}
        </div>

        {/* Radar chart */}
        <div className="card">
          <div className="section-title">Radar overview</div>
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#30363d" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#8b949e', fontSize: 11 }} />
              <Radar dataKey="score" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent-blue)', background: 'rgba(88,166,255,0.05)' }}>
        <p style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{a.summary}</p>
      </div>

      {/* ── Tech stack ── */}
      {a.tech_stack && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Tech stack</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="badge badge-blue">{a.tech_stack.primary_language}</span>
            {(a.tech_stack.frameworks || []).map(f => <span key={f} className="badge badge-purple">{f}</span>)}
            {(a.tech_stack.tools || []).map(t => <span key={t} className="badge badge-green">{t}</span>)}
            {a.tech_stack.ci_cd && <span className="badge badge-orange">CI/CD</span>}
            {a.tech_stack.containerized && <span className="badge badge-orange">Docker</span>}
            {a.tech_stack.has_tests && <span className="badge badge-green">Tests ✓</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(gh.languages || {}).map(([lang, bytes]) => {
              const total = Object.values(gh.languages).reduce((a, b) => a + b, 0);
              const pct = Math.round((bytes / total) * 100);
              return (
                <span key={lang} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {lang} {pct}%
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Strengths + Issues ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Strengths */}
        <div className="card">
          <div className="section-title">
            <CheckCircle size={14} color="var(--accent-green)" style={{ marginRight: -4 }} />
            Strengths
          </div>
          {(a.strengths || []).map((s, i) => (
            <div key={i} style={{
              marginBottom: 12, paddingBottom: 12,
              borderBottom: i < a.strengths.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 3, color: 'var(--accent-green)' }}>
                {s.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Issues */}
        <div className="card">
          <div className="section-title">
            <AlertTriangle size={14} color="var(--accent-orange)" style={{ marginRight: -4 }} />
            Issues ({sortedIssues.length})
          </div>
          {sortedIssues.map((issue, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className={`badge ${SEVERITY_BADGE[issue.severity] || 'badge-blue'}`}>
                  {issue.severity}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{issue.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                {issue.detail}
              </div>
              {issue.fix && (
                <div style={{ fontSize: 12, color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)' }}>
                  → {issue.fix}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Skills ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Skills detected</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(a.skills_detected || []).map((s, i) => (
            <div key={i} style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '8px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</span>
                <span className={`badge ${s.level === 'advanced' ? 'badge-green' : s.level === 'intermediate' ? 'badge-blue' : 'badge-purple'}`}
                  style={{ fontSize: 10 }}>
                  {s.level}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.evidence}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recommendations ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Recommendations</div>
        {(a.recommendations || []).map((rec, i) => (
          <div key={i} style={{
            marginBottom: 12, paddingBottom: 12,
            borderBottom: i < a.recommendations.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={`badge ${rec.priority === 'high' ? 'badge-red' : rec.priority === 'medium' ? 'badge-orange' : 'badge-blue'}`}>
                {rec.priority}
              </span>
              <span style={{ fontWeight: 500, fontSize: 13 }}>{rec.title}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
              {rec.detail}
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent-blue)' }}>
              Impact: {rec.impact}
            </div>
          </div>
        ))}
      </div>

      {/* ── Resume bullets ── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: '0.75rem' }}>Resume bullets</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Copy-ready bullet points for your CV / LinkedIn
        </p>
        {(a.resume_bullets || []).map((bullet, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px', background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius)', marginBottom: 8,
          }}>
            <span style={{ color: 'var(--accent-blue)', fontSize: 16, lineHeight: 1, marginTop: 2 }}>•</span>
            <span style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}>{bullet}</span>
            <CopyButton text={bullet} />
          </div>
        ))}
      </div>

    </div>
  );
}