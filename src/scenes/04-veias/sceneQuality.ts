import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useQuality, type Quality } from '../../hooks/useQuality';

export interface VeinQualityConfig {
  quality: Quality;
  reducedMotion: boolean;
  isWebGL2: boolean;
  erythrocyteCount: number;
  leukocyteCount: number;
  psilocinCount: number;
  plasmaCount: number;
  tubularSegments: number;
  radialSegments: number;
}

/**
 * Combina a detecção base `useQuality()` com:
 * - suporte real a WebGL2 (`gl.capabilities.isWebGL2` e flag de teste `?webgl2=0`)
 * - override opcional de depuração (`?quality=high|medium|low`)
 * - listener reativo para `prefers-reduced-motion`
 */
export function useVeinQualityConfig(): VeinQualityConfig {
  const { quality: detectedQuality } = useQuality();
  const gl = useThree((state) => state.gl);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const params = useMemo(() => {
    if (typeof window === 'undefined') {
      return { qualityOverride: null as Quality | null, forceNoWebGL2: false };
    }
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('quality');
    const validQ: Quality | null =
      q === 'high' || q === 'medium' || q === 'low' ? q : null;
    const forceNoWebGL2 = sp.get('webgl2') === '0' || sp.get('fallback') === '1';
    return { qualityOverride: validQ, forceNoWebGL2 };
  }, []);

  const quality: Quality = params.qualityOverride ?? detectedQuality;
  const isWebGL2 = Boolean(gl.capabilities.isWebGL2) && !params.forceNoWebGL2;

  return useMemo(() => {
    if (quality === 'low') {
      return {
        quality,
        reducedMotion,
        isWebGL2,
        erythrocyteCount: 520,
        leukocyteCount: 12,
        psilocinCount: 36,
        plasmaCount: 220,
        tubularSegments: 120,
        radialSegments: 16,
      };
    }

    if (quality === 'medium') {
      return {
        quality,
        reducedMotion,
        isWebGL2,
        erythrocyteCount: 1350,
        leukocyteCount: 26,
        psilocinCount: 72,
        plasmaCount: 480,
        tubularSegments: 180,
        radialSegments: 24,
      };
    }

    return {
      quality: 'high',
      reducedMotion,
      isWebGL2,
      erythrocyteCount: 2400,
      leukocyteCount: 44,
      psilocinCount: 112,
      plasmaCount: 860,
      tubularSegments: 250,
      radialSegments: 32,
    };
  }, [quality, reducedMotion, isWebGL2]);
}
