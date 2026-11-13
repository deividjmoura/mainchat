import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useQuality, type Quality } from '../../hooks/useQuality';

export interface BrainQualityConfig {
  quality: Quality;
  reducedMotion: boolean;
  isWebGL2: boolean;
  connectomeArcCount: number;
  ambientParticleCount: number;
}

export function useBrainQualityConfig(): BrainQualityConfig {
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
        connectomeArcCount: 20,
        ambientParticleCount: 90,
      };
    }
    if (quality === 'medium') {
      return {
        quality,
        reducedMotion,
        isWebGL2,
        connectomeArcCount: 36,
        ambientParticleCount: 180,
      };
    }
    return {
      quality: 'high',
      reducedMotion,
      isWebGL2,
      connectomeArcCount: 56,
      ambientParticleCount: 280,
    };
  }, [quality, reducedMotion, isWebGL2]);
}
