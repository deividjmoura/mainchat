import { useEffect, useState } from 'react';

/**
 * `prefers-reduced-motion` como estado reativo — o hook da fundação
 * (`useQuality`) dobra movimento reduzido em qualidade baixa, mas as cenas
 * também precisam REDUZIR A AMPLITUDE (não só o DPR): sem isso, o scroll
 * continua empurrando a câmera por um trajeto longo.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
