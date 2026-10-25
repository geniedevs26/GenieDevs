import React from 'react';

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentRoute: string;
  onNavigate: (route: string) => void;
  userEmail?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  onToggleTheme,
  currentRoute,
  onNavigate,
  userEmail,
}) => {
  return (
    <header className="wrap">
      <nav className="nav">
        <a
          className="logo"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
        >
          Genie<span>Devs</span>
        </a>

        <div className="navlinks">
          <a
            className="hide-sm"
            href="/#features"
            onClick={(e) => {
              if (currentRoute !== '/') {
                e.preventDefault();
                onNavigate('/');
                setTimeout(() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
          >
            Features
          </a>
          <a
            className="hide-sm"
            href="/#pricing"
            onClick={(e) => {
              if (currentRoute !== '/') {
                e.preventDefault();
                onNavigate('/');
                setTimeout(() => {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
          >
            Pricing
          </a>
          <a
            href="/demo"
            style={{ fontWeight: currentRoute === '/demo' ? 'bold' : 'normal' }}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/demo');
            }}
          >
            Live demo
          </a>
          <a
            href="/#support"
            onClick={(e) => {
              if (currentRoute !== '/') {
                e.preventDefault();
                onNavigate('/');
                setTimeout(() => {
                  document.getElementById('support')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
          >
            Support
          </a>

          {userEmail ? (
            <button
              className="btn outline"
              onClick={() => onNavigate('/dashboard')}
              style={{ fontSize: '0.85rem' }}
            >
              Dashboard
            </button>
          ) : (
            <button
              className="btn outline"
              onClick={() => onNavigate('/login')}
              style={{ fontSize: '0.85rem' }}
            >
              Store Login
            </button>
          )}

          <button
            id="themeToggle"
            className="btn outline"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </nav>
    </header>
  );
};
