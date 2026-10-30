import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="wrap footer">
      <div>
        <span>© {new Date().getFullYear()} GenieDevs</span>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Legal name: DANNINA SIVA SATYA PRASAD
        </p>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Email: <a href="mailto:geniedevs52@gmail.com">geniedevs52@gmail.com</a>
          {' · '}
          Phone: <a href="tel:+919494865060">+91 9494865060</a>
        </p>
      </div>
      <span>
        Built for small businesses ·{' '}
        <a href="https://formspree.io/f/xkjoakoe" target="_blank" rel="noopener noreferrer">
          Support
        </a>
      </span>
    </footer>
  );
};
