import {scenes} from '../scenes/stubs';

export type TransitionMode = 'crossfade' | 'dissolve' | 'fade-through-black';
export type TransitionState = {mode: TransitionMode; opacity: number} | null;

// Configure each adjacent pair independently. The cut is masked at both ends
// of a scene so the scene switch happens under the transition layer.
export const sceneTransitions: Record<string, TransitionMode> = {
  '01-terra->02-cogumelo': 'dissolve',
  '02-cogumelo->03-limiar': 'fade-through-black',
  '03-limiar->04-circulacao': 'crossfade',
  '04-circulacao->05-cerebro': 'dissolve'
};

export function getTransitionState(sceneId: string, progress: number): TransitionState {
  const index = scenes.findIndex(scene => scene.id === sceneId);
  const edge = 0.09;
  if (index > 0 && progress < edge) {
    const key = `${scenes[index - 1].id}->${sceneId}`;
    return {mode: sceneTransitions[key] ?? 'fade-through-black', opacity: 1 - progress / edge};
  }
  if (index >= 0 && index < scenes.length - 1 && progress > 1 - edge) {
    const key = `${sceneId}->${scenes[index + 1].id}`;
    return {mode: sceneTransitions[key] ?? 'fade-through-black', opacity: (progress - (1 - edge)) / edge};
  }
  return null;
}