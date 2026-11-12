// Router navigation and intent preloading share the same imports. A failed
// speculative preload is ignored so a later navigation can retry normally.
export const pages = {
  '/': () => import('../components/landing/LandingPage').then(m => ({ Component: m.LandingPage })),
  '/seller': () => import('../components/seller/SellerPage').then(m => ({ Component: m.SellerPage })),
  '/console': () => import('../components/console/OperatorConsole').then(m => ({ Component: m.OperatorConsole })),
  '/how-it-works': () => import('../components/flow/HowItWorksPage').then(m => ({ Component: m.HowItWorksPage })),
  '/schema': () => import('../components/schema/SchemaExplorer').then(m => ({ Component: m.SchemaExplorer })),
};

export function preloadPage(path: string) {
  if (Object.prototype.hasOwnProperty.call(pages, path)) void pages[path as keyof typeof pages]().catch(() => {});
}
