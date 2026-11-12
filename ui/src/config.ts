/**
 * Mock or live data. Live is the default. Set VITE_USE_MOCK_DATA=true for offline design work.
 * Live mode talks to the backend through the same-origin /api proxy (see vite.config.ts).
 */
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const API_BASE_URL = '/api/v1';
