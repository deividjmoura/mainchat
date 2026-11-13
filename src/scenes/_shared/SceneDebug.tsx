/**
 * HARNESS DE DEPURAÇÃO — ativado por `?debug=1` na URL.
 * ---------------------------------------------------------------------------
 * Fica inteiramente dentro de `src/scenes/` para respeitar a regra de não
 * alterar `src/core`, `src/design` e `src/ui` (a fundação não tem `?debug=1`).
 *
 *   ?debug=1                       → painel de métricas em todas as cenas
 *   ?debug=1&cena=02-cogumelo       → rola até a cena e trava ali
 *   ?debug=1&cena=02-cogumelo&p=.42 → congela o progresso num valor exato
 *   ?debug=1&qualidade=low          → força o nível de qualidade
 *
 * O painel lê `gl.info.render` (draw calls e triângulos reais do frame) e
 * `performance.getEntriesByType('resource')` (MB transferidos pela cena).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { MotionValue } from 'motion';

export interface DebugConfig {
  enabled: boolean;
  scene?: string;
  progress?: number;
  quality?: 'high' | 'medium' | 'low';
}

export function readDebugConfig(): DebugConfig {
  if (typeof window === 'undefined') return { enabled: false };
  const q = new URLSearchParams(window.location.search);
  if (q.get('debug') !== '1') return { enabled: false };
  const p = q.get('p');
  const qual = q.get('qualidade');
  return {
    enabled: true,
    scene: q.get('cena') ?? undefined,
    progress: p !== null && !Number.isNaN(parseFloat(p)) ? Math.min(1, Math.max(0, parseFloat(p))) : undefined,
    quality: qual === 'high' || qual === 'medium' || qual === 'low' ? qual : undefined,
  };
}

/**
 * Salto para a cena pedida acontece no BOOT do módulo, não no componente.
 * Motivo: o App monta apenas a cena ativa; um hook dentro da cena nunca
 * rodaria para a cena que ainda não está ativa (ovo e galinha). Como este
 * módulo é importado pelas três cenas, o efeito roda uma única vez no
 * carregamento, antes de qualquer montagem.
 */
function bootJumpToScene() {
  if (typeof window === 'undefined') return;
  const config = readDebugConfig();
  if (!config.enabled || !config.scene) return;
  const id = config.scene;
  let tries = 0;
  const jump = () => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      // offsetTop direto: scrollIntoView dispara o Lenis e pode ser cancelado
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: 'auto' });
      // reafirma por alguns frames: o Lenis recria a posição no primeiro tick
      let n = 0;
      const settle = window.setInterval(() => {
        window.scrollTo({ top, behavior: 'auto' });
        if (++n > 12) window.clearInterval(settle);
      }, 16);
      // Um deslocamento mínimo DEPOIS de assentar força o ScrollTrigger a
      // reavaliar: chegar direto dentro de uma seção não dispara `onEnter`,
      // então a cena ativa ficaria na anterior (limitação da fundação — ver
      // docs/REQUESTS-agente2.md).
      // +160 px mantém o topo da seção acima da dobra (sem "estalo" visível)
      // e força o ScrollTrigger a recalcular a cena ativa.
      window.setTimeout(() => {
        window.scrollTo({ top: top + 160, behavior: 'auto' });
      }, 320);
      return;
    }
    if (++tries < 60) window.setTimeout(jump, 50);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(jump, 120), { once: true });
  } else {
    window.setTimeout(jump, 120);
  }
}

bootJumpToScene();

/** Congela o progresso da cena ativa (usado depois que o salto a ativa) */
export function useDebugScroll(sceneId: string, config: DebugConfig, progress: MotionValue<number>) {
  const done = useRef(false);
  useEffect(() => {
    if (!config.enabled || done.current) return;
    // congela apenas a cena pedida; sem `cena=`, congela a primeira que montar
    if (config.scene && config.scene !== sceneId) return;
    if (config.progress === undefined) return;
    done.current = true;
    const target = config.progress;
    // o ScrollTrigger escreve no MotionValue a cada scroll; reaplicamos o valor
    // alvo até o scroll parar, senão a primeira sincronização o sobrescreve
    let n = 0;
    const id = window.setInterval(() => {
      progress.set(target);
      if (++n > 90) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [config, sceneId, progress]);
}

interface Stats {
  fps: number;
  worst: number;
  calls: number;
  tris: number;
  mb: number;
}

/** Coleta as métricas dentro do canvas e as publica em um <div> fixo */
export function SceneTelemetry({ sceneId }: { sceneId: string }) {
  const { gl } = useThree();
  const [stats, setStats] = useState<Stats>({ fps: 0, worst: 0, calls: 0, tris: 0, mb: 0 });
  const samples = useRef<number[]>([]);
  const last = useRef(0);
  const acc = useRef(0);

  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    if (dt > 0 && dt < 500) {
      samples.current.push(1000 / dt);
      if (samples.current.length > 240) samples.current.shift();
    }
    acc.current += dt;
    // publicar a cada 400 ms: setState a 60 Hz derrubaria o próprio FPS
    if (acc.current < 400) return;
    acc.current = 0;

    const s = samples.current;
    const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
    const sorted = [...s].sort((a, b) => a - b);
    const worst = sorted[Math.floor(sorted.length * 0.01)] ?? 0;
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const mb =
      entries
        .filter((e) => e.name.includes(`/assets/${sceneId}/`))
        .reduce((sum, e) => sum + (e.transferSize || e.encodedBodySize || 0), 0) /
      (1024 * 1024);

    setStats({
      fps: avg,
      worst,
      calls: gl.info.render.calls,
      tris: gl.info.render.triangles,
      mb,
    });
  });

  return <TelemetryPanel sceneId={sceneId} stats={stats} />;
}

function TelemetryPanel({ sceneId, stats }: { sceneId: string; stats: Stats }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.id = 'scene-debug';
    el.style.cssText = [
      'position:fixed', 'left:12px', 'bottom:12px', 'z-index:9999',
      'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#efe6d6', 'background:rgba(10,8,6,.86)', 'padding:8px 10px',
      'border:1px solid rgba(217,180,130,.28)', 'border-radius:6px',
      'pointer-events:none', 'white-space:pre', 'letter-spacing:.02em',
    ].join(';');
    document.body.appendChild(el);
    setHost(el);
    return () => el.remove();
  }, []);

  useEffect(() => {
    if (!host) return;
    host.textContent =
      `cena   ${sceneId}\n` +
      `fps    ${stats.fps.toFixed(0)}  (pior 1%: ${stats.worst.toFixed(0)})\n` +
      `draw   ${stats.calls} calls · ${(stats.tris / 1000).toFixed(1)}k tris\n` +
      `rede   ${stats.mb.toFixed(2)} MB (assets da cena)`;
  }, [host, sceneId, stats]);

  return null;
}

/** Hook que cada cena usa para montar o harness quando `?debug=1` */
export function useSceneDebug(sceneId: string, progress: MotionValue<number>) {
  const config = useMemo(() => readDebugConfig(), []);
  useDebugScroll(sceneId, config, progress);
  return config;
}
