import { Link, useNavigate, type LinkProps } from 'react-router-dom';
import { useMotion } from '../context/MotionContext';
import { preloadPage } from './pages';

export function RouteLink({ onPointerEnter, onFocus, onClick, ...props }: LinkProps) {
  const { reducedMotion } = useMotion();
  const navigate = useNavigate();
  const preload = () => preloadPage(typeof props.to === 'string' ? props.to.split(/[?#]/)[0] : props.to.pathname ?? '');
  return <Link {...props} viewTransition={!reducedMotion}
    onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        props.reloadDocument || (props.target && props.target !== '_self') || event.currentTarget.hasAttribute('download')) return;
      const destination = new URL(event.currentTarget.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      // Commit the ready route synchronously inside the native transition. This
      // avoids an unresolved concurrent render when another menu click interrupts.
      void navigate(destination.pathname + destination.search + destination.hash, {
        state: props.state,
        replace: props.replace ?? destination.href === window.location.href,
        preventScrollReset: props.preventScrollReset,
        viewTransition: !reducedMotion,
        flushSync: true,
      });
    }}
    onPointerEnter={event => { preload(); onPointerEnter?.(event); }}
    onFocus={event => { preload(); onFocus?.(event); }} />;
}
