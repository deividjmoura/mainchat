/**
 * TIMELINE DA CENA 03 — a narrativa em quatro batidas.
 * Nada aqui é instrucional: a cena não mostra preparo, dose ou método. Ela
 * apenas acompanha um gesto humano e fecha para dentro.
 */
import { clamp01, smoothstep } from '../_shared/math';

export interface Gesture {
  /** entrada da mão vinda da borda inferior do quadro */
  enter: number;
  /** pinça: dedos fecham em torno do cogumelo */
  pinch: number;
  /** o cogumelo sai do solo */
  lift: number;
  /** a mão e o objeto sobem em direção ao rosto/câmera */
  raise: number;
  /** perda de foco: o mundo se dissolve antes de qualquer ação */
  dissolve: number;
  /** escurecimento final, fechando "para dentro" */
  close: number;
  /** respiração/hesitação — o gesto não é mecânico */
  hold: number;
}

export function gestureAt(p: number): Gesture {
  const t = clamp01(p);
  return {
    enter: smoothstep(0, 0.2, t),
    pinch: smoothstep(0.2, 0.34, t),
    lift: smoothstep(0.34, 0.56, t),
    raise: smoothstep(0.5, 0.78, t),
    dissolve: smoothstep(0.58, 0.82, t),
    // hesitação: sobe, para, e só então a imagem fecha
    hold: smoothstep(0.68, 0.76, t) * (1 - smoothstep(0.82, 0.92, t)),
    close: smoothstep(0.78, 1, t),
  };
}
