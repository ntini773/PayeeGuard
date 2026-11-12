import React, { createContext, useContext, useEffect, useState } from 'react';

interface MotionContextValue {
  reducedMotion: boolean;
  systemReducedMotion: boolean;
  toggleReducedMotion: () => void;
}

const MotionContext = createContext<MotionContextValue>({
  reducedMotion: false,
  systemReducedMotion: false,
  toggleReducedMotion: () => {},
});

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<boolean>(() => {
    try { return localStorage.getItem('payeeguard_reduced_motion') === 'true'; }
    catch { return false; }
  });
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const reducedMotion = preference || systemReducedMotion;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
  }, [reducedMotion]);

  useEffect(() => {
    try { localStorage.setItem('payeeguard_reduced_motion', String(preference)); }
    catch { /* Animation preferences remain usable without persistent storage. */ }
  }, [preference]);

  const toggleReducedMotion = () => {
    if (!systemReducedMotion) setPreference((prev) => !prev);
  };

  return (
    <MotionContext.Provider value={{ reducedMotion, systemReducedMotion, toggleReducedMotion }}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotion() {
  return useContext(MotionContext);
}
