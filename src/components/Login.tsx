import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onNavigate: (route: string) => void;
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'ok' | 'err' | '' } | null>(null);

  // Password reset flow state
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const isReset = params.get('reset') === '1' || /type=(recovery|invite)/.test(hash);
    const authCode = params.get('code');

    if (isReset) {
      setIsResetMode(true);
      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          setNotice({ text: error.message, type: 'err' });
        }
      }
      return;
    }

    // Existing sessions must pass the same authorization gate as fresh logins.
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: grant, error: grantError } = await supabase
        .from('platform_admins')
        .select('user_id,role,is_active')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!grantError && grant?.role === 'admin') {
        onNavigate('/admin');
        return;
      }

      const { data: access, error: accessError } = await supabase.functions.invoke('cashfree-payments', {
        body: { action: 'check-store-access' },
      });
      if (accessError || !access?.success) {
        await supabase.auth.signOut();
        setNotice({ text: 'Store access could not be verified. Please try again after payment verification or contact Super Admin.', type: 'err' });
        return;
      }
      if (access.suspended) {
        await supabase.auth.signOut();
        setNotice({ text: 'This store is suspended. Please contact Super Admin.', type: 'err' });
        return;
      }
      if (access.paid || access.admin_assigned) {
        onLoginSuccess();
      } else {
        await supabase.auth.signOut();
        setNotice({ text: 'Store Admin login is available only after a verified package payment or direct approval by Super Admin. Choose a package or submit a store access request.', type: 'err' });
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        const loginMessage = /email not confirmed/i.test(error.message)
          ? 'This account has not completed email confirmation. Super Admin must generate a fresh account-setup link before sign-in.'
          : error.message;
        setNotice({ text: loginMessage, type: 'err' });
        return;
      }

      if (data?.user) {
        const { data: grant, error: grantError } = await supabase
          .from('platform_admins')
          .select('user_id,is_active')
          .eq('user_id', data.user.id)
          .eq('is_active', true)
          .maybeSingle();

        // Super Admin is allowed in directly; all other accounts need verified payment
        // or an explicit store assignment recorded by Super Admin.
        if (!grantError && grant) {
          onNavigate('/admin');
          return;
        }

        const { data: access, error: accessError } = await supabase.functions.invoke('cashfree-payments', {
          body: { action: 'check-store-access' },
        });
        if (accessError || !access?.success) {
          await supabase.auth.signOut();
          setNotice({ text: 'Store access could not be verified. Please try again or contact Super Admin.', type: 'err' });
          return;
        }
        if (access.suspended) {
          await supabase.auth.signOut();
          setNotice({ text: 'This store is suspended. Please contact Super Admin.', type: 'err' });
          return;
        }
        if (!access.paid && !access.admin_assigned) {
          await supabase.auth.signOut();
          setNotice({ text: 'Login is restricted to customers with a verified package payment. If Super Admin has approved your request, please contact support to verify the assignment.', type: 'err' });
          return;
        }
        onLoginSuccess();
      }
    } catch (err: any) {
      setNotice({ text: err?.message || 'Login failed.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setNotice({ text: 'Enter your account email first.', type: 'err' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: window.location.origin + '/login?reset=1',
      });
      setNotice({
        text: error
          ? error.message
          : 'If email delivery is configured, a password reset link has been sent.',
        type: error ? 'err' : 'ok',
      });
    } catch (err: any) {
      setNotice({ text: err?.message || 'Could not send reset email.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setNotice({ text: 'Password must be at least 8 characters.', type: 'err' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ text: 'Passwords do not match.', type: 'err' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setNotice({ text: error.message, type: 'err' });
        return;
      }
      await supabase.auth.signOut();
      setIsResetMode(false);
      setNotice({ text: 'Password saved successfully. You can now sign in.', type: 'ok' });
    } catch (err: any) {
      setNotice({ text: err?.message || 'Failed to update password.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  if (isResetMode) {
    return (
      <section className="panel center" style={{ maxWidth: 520 }}>
        <span className="eyebrow">SECURE ACCOUNT SETUP</span>
        <h1 style={{ margin: '14px 0 8px' }}>Set a new password</h1>
        <p className="muted">Choose a strong password for your GenieDevs account.</p>

        <form onSubmit={handleSetNewPassword}>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirmNewPassword">Confirm password</label>
            <input
              id="confirmNewPassword"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>

        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

        <button
          className="btn outline"
          type="button"
          onClick={() => setIsResetMode(false)}
          style={{ marginTop: 12 }}
        >
          Back to login
        </button>
      </section>
    );
  }

  return (
    <section className="panel center" style={{ maxWidth: 520 }}>
      <span className="eyebrow">APPROVED MERCHANT ACCESS</span>
      <h1 style={{ margin: '14px 0 8px' }}>Store Admin Login</h1>
      <p className="muted">
        Sign in with your Store Admin account to manage your storefront, product catalog, and orders.
      </p>

      <form onSubmit={handleSignIn}>
        <div className="field">
          <label htmlFor="merchantEmail">Email</label>
          <input
            id="merchantEmail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="merchantPassword">Password</label>
          <input
            id="merchantPassword"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <button
        className="btn outline"
        type="button"
        onClick={handleSendResetEmail}
        style={{ marginTop: 10, width: '100%' }}
      >
        Send password reset email
      </button>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <p className="muted small" style={{ marginTop: 16 }}>
        No account yet?{' '}
        <a
          href="/#support"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
            setTimeout(() => {
              document.getElementById('support')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          style={{ textDecoration: 'underline' }}
        >
          Request store access
        </a>
        .
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn outline" onClick={() => onNavigate('/')}>
          Main website
        </button>
        <button className="btn outline" onClick={() => onNavigate('/admin')}>
          Owner Admin
        </button>
      </div>
    </section>
  );
};
