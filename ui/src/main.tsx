import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/finalPolish.css';

// After a rebuild, an open tab still points at old chunk names (for example SchemaExplorer-xxxx.js) that no longer exist.
// Reload once to pick up the new build instead of showing a router error.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem('chunk-reload') !== '1') { sessionStorage.setItem('chunk-reload', '1'); window.location.reload(); }
  } catch { window.location.reload(); }
});
window.addEventListener('load', () => { try { setTimeout(() => sessionStorage.removeItem('chunk-reload'), 5000); } catch { /* storage blocked */ } });

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '20vh auto', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22 }}>Something went wrong loading this page</h1>
        <p style={{ color: '#5b6b7f' }}>The app was probably updated while this tab was open. Nothing was changed.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: 999, border: 0, background: '#ffc439', fontWeight: 600, cursor: 'pointer' }}>Reload</button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
