import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Github, BarChart2, Clock, LogOut, LogIn, UserPlus, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout, isLoggedIn } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const active = (path) => loc.pathname === path;

  function handleLogout() {
    logout();
    navigate('/');
    setShowMenu(false);
  }

  return (
    <nav style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', height: 56 }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>
          <Github size={20} color="var(--accent-blue)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15 }}>
            repo<span style={{ color: 'var(--accent-blue)' }}>lens</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
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

        {/* Auth section */}
        {isLoggedIn ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '6px 12px',
                cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13,
              }}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
              ) : (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--accent-blue)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: '#0d1117',
                }}>
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || user?.email}
              </span>
              <ChevronDown size={13} style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '110%',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minWidth: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 200,
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--accent-red)', fontSize: 13,
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/login" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <LogIn size={14} /> Sign in
            </Link>
            <Link to="/signup" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserPlus size={14} /> Sign up
            </Link>
          </div>
        )}

      </div>
    </nav>
  );
}