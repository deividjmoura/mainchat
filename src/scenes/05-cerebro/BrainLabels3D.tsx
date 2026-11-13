import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { MICRO_ANCHOR, mniToBrainSpace, rangeWeight } from './cameraKeyframes';
import { typography } from '../../design/tokens';
import type { Quality } from '../../hooks/useQuality';
import { useDomOverlay, useManagedDisposable } from './useSceneResources';

interface LabelSpec {
  id: string;
  position: [number, number, number];
  start: number;
  end: number;
  title: string;
  subtitle: string;
  badge: 'CONSENSO' | 'HIPÓTESE';
  accent: string;
  direction: 'left' | 'right';
}

interface BrainLabels3DProps {
  isActive: boolean;
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  isWebGL2: boolean;
  glbLoaded: boolean;
  quality: Quality;
}

export function BrainLabels3D({
  isActive,
  isActiveRef,
  progressRef,
  isWebGL2,
  glbLoaded,
  quality,
}: BrainLabels3DProps) {
  const isDebug =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  const labels = useMemo<LabelSpec[]>(
    () => [
      {
        id: 'sulci',
        position: mniToBrainSpace(-42, -12, 42),
        start: 0.09,
        end: 0.23,
        title: 'Sulcos Corticais',
        subtitle: 'Ondas de atividade em áreas associativas',
        badge: 'CONSENSO',
        accent: '#38bdf8',
        direction: 'right',
      },
      {
        id: 'pfc',
        position: mniToBrainSpace(-32, 44, 20),
        start: 0.26,
        end: 0.36,
        title: 'Córtex Pré-Frontal (PFC)',
        subtitle: 'Alta densidade de receptores 5-HT2A (Camada V)',
        badge: 'CONSENSO',
        accent: '#38bdf8',
        direction: 'right',
      },
      {
        id: 'thalamus',
        position: mniToBrainSpace(0, -19, 6),
        start: 0.37,
        end: 0.47,
        title: 'Tálamo',
        subtitle: 'Redução do filtro sensorial tálamo-cortical (CSTC)',
        badge: 'HIPÓTESE',
        accent: '#fbbf24',
        direction: 'right',
      },
      {
        id: 'dmn-mpfc',
        position: mniToBrainSpace(0, 52, 10),
        start: 0.48,
        end: 0.57,
        title: 'mPFC · Rede de Modo Padrão',
        subtitle: 'Hub anterior autorreferencial',
        badge: 'CONSENSO',
        accent: '#c084fc',
        direction: 'left',
      },
      {
        id: 'dmn-pcc',
        position: mniToBrainSpace(0, -54, 30),
        start: 0.48,
        end: 0.57,
        title: 'PCC / Precuneus · DMN',
        subtitle: 'Desincronização aguda observada em fMRI',
        badge: 'CONSENSO',
        accent: '#e879f9',
        direction: 'right',
      },
      {
        id: 'psilocin',
        position: [MICRO_ANCHOR[0] + 0.018, MICRO_ANCHOR[1] + 0.038, MICRO_ANCHOR[2] + 0.018],
        start: 0.60,
        end: 0.70,
        title: 'Psilocina (4-HO-DMT)',
        subtitle: 'Agonista parcial no sítio ortostérico',
        badge: 'CONSENSO',
        accent: '#2dd4bf',
        direction: 'left',
      },
      {
        id: '5ht2a',
        position: [MICRO_ANCHOR[0] + 0.018, MICRO_ANCHOR[1] + 0.018, MICRO_ANCHOR[2] + 0.018],
        start: 0.65,
        end: 0.78,
        title: 'Receptor 5-HT2A (GPCR)',
        subtitle: 'Disparo Gq/11 e ondas dendríticas',
        badge: 'CONSENSO',
        accent: '#5eead4',
        direction: 'right',
      },
      {
        id: 'connectome',
        position: mniToBrainSpace(-28, -32, 48),
        start: 0.84,
        end: 0.99,
        title: 'Conectividade Inter-Redes',
        subtitle: 'Comunicação transitória ampliada entre sistemas',
        badge: 'CONSENSO',
        accent: '#e879f9',
        direction: 'right',
      },
    ],
    []
  );

  const dotBundle = useManagedDisposable(
    () => ({
      geo: new THREE.SphereGeometry(0.014, 10, 10),
      mats: labels.map((l) => new THREE.MeshBasicMaterial({ color: l.accent, toneMapped: false })),
    }),
    (res) => {
      res.geo.dispose();
      for (const m of res.mats) m.dispose();
    },
    [labels]
  );

  const domRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dotRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(() => {
    if (!isActiveRef.current) return;
    const p = progressRef.current;
    for (let i = 0; i < labels.length; i++) {
      const spec = labels[i];
      const w = rangeWeight(p, spec.start, spec.end, 0.025, 0.025);
      const el = domRefs.current[i];
      if (el) {
        el.style.opacity = w.toFixed(3);
        el.style.visibility = w > 0.01 ? 'visible' : 'hidden';
        el.style.transform = `translate3d(0, ${((1 - w) * 8).toFixed(1)}px, 0)`;
      }
      const dot = dotRefs.current[i];
      if (dot) {
        dot.visible = w > 0.01;
        dot.scale.setScalar(0.6 + w * 0.55);
      }
    }
  });

  const overlayNode = useMemo(
    () => (
      <>
        {!isWebGL2 && (
          <div
            role="img"
            aria-label="Fallback visual do cérebro sem WebGL2"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1,
              pointerEvents: 'none',
              background: '#10101f',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img
              src="/assets/05-cerebro/fallback-brain.svg"
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }}
            />
          </div>
        )}

        {isDebug && (
          <div
            style={{
              position: 'fixed',
              top: '74px',
              left: '5vw',
              zIndex: 7,
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(10, 11, 24, 0.76)',
              border: '1px solid rgba(155, 141, 224, 0.35)',
              backdropFilter: 'blur(10px)',
              fontFamily: typography.body,
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: '#e2e8f0',
              pointerEvents: 'none',
            }}
          >
            GLB MNI152 (MESHOPT):{' '}
            <strong style={{ color: glbLoaded ? '#5eead4' : '#fcd34d' }}>
              {glbLoaded ? '0.69 MB LOADED' : 'FALLBACK PROCEDURAL'}
            </strong>{' '}
            • TIER: <strong>{quality.toUpperCase()}</strong> •{' '}
            <strong>{isWebGL2 ? 'WEBGL2' : 'FALLBACK'}</strong>
          </div>
        )}
      </>
    ),
    [isWebGL2, isDebug, glbLoaded, quality]
  );

  useDomOverlay(isActive && (!isWebGL2 || isDebug), overlayNode);

  if (!isActive || !isWebGL2 || !dotBundle) return null;

  return (
    <>
      {labels.map((lbl, idx) => {
        const isRight = lbl.direction === 'right';
        return (
          <group key={lbl.id} position={lbl.position}>
            <mesh
              ref={(el) => {
                dotRefs.current[idx] = el;
              }}
              args={[dotBundle.geo, dotBundle.mats[idx]]}
            />

            <Html center={false} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div
                ref={(el) => {
                  domRefs.current[idx] = el;
                }}
                style={{
                  display: 'flex',
                  flexDirection: isRight ? 'row' : 'row-reverse',
                  alignItems: 'flex-start',
                  marginLeft: isRight ? '-3px' : '-258px',
                  marginTop: '-24px',
                  opacity: 0,
                  visibility: 'hidden',
                  fontFamily: typography.body,
                }}
              >
                <svg width="52" height="28" viewBox="0 0 52 28" style={{ flexShrink: 0 }} aria-hidden="true">
                  {isRight ? (
                    <>
                      <circle cx="3" cy="24" r="2.8" fill={lbl.accent} />
                      <polyline points="3,24 19,6 50,6" fill="none" stroke={lbl.accent} strokeWidth="1.25" />
                    </>
                  ) : (
                    <>
                      <circle cx="49" cy="24" r="2.8" fill={lbl.accent} />
                      <polyline points="49,24 33,6 2,6" fill="none" stroke={lbl.accent} strokeWidth="1.25" />
                    </>
                  )}
                </svg>

                <div
                  style={{
                    width: '206px',
                    padding: '8px 11px',
                    borderRadius: '10px',
                    background: 'rgba(8, 10, 22, 0.82)',
                    border: `1px solid ${lbl.accent}55`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 26px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '8.5px',
                      letterSpacing: '0.12em',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      marginBottom: '4px',
                      color: lbl.badge === 'CONSENSO' ? '#5eead4' : '#fcd34d',
                      border: `1px solid ${
                        lbl.badge === 'CONSENSO' ? 'rgba(94,234,212,0.35)' : 'rgba(252,211,77,0.35)'
                      }`,
                    }}
                  >
                    {lbl.badge}
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: lbl.accent, marginBottom: '2px' }}>
                    {lbl.title}
                  </div>
                  <div style={{ fontSize: '10.5px', lineHeight: 1.35, color: 'rgba(244,238,229,0.82)' }}>
                    {lbl.subtitle}
                  </div>
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
