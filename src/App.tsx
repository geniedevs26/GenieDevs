import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { LiveDemo } from './components/LiveDemo';
import { StoreFront } from './components/StoreFront';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('geniedevs-theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname;
  });

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem('geniedevs-theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);

    // Initial auth check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    // Check payment return
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'return' && params.get('order_id')) {
      handleCashfreeReturn(params.get('order_id')!, params.get('guest') === '1');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      subscription.unsubscribe();
    };
  }, []);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    navigateTo('/');
  };

  // Route matching
  const renderContent = () => {
    const cleanPath = decodeURIComponent(currentRoute).replace(/\/+$/, '') || '/';

    if (cleanPath === '/demo') {
      return <LiveDemo onBack={() => navigateTo('/')} />;
    }

    if (cleanPath === '/login') {
      return (
        <Login
          onNavigate={navigateTo}
          onLoginSuccess={() => navigateTo('/dashboard')}
        />
      );
    }

    if (cleanPath === '/dashboard') {
      return <Dashboard onNavigate={navigateTo} onLogout={handleLogout} />;
    }

    if (cleanPath === '/admin') {
      return <AdminPanel onNavigate={navigateTo} />;
    }

    if (cleanPath.startsWith('/store/')) {
      const slug = cleanPath.split('/')[2] || '';
      return <StoreFront slug={slug} onNavigate={navigateTo} />;
    }

    // Direct store slug (e.g. /my-store) if not home or known route
    if (cleanPath !== '/' && cleanPath !== '/index.html' && !cleanPath.includes('.')) {
      const slug = cleanPath.slice(1);
      return <StoreFront slug={slug} onNavigate={navigateTo} />;
    }

    // Default: Landing Page
    return <LandingPage onNavigate={navigateTo} />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        currentRoute={currentRoute}
        onNavigate={navigateTo}
        userEmail={userEmail}
      />
      <main className="wrap" style={{ flex: 1, minHeight: '70vh' }}>
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}

export default App;
