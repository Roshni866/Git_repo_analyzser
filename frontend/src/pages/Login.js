import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { Github, Mail, Lock } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || '';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, {
        token: credentialResponse.credential,
      });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError('Google login failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <Github size={24} color="var(--accent-blue)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>
            repo<span style={{ color: 'var(--accent-blue)' }}>lens</span>
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Welcome back</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sign in to your account</p>
      </div>

      <div className="card">
        {/* Google login */}
        <div style={{ marginBottom: 20 }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google login failed')}
            theme="filled_black"
            size="large"
            width="100%"
            text="signin_with"
          />
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Email + password form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,81,73,0.1)',
              border: '1px solid rgba(248,81,73,0.3)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              color: 'var(--accent-red)',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Sign in'}
          </button>
        </div>

        {/* Switch to signup */}
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}