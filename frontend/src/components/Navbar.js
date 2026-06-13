import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Github, BarChart2, Clock } from 'lucide-react';

export default function Navbar() {
  const loc = useLocation();
  const active = (path) => loc.pathname === path;

  return (
    <nav style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', height: 56 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>
          <Github size={20} color="var(--accent-blue)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15 }}>
            repo<span style={{ color: 'var(--accent-blue)' }}>lens</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { to: '/', icon: <BarChart2 size={15} />, label: 'Analyze' },
            { to: '/history', icon: <Clock size={15} />, label: 'History' },
          ].map(({ to, icon, label }) => (
            <Link key={to} to={to} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 'var(--radius)',
              textDecoration: 'none', fontSize: 14,
              color: active(to) ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: active(to) ? 'var(--bg-tertiary)' : 'transparent',
              fontWeight: active(to) ? 500 : 400,
            }}>
              {icon}{label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}