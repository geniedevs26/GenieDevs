import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { LiveDemo } from './components/LiveDemo';
import { StoreFront } from './components/StoreFront';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_SESSION_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_STARTED_KEY = 'geniedevs-session-started-at';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('geniedevs-theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [currentRoute, setCurrentRoute] = useState<string>(() => window.location.pathname);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());
  const expiringRef = useRef(false);

  useEffect(() => {
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem('geniedevs-theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    const handlePopState = () => setCurrentRoute(window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setUserEmail(session?.user?.email || null);
      if (session) {
        try {
          if (!window.sessionStorage.getItem(SESSION_STARTED_KEY) || event === 'SIGNED_IN') {
            window.sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
          }
        } catch {}
        lastActivityRef.current = Date.now();
        expiringRef.current = false;
      } else {
        try {
          window.sessionStorage.removeItem(SESSION_STARTED_KEY);
        } catch {}
        if (event === 'SIGNED_OUT') {
          const path = window.location.pathname.replace(/\/+$/, '') || '/';
          if (path === '/dashboard' || path === '/admin') {
            window.history.replaceState({}, '', '/login');
            setCurrentRoute('/login');
          }
        }
      }
    });

    const validateInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session) {
          let startedAt = 0;
          try {
            startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_KEY));
          } catch {}
          if (!startedAt || !Number.isFinite(startedAt) || Date.now() - startedAt >= MAX_SESSION_AGE_MS) {
            await supabase.auth.signOut();
            if (!mounted) return;
            setUserEmail(null);
          } else {
            const { data: adminGrant } = await supabase
              .from('platform_admins')
              .select('user_id')
              .eq('user_id', session.user.id)
              .eq('is_active', true)
              .maybeSingle();

            if (!adminGrant) {
              // Fail closed on protected app entry: only verified payers or explicit
              // Super Admin assignments may retain a Store Admin session.
              const { data: access, error: accessError } = await supabase.functions.invoke('cashfree-payments', {
                body: { action: 'check-store-access' },
              });
              if (accessError || !access?.success || access.suspended || (!access.paid && !access.admin_assigned)) {
                await supabase.auth.signOut();
                if (!mounted) return;
                setUserEmail(null);
                const path = window.location.pathname.replace(/\\/+$/, '') || '/';
                if (path === '/dashboard' || path === '/admin') {
                  window.history.replaceState({}, '', '/login');
                  setCurrentRoute('/login');
                }
                return;
              }
            }
            setUserEmail(session.user.email || null);
            lastActivityRef.current = Date.now();
          }
        } else {
          setUserEmail(null);
        }
      } catch {
        if (mounted) setUserEmail(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    void validateInitialSession();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'return' && params.get('order_id')) {
      void handleCashfreeReturn(params.get('order_id')!, params.get('guest') === '1');
    }

    return () => {
      mounted = false;
      window.removeEventListener('popstate', handlePopState);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail || authLoading) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'click'
    ];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));

    const interval = window.setInterval(() => {
      if (expiringRef.current) return;
      const now = Date.now();
      let startedAt = 0;
      try {
        startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_KEY));
      } catch {}
      const maxAgeReached = !startedAt || !Number.isFinite(startedAt) || now - startedAt >= MAX_SESSION_AGE_MS;
      const idleReached = now - lastActivityRef.current >= IDLE_TIMEOUT_MS;
      if (maxAgeReached || idleReached) {
        expiringRef.current = true;
        void supabase.auth.signOut().finally(() => {
          setUserEmail(null);
          window.history.replaceState({}, '', '/login');
          setCurrentRoute('/login');
        });
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    };
  }, [userEmail, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if ((cleanPath === '/dashboard' || cleanPath === '/admin') && !userEmail) {
      window.history.replaceState({}, '', '/login');
      setCurrentRoute('/login');
    }
  }, [authLoading, userEmail, currentRoute]);

  const handleCashfreeReturn = async (orderId: string, isGuest: boolean) => {
    if (isGuest) {
      alert(`Payment return received for guest order ${orderId}. Checking verification…`);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('cashfree-payments', {
        body: { action: 'verify-plan-order', order_id: orderId },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Verification unavailable.');
      if (data.status === 'success') {
        alert(`Payment confirmed by Cashfree. Your ${data.plan || ''} package is now active.`);
      } else if (data.status === 'pending') {
        alert('Cashfree payment is still pending. Your package will activate upon confirmation.');
      } else {
        alert('Payment was not confirmed. Your package has not been activated.');
      }
    } catch (e: any) {
      alert((e?.message || 'Could not verify payment.') + ' Your package will not activate unless verified.');
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    navigateTo('/login');
  };

  const renderContent = () => {
    const cleanPath = decodeURIComponent(currentRoute).replace(/\/+$/, '') || '/';
    if ((cleanPath === '/dashboard' || cleanPath === '/admin') && (authLoading || !userEmail)) {
      return <section className="panel center" style={{ maxWidth: 520 }}><p className="muted">Checking secure session…</p></section>;
    }
    if (cleanPath === '/demo') return <LiveDemo onBack={() => navigateTo('/')} />;
    if (cleanPath === '/login') {
      return <Login onNavigate={navigateTo} onLoginSuccess={() => navigateTo('/dashboard')} />;
    }
    if (cleanPath === '/dashboard') return <Dashboard onNavigate={navigateTo} onLogout={handleLogout} />;
    if (cleanPath === '/admin') return <AdminPanel onNavigate={navigateTo} />;
    if (cleanPath.startsWith('/store/')) {
      const slug = cleanPath.split('/')[2] || '';
      return <StoreFront slug={slug} onNavigate={navigateTo} />;
    }
    if (cleanPath !== '/' && cleanPath !== '/index.html' && !cleanPath.includes('.')) {
      const slug = cleanPath.slice(1);
      return <StoreFront slug={slug} onNavigate={navigateTo} />;
    }
    return <LandingPage onNavigate={navigateTo} />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar theme={theme} onToggleTheme={toggleTheme} currentRoute={currentRoute} onNavigate={navigateTo} userEmail={userEmail} />
      <main className="wrap" style={{ flex: 1, minHeight: '70vh' }}>{renderContent()}</main>
      <Footer />
    </div>
  );
}

export default App;
