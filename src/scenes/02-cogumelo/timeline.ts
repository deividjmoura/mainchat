/**
 * TIMELINE DO CICLO — fonte única de verdade do time-lapse.
 * Função pura do progresso: scrub reversível e determinístico.
 *
 *   0.00–0.10  micélio se adensa
 *   0.08–0.24  primórdio (nó branco)
 *   0.16–0.62  caule alonga
 *   0.42–0.72  chapéu abre, lamelas se separam
 *   0.62–0.88  esporos caem
 *   0.78–0.94  secagem (escurece, enruga)
 *   0.90–1.00  colapso (caule dobra)
 */
import { clamp01, smoothstep } from '../_shared/math';

export interface Cycle {
  network: number;
  primordium: number;
  growth: number;
  open: number;
  spores: number;
  dry: number;
  wilt: number;
  life: number;
}

export function cycleAt(p: number): Cycle {
  const t = clamp01(p);
  return {
    // sobe, satura e recua: o corpo frutífero consome recursos do micélio
    network: smoothstep(0, 0.14, t) * (1 - 0.45 * smoothstep(0.22, 0.6, t)),
    primordium: smoothstep(0.08, 0.14, t) * (1 - smoothstep(0.18, 0.24, t)),
    growth: Math.pow(smoothstep(0.16, 0.62, t), 0.78),
    open: smoothstep(0.42, 0.72, t),
    spores: smoothstep(0.62, 0.72, t) * (1 - smoothstep(0.86, 0.95, t)),
    dry: smoothstep(0.78, 0.94, t),
    wilt: smoothstep(0.9, 1, t),
    life: 1 - 0.75 * smoothstep(0.84, 1, t),
  };
}
