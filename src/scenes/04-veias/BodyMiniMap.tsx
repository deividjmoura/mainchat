import { useEffect, useMemo, useRef, useState } from 'react';
import type { MotionValue } from 'motion';
import { getActiveVascularStation, VASCULAR_STATIONS } from './splineData';
import { typography } from '../../design/tokens';
import type { Quality } from '../../hooks/useQuality';
import { useDomOverlay } from './useSceneResources';

interface BodyMiniMapProps {
  progress: MotionValue<number>;
  isActive: boolean;
  isWebGL2: boolean;
  quality: Quality;
}

const ROUTE_SVG_PATH =
  'M 53 156 C 49 148, 41 140, 41 130 C 41 118, 49 109, 52 98 C 55 86, 55 74, 54 62 C 53 48, 51 37, 50 26';

/**
 * Renderiza fora do reconciler Three.js do R3F diretamente em `document.body` via `useDomOverlay`
 * (sem tocar em `src/ui` ou `src/styles.css` e sem criar loops `requestAnimationFrame` próprios):
 * 1. A mini-silhueta anatômica do corpo no canto superior esquerdo.
 * 2. Fallback estático/scrubbed (`/assets/04-veias/fallback-veins.svg`) caso WebGL2 não esteja ativo.
 */
export function BodyMiniMap({ progress, isActive, isWebGL2, quality }: BodyMiniMapProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const progressStrokeRef = useRef<SVGPathElement | null>(null);
  const markerRef = useRef<SVGGElement | null>(null);
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const [station, setStation] = useState(() => getActiveVascularStation(progress.get()));

  const isDebug =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (!isActive) return;

    const applyProgress = (rawP: number) => {
      const p = Math.min(1, Math.max(0, rawP));
      const pathEl = pathRef.current;
      if (pathEl && typeof pathEl.getTotalLength === 'function') {
        const len = pathEl.getTotalLength();
        const pt = pathEl.getPointAtLength(len * p);
        if (markerRef.current) {
          markerRef.current.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
        }
        if (progressStrokeRef.current) {
          progressStrokeRef.current.style.strokeDasharray = `${len}`;
          progressStrokeRef.current.style.strokeDashoffset = `${len * (1 - p)}`;
        }
      }
      if (pctRef.current) {
        pctRef.current.textContent = `${Math.round(p * 100)}%`;
      }
      const nextStation = getActiveVascularStation(p);
      setStation((prev) => (prev.id === nextStation.id ? prev : nextStation));
    };

    applyProgress(progress.get());
    return progress.on('change', applyProgress);
  }, [progress, isActive]);

  const overlayContent = useMemo(
    () => (
      <>
        {!isWebGL2 && (
          <div
            role="img"
            aria-label="Fallback visual da circulação sanguínea sem WebGL2"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1,
              pointerEvents: 'none',
              background: '#16070b',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img
              src="/assets/04-veias/fallback-veins.svg"
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
            />
          </div>
        )}

        <aside
          aria-label="Posição anatômica atual no sistema circulatório"
          style={{
            position: 'fixed',
            top: '74px',
            left: '5vw',
            zIndex: 7,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px 10px 10px',
            borderRadius: '12px',
            background: 'rgba(12, 8, 14, 0.72)',
            border: '1px solid rgba(215, 200, 183, 0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
            fontFamily: typography.body,
            color: '#f4eee5',
            maxWidth: '285px',
          }}
        >
          <svg
            viewBox="0 0 100 195"
            style={{ width: '52px', height: '102px', flexShrink: 0, overflow: 'visible' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="veinRouteGrad04" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="32%" stopColor="#34d399" />
                <stop offset="60%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#67e8f9" />
              </linearGradient>
            </defs>

            <path
              d="M 50 8 C 61 8, 66 17, 65 29 C 64 38, 60 44, 57 49 L 57 59 C 68 63, 82 69, 85 83 L 88 145 C 88 156, 80 162, 74 162 L 72 184 L 28 184 L 26 162 C 20 162, 12 156, 12 145 L 15 83 C 18 69, 32 63, 43 59 L 43 49 C 40 44, 36 38, 35 29 C 34 17, 39 8, 50 8 Z"
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(215,200,183,0.25)"
              strokeWidth="1.2"
            />
            <ellipse
              cx="50"
              cy="23"
              rx="10.5"
              ry="8.5"
              fill="rgba(103,232,249,0.12)"
              stroke="rgba(103,232,249,0.35)"
              strokeWidth="0.8"
            />
            <circle
              cx="52"
              cy="98"
              r="6"
              fill="rgba(251,113,133,0.16)"
              stroke="rgba(251,113,133,0.4)"
              strokeWidth="0.8"
            />
            <path
              d="M 32 126 C 32 120, 44 120, 49 126 C 47 133, 36 136, 32 132 Z"
              fill="rgba(52,211,153,0.14)"
              stroke="rgba(52,211,153,0.35)"
              strokeWidth="0.8"
            />
            <ellipse
              cx="55"
              cy="154"
              rx="8"
              ry="5.5"
              fill="rgba(167,139,250,0.14)"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="0.8"
            />

            <path
              ref={pathRef}
              d={ROUTE_SVG_PATH}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <path
              ref={progressStrokeRef}
              d={ROUTE_SVG_PATH}
              fill="none"
              stroke="url(#veinRouteGrad04)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {VASCULAR_STATIONS.map((st) => (
              <circle
                key={st.id}
                cx={st.mapCoord[0]}
                cy={st.mapCoord[1]}
                r={station.id === st.id ? 2.6 : 1.6}
                fill={station.id === st.id ? st.accent : 'rgba(255,255,255,0.35)'}
              />
            ))}

            <g ref={markerRef} transform="translate(53, 156)">
              <circle r="5.8" fill={station.accent} opacity="0.28" />
              <circle r="3.1" fill="#ffffff" stroke={station.accent} strokeWidth="1.6" />
            </g>
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '9px',
                letterSpacing: '0.16em',
                color: '#d0a77d',
              }}
            >
              <span>TRAJETO VASCULAR</span>
              <span ref={pctRef} style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                0%
              </span>
            </div>
            <strong style={{ fontSize: '13px', color: station.accent, fontWeight: 600 }}>
              {station.organ}
            </strong>
            <span style={{ fontSize: '11px', color: 'rgba(244,238,229,0.78)', lineHeight: 1.35 }}>
              {station.subtitle}
            </span>
            {isDebug && (
              <span
                style={{
                  fontSize: '9px',
                  color: '#94a3b8',
                  marginTop: '2px',
                  letterSpacing: '0.06em',
                }}
              >
                ASSET: 0.25 MB • TIER: {quality.toUpperCase()} • {isWebGL2 ? 'WEBGL2' : 'FALLBACK'}
              </span>
            )}
          </div>
        </aside>
      </>
    ),
    [isWebGL2, station, isDebug, quality]
  );

  useDomOverlay(isActive, overlayContent);
  return null;
}
