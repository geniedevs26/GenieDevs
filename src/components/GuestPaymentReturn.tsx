import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface GuestPaymentReturnProps {
  orderId: string;
  onNavigate: (route: string) => void;
}

type VerificationState = 'checking' | 'pending' | 'failed' | 'success' | 'missing' | 'created';

interface ClaimData {
  claim_secret: string;
  plan?: string;
  email?: string;
}

export const GuestPaymentReturn: React.FC<GuestPaymentReturnProps> = ({ orderId, onNavigate }) => {
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [status, setStatus] = useState<VerificationState>('checking');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('');
  const [storeName, setStoreName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [storeSlug, setStoreSlug] = useState('');

  const verifyPayment = useCallback(async (claimData: ClaimData) => {
    setBusy(true);
    setStatus('checking');
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('cashfree-payments', {
        body: { action: 'verify-guest-order', order_id: orderId, claim_secret: claimData.claim_secret },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Could not verify this payment yet.');
      }
      if (data.status === 'success') {
        setEmail(String(data.email || claimData.email || ''));
        setPlan(String(data.plan || claimData.plan || ''));
        setStatus('success');
      } else if (data.status === 'pending') {
        setStatus('pending');
        setMessage('Cashfree has not confirmed this payment yet. You can check again shortly. Do not pay a second time for this order.');
      } else {
        setStatus('failed');
        setMessage('Cashfree did not confirm this payment. No account or store has been created. If your bank shows a debit, contact Cashfree support with this order reference before retrying payment.');
      }
    } catch (error) {
      setStatus('pending');
      setMessage(error instanceof Error ? error.message : 'Payment verification is temporarily unavailable. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  useEffect(() => {
    let stored: ClaimData | null = null;
    try {
      const raw = window.localStorage.getItem('gd_claim_' + orderId);
      if (raw) stored = JSON.parse(raw) as ClaimData;
    } catch {
      stored = null;
    }
    if (!stored?.claim_secret) {
      setStatus('missing');
      setMessage('This browser does not have the secure checkout reference needed to verify the order. Do not pay again. Keep the order ID below and contact support if you completed a payment.');
      return;
    }
    setClaim(stored);
    void verifyPayment(stored);
  }, [orderId, verifyPayment]);

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!claim) return;
    if (password.length < 8) {
      setMessage('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('The passwords do not match.');
      return;
    }
    if (storeName.trim().length < 2) {
      setMessage('Enter a store name with at least 2 characters.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('cashfree-payments', {
        body: {
          action: 'complete-guest-registration',
          order_id: orderId,
          claim_secret: claim.claim_secret,
          password,
          business_name: storeName.trim(),
        },
      });
      if (error || !data?.success || !data?.store_slug) {
        throw new Error(data?.error || error?.message || 'Account creation could not be completed.');
      }
      setStoreSlug(String(data.store_slug));
      setStatus('created');
      try {
        window.localStorage.removeItem('gd_claim_' + orderId);
      } catch {}
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Account creation failed. Your verified payment can be checked again; do not pay again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" style={{ maxWidth: 650, margin: '42px auto', padding: 'clamp(22px, 4vw, 36px)' }}>
      <span className="eyebrow">SECURE CHECKOUT</span>
      {status === 'checking' && (
        <>
          <h1 style={{ marginTop: 14 }}>Verifying your payment…</h1>
          <p className="muted">We are checking the order directly with Cashfree. Please keep this page open.</p>
        </>
      )}
      {status === 'pending' && (
        <>
          <h1 style={{ marginTop: 14 }}>Payment confirmation pending</h1>
          <p className="muted">{message || 'Cashfree has not confirmed this payment yet.'}</p>
          {claim && <button className="btn primary" type="button" disabled={busy} onClick={() => void verifyPayment(claim)}>{busy ? 'Checking…' : 'Check payment again'}</button>}
        </>
      )}
      {status === 'failed' && (
        <>
          <h1 style={{ marginTop: 14 }}>Payment not confirmed</h1>
          <p className="muted">{message}</p>
          {claim && <button className="btn outline" type="button" disabled={busy} onClick={() => void verifyPayment(claim)}>{busy ? 'Checking…' : 'Check status again'}</button>}
        </>
      )}
      {status === 'missing' && (
        <>
          <h1 style={{ marginTop: 14 }}>We need to verify your order</h1>
          <p className="muted">{message}</p>
          <p><strong>Order reference:</strong> <code>{orderId}</code></p>
        </>
      )}
      {status === 'success' && (
        <>
          <h1 style={{ marginTop: 14 }}>Payment confirmed</h1>
          <p className="muted">Cashfree has confirmed your {plan || 'selected'} package. Create your GenieDevs login and store below. You will not be asked to pay again for this order.</p>
          <form onSubmit={handleCreateAccount}>
            <div className="field">
              <label>Email address</label>
              <input type="email" value={email} readOnly required autoComplete="email" />
            </div>
            <div className="field">
              <label>Store name</label>
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} required minLength={2} maxLength={80} placeholder="Your business or store name" autoComplete="organization" />
            </div>
            <div className="field">
              <label>Create password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" />
            </div>
            {message && <div className="notice err" role="alert">{message}</div>}
            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 12 }}>
              {busy ? 'Creating your account…' : 'Create account and store'}
            </button>
          </form>
        </>
      )}
      {status === 'created' && (
        <>
          <h1 style={{ marginTop: 14 }}>Your account and store are ready</h1>
          <p className="muted">Your payment was verified and your GenieDevs account has been created.</p>
          <p><strong>Store link:</strong> <a href={'/store/' + storeSlug} onClick={(event) => { event.preventDefault(); onNavigate('/store/' + storeSlug); }}>{window.location.origin + '/store/' + storeSlug}</a></p>
          <button className="btn primary" type="button" onClick={() => onNavigate('/login')}>Sign in to GenieDevs</button>
        </>
      )}
      <p className="muted small" style={{ marginTop: 22 }}>Order reference: <code>{orderId}</code></p>
      <p className="muted small">For your security, the account is created only after Cashfree confirms successful payment on the server.</p>
    </section>
  );
};
