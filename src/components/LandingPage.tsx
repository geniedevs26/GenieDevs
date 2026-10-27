import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<{ text: string; type: 'ok' | 'err' | '' } | null>(null);

  const planAmounts: Record<string, number> = {
    Basic: 999,
    Standard: 1999,
    Premium: 2999,
  };

  const handleStartCheckout = async (planName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCheckoutPlan(planName);
        setCheckoutNotice(null);
        return;
      }
      // Logged in user checkout
      setCheckoutLoading(true);
      const { data, error } = await supabase.functions.invoke('cashfree-payments', {
        body: { action: 'create-plan-order', plan_name: planName },
      });
      if (error || !data?.success || !data.payment_session_id) {
        throw new Error(data?.error || error?.message || 'Could not create payment order.');
      }
      const cashfreeWindow = window as any;
      if (cashfreeWindow.Cashfree) {
        const cashfree = await cashfreeWindow.Cashfree({
          mode: data.environment === 'production' ? 'production' : 'sandbox',
        });
        await cashfree.checkout({
          paymentSessionId: data.payment_session_id,
          redirectTarget: '_self',
        });
      } else {
        alert('Cashfree SDK is not loaded. Please try again.');
      }
    } catch (err: any) {
      alert((err?.message || 'Checkout failed.') + ' No store access is granted unless payment is verified.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleGuestCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;
    setCheckoutLoading(true);
    setCheckoutNotice({ text: 'Preparing secure checkout…', type: '' });

    try {
      const email = guestEmail.trim().toLowerCase();
      const phone = guestPhone.replace(/\D/g, '').slice(-10);
      if (!/^\d{10}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
      const { data, error } = await supabase.functions.invoke('cashfree-payments', {
        body: { action: 'create-guest-order', email, phone, plan_name: checkoutPlan },
      });
      if (error || !data?.success || !data.payment_session_id || !data.order_id || !data.claim_secret) {
        throw new Error(data?.error || error?.message || 'Could not prepare payment.');
      }
      try {
        localStorage.setItem(
          'gd_claim_' + data.order_id,
          JSON.stringify({ claim_secret: data.claim_secret, plan: checkoutPlan, email })
        );
      } catch {
        throw new Error('Secure checkout could not save browser session. Enable site storage and retry.');
      }
      const cashfreeWindow = window as any;
      if (cashfreeWindow.Cashfree) {
        const cashfree = await cashfreeWindow.Cashfree({
          mode: data.environment === 'production' ? 'production' : 'sandbox',
        });
        await cashfree.checkout({
          paymentSessionId: data.payment_session_id,
          redirectTarget: '_self',
        });
      } else {
        setCheckoutNotice({
          text: `Cashfree checkout could not load for order ${data.order_id}. Payment has not been completed. Please refresh the page and try again.`,
          type: 'err',
        });
      }
    } catch (err: any) {
      setCheckoutNotice({
        text: err?.message || 'Checkout could not start. No store access is granted.',
        type: 'err',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      {/* Checkout Modal / Overlay for Guest Checkout */}
      {checkoutPlan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCheckoutPlan(null);
          }}
        >
          <section className="panel" style={{ maxWidth: 520, width: '100%', position: 'relative' }}>
            <button
              onClick={() => setCheckoutPlan(null)}
              style={{
                position: 'absolute',
                right: 18,
                top: 18,
                background: 'transparent',
                border: 0,
                color: 'var(--muted)',
                fontSize: '1.2rem',
              }}
              aria-label="Close checkout"
            >
              ✕
            </button>
            <span className="eyebrow">SECURE CHECKOUT</span>
            <h1 style={{ fontSize: '1.8rem', margin: '14px 0 8px' }}>Pay first, create your store next</h1>
            <p className="muted">
              Enter your email and complete Cashfree payment. Your account and store are created only after the server
              verifies successful payment.
            </p>

            <form onSubmit={handleGuestCheckoutSubmit}>
              <div className="field">
                <label>Email address</label>
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="name@business.com"
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label>Mobile number (India)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                  minLength={10}
                  maxLength={14}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                />
              </div>
              <button
                className="btn primary"
                type="submit"
                disabled={checkoutLoading}
                style={{ width: '100%', marginTop: 8 }}
              >
                {checkoutLoading
                  ? 'Preparing secure checkout…'
                  : `Continue to secure payment · ₹${(planAmounts[checkoutPlan] || 0).toLocaleString('en-IN')}`}
              </button>
            </form>

            {checkoutNotice && (
              <div className={`notice ${checkoutNotice.type}`}>{checkoutNotice.text}</div>
            )}

            <p className="muted small" style={{ marginTop: 16 }}>
              Already have an account?{' '}
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/login');
                }}
                style={{ color: 'var(--brand)', textDecoration: 'underline' }}
              >
                Sign in
              </a>
              , then choose your package.
            </p>
            <button className="btn outline" type="button" onClick={() => setCheckoutPlan(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero">
        <div>
          <span className="eyebrow">✦ Digital storefronts for ambitious local brands</span>
          <h1>
            Turn your products into a <span className="gradient">beautiful online store.</span>
          </h1>
          <p>
            A polished storefront, an easy product catalog, and WhatsApp-first ordering — built to help small
            businesses look professional and make buying simpler.
          </p>
          <div className="actions">
            <a
              className="btn primary"
              href="/demo"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/demo');
              }}
            >
              Explore interactive demo <span aria-hidden="true">↗</span>
            </a>
            <a
              className="btn outline"
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Explore packages
            </a>
          </div>
          <p className="muted">Designed for mobile · Your own shareable link · No fake checkout promises</p>
        </div>

        {/* Live Store Concept Mockup */}
        <div className="mock">
          <div className="toolbar">
            <span className="eyebrow">LIVE STORE CONCEPT</span>
            <span style={{ fontSize: '0.8rem', color: '#7b8499' }}>● Preview</span>
          </div>
          <div className="mockinner" style={{ marginTop: 15 }}>
            <div className="toolbar">
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#6c63e8',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                  }}
                >
                  LITTLE LOCAL MARKET
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: '1.5rem', letterSpacing: '-0.7px' }}>
                  Fresh finds, local love.
                </h2>
              </div>
              <span style={{ fontSize: '1.8rem' }}>✳</span>
            </div>
            <p style={{ fontSize: '0.86rem', color: '#68738b', margin: '5px 0 16px' }}>
              A sample storefront experience
            </p>
            <div
              className="productgrid"
              style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 14 }}
            >
              <div className="product">
                <div style={{ fontSize: '1.7rem' }}>🫙</div>
                <h3>Homemade Pickle</h3>
                <p className="muted small">Small-batch favourite</p>
                <b>₹180</b>
              </div>
              <div className="product">
                <div style={{ fontSize: '1.7rem' }}>🍯</div>
                <h3>Wildflower Honey</h3>
                <p className="muted small">Naturally golden</p>
                <b>₹250</b>
              </div>
              <div className="product">
                <div style={{ fontSize: '1.7rem' }}>🌶️</div>
                <h3>Signature Spice</h3>
                <p className="muted small">A little extra flavour</p>
                <b>₹120</b>
              </div>
              <div className="product">
                <div style={{ fontSize: '1.7rem' }}>🍪</div>
                <h3>Butter Cookies</h3>
                <p className="muted small">Baked with care</p>
                <b>₹160</b>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 14,
                padding: '13px 14px',
                borderRadius: 12,
                background: '#eeedff',
                color: '#39327e',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Simple ordering, made easy</span>
              <b>WhatsApp ↗</b>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="sections" id="features">
        <div className="sectionhead">
          <h2>Everything to get started</h2>
          <p>A simple storefront for local sellers, boutiques, homemade food businesses and independent retailers.</p>
        </div>
        <div className="featuregrid">
          <article className="feature">
            <h3>Your own store link</h3>
            <p>Share one easy link with customers across social media and messaging apps.</p>
          </article>
          <article className="feature">
            <h3>Product catalog</h3>
            <p>Add product photos, descriptions, fractional units, prices, and instant availability toggles.</p>
          </article>
          <article className="feature">
            <h3>WhatsApp-first orders</h3>
            <p>Customers can send their customized cart and delivery details directly to your WhatsApp.</p>
          </article>
        </div>
      </section>

      {/* Pricing */}
      <section className="sections pricing" id="pricing">
        <div className="sectionhead">
          <h2>Choose the right store package</h2>
          <p>
            Pay securely through Cashfree. Store Admin access is enabled only after payment verification and Super
            Admin store assignment.
          </p>
        </div>
        <div className="pricegrid">
          <article className="pricecard">
            <h3>Basic</h3>
            <div className="price">₹999</div>
            <p className="muted">For a small catalog</p>
            <ul>
              <li>Up to 6 active products</li>
              <li>Unavailable products remain saved</li>
              <li>Store URL and WhatsApp-first ordering setup</li>
              <li>Core catalog setup scope</li>
            </ul>
            <button className="btn outline" type="button" onClick={() => handleStartCheckout('Basic')}>
              Pay Basic · ₹999
            </button>
          </article>

          <article className="pricecard" style={{ border: '2px solid var(--brand)' }}>
            <span className="pill">Recommended</span>
            <h3 style={{ marginTop: 12 }}>Standard</h3>
            <div className="price">₹1,999</div>
            <p className="muted">For growing product catalogs</p>
            <ul>
              <li>Up to 15 active products</li>
              <li>Unavailable products remain saved</li>
              <li>Store URL and WhatsApp-first ordering setup</li>
              <li>Expanded catalog setup scope</li>
            </ul>
            <button className="btn primary" type="button" onClick={() => handleStartCheckout('Standard')}>
              Pay Standard · ₹1,999
            </button>
          </article>

          <article className="pricecard">
            <h3>Premium</h3>
            <div className="price">₹2,999</div>
            <p className="muted">For larger catalogs</p>
            <ul>
              <li>Up to 30 active products</li>
              <li>Unavailable products remain saved</li>
              <li>Store URL and WhatsApp-first ordering setup</li>
              <li>Largest catalog setup scope</li>
              <li>Priority setup coordination</li>
            </ul>
            <button className="btn outline" type="button" onClick={() => handleStartCheckout('Premium')}>
              Pay Premium · ₹2,999
            </button>
          </article>
        </div>
      </section>

      {/* Account Info */}
      <section className="sections" id="account">
        <div className="sectionhead">
          <h2>Get your store</h2>
          <p>
            Create your account, sign in, and choose your own store name and URL. If you need help, GenieDevs support
            can set it up with you.
          </p>
        </div>
        <div className="panel center">
          <p className="muted">
            If you already have a Store Admin account, sign in and manage your storefront. If you do not have an account
            or want assistance with onboarding, submit your business name and email through our support form below.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            <a
              className="btn primary"
              href="#support"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('support')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Request store access
            </a>
            <button className="btn outline" onClick={() => onNavigate('/login')}>
              Store Admin Login
            </button>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="sections support-section" id="support">
        <div className="sectionhead">
          <span className="eyebrow">GENIEDEVS SUPPORT</span>
          <h2>Let’s make your store work for your business.</h2>
          <p>
            Ask about setup, product options, delivery, package benefits or custom features. We’ll clarify what is
            included before confirming a package.
          </p>
        </div>
        <div className="support-layout">
          <div className="support-info">
            <article className="support-card">
              <span className="support-icon">✦</span>
              <h3>Store setup & packages</h3>
              <p>Help choosing a package, setting up your catalog and understanding product limits.</p>
            </article>
            <article className="support-card">
              <span className="support-icon">⚙</span>
              <h3>Custom features</h3>
              <p>Ask about variants, weight-based pricing, delivery rules or optional online payments.</p>
            </article>
            <article className="support-card">
              <span className="support-icon">↗</span>
              <h3>Existing store</h3>
              <p>Tell us what is not working or what you want to improve.</p>
            </article>
            <div className="support-note">
              <b>Transparent pricing</b>
              <p>
                Package prices and benefits are proposed transparently. Direct online payment configuration is enabled
                per store request.
              </p>
            </div>
          </div>

          <div className="panel support-form-panel">
            <h3>Send us a message</h3>
            <form action="https://formspree.io/f/xkjoakoe" method="POST" className="support-form">
              <div className="support-form-grid">
                <div className="field">
                  <label htmlFor="supportName">Your name *</label>
                  <input id="supportName" name="name" maxLength={100} autoComplete="name" required />
                </div>
                <div className="field">
                  <label htmlFor="supportEmail">Email address *</label>
                  <input
                    id="supportEmail"
                    name="email"
                    type="email"
                    maxLength={200}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="supportTopic">What do you need help with? *</label>
                <select id="supportTopic" name="topic" required defaultValue="">
                  <option value="" disabled>
                    Choose a topic
                  </option>
                  <option>Choosing a package</option>
                  <option>Store setup and catalog</option>
                  <option>Product variants / weight pricing</option>
                  <option>Delivery area and WhatsApp ordering</option>
                  <option>Custom feature or add-on</option>
                  <option>Online payment integration</option>
                  <option>Existing store support</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="supportPackage">Package (optional)</label>
                <select id="supportPackage" name="package" defaultValue="">
                  <option value="">Not decided yet</option>
                  <option>Basic — ₹999</option>
                  <option>Standard — ₹1,999</option>
                  <option>Premium — ₹2,999</option>
                  <option>Custom requirements</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="supportMessage">How can we help? *</label>
                <textarea
                  id="supportMessage"
                  name="message"
                  rows={5}
                  maxLength={3000}
                  placeholder="Tell us about your business and what you need."
                  required
                />
              </div>
              <input type="hidden" name="_subject" value="GenieDevs support request" />
              <button className="btn primary" type="submit">
                Send support request ↗
              </button>
              <p className="muted small">
                Please don’t send passwords or card details. This form sends your request to GenieDevs support.
              </p>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};
