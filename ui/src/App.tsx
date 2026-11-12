import { useLayoutEffect, useRef } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation, useNavigation } from 'react-router-dom';
import { MotionProvider } from './context/MotionContext';
import { MockDataBanner } from './components/common/MockDataBanner';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

import { pages } from './routing/pages';

function InitialLoading() {
  return <div className="route-loading route-loading-public" role="status">Preparing your view…</div>;
}

function RouteScrollReset() {
  const { pathname, hash, key } = useLocation();
  const previousNavigation = useRef(key);
  useLayoutEffect(() => {
    document.documentElement.dataset.workspace = pathname.startsWith('/console') ? 'operator' : pathname.startsWith('/seller') ? 'seller' : 'public';
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (previousNavigation.current !== key) document.getElementById('main-content')?.focus({ preventScroll: true });
    }
    previousNavigation.current = key;
  }, [pathname, hash, key]);
  return null;
}

function AppLayout() {
  const navigation = useNavigation();
  return (
    <>
      <RouteScrollReset />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <MockDataBanner />
      <Header />
      {navigation.state !== 'idle' && (
        <div className="navigation-progress" role="status" aria-label="Loading page" />
      )}
      <main id="main-content" tabIndex={-1} style={{ minHeight: 'calc(100vh - 180px)', display: 'flow-root' }}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

// Data-router lazy routes retain the outgoing page while the next module loads.
// The shared shell stays mounted; no delayed exit animation can retain old forms.
function RouteError() {
  return (
    <div role="alert" style={{ maxWidth: 520, margin: '20vh auto', padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>This page could not load</h1>
      <p style={{ color: '#5b6b7f' }}>The app may have been updated while this tab was open. Nothing was changed.</p>
      <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: 999, border: 0, background: '#ffc439', fontWeight: 600, cursor: 'pointer' }}>Reload</button>
    </div>
  );
}

const router = createBrowserRouter([{
  Component: AppLayout,
  ErrorBoundary: RouteError,
  HydrateFallback: InitialLoading,
  children: [
    ...Object.entries(pages).map(([path, lazy]) => ({ path, lazy })),
    { path: '*', element: <Navigate to="/" replace /> },
  ],
}]);

export function App() {
  return <MotionProvider><RouterProvider router={router} /></MotionProvider>;
}

export default App;
