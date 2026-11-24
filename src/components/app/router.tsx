'use client';

import { useEffect, useRef, useState } from 'react';

export interface HashRoute {
  path: string;
  query: URLSearchParams;
}

function parseHash(): HashRoute {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p || '/', query: new URLSearchParams(q) };
}

/** Hook routing berbasis hash — semua halaman dilayani dari route "/" */
export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>({ path: '/', query: new URLSearchParams() });
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    const update = () => {
      const r = parseHash();
      setRoute(r);
      if (prevPath.current !== r.path) {
        prevPath.current = r.path;
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return route;
}

export function navigate(to: string) {
  const target = '#' + (to.startsWith('/') ? to : '/' + to);
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = target;
}
