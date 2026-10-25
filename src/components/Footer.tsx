import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="wrap footer">
      <span>© {new Date().getFullYear()} GenieDevs</span>
      <span>
        Built for small businesses ·{' '}
        <a href="https://formspree.io/f/xkjoakoe" target="_blank" rel="noopener noreferrer">
          Support
        </a>
      </span>
    </footer>
  );
};
