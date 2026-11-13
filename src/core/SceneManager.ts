import {useEffect} from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import type {MotionValue} from 'motion';
import type {SceneDefinition} from '../scenes/types';

gsap.registerPlugin(ScrollTrigger);

type SceneManagerOptions = {
  scenes: SceneDefinition[];
  values: Map<string, MotionValue<number>>;
  onSceneChange: (scene: SceneDefinition) => void;
  onProgress: (id: string, value: number) => void;
  onReady: (ready: boolean) => void;
};

export function useSceneManager({scenes, values, onSceneChange, onProgress, onReady}: SceneManagerOptions) {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = new Lenis({duration: reducedMotion ? 0 : 1.1, smoothWheel: !reducedMotion, syncTouch: false});
    lenis.on('scroll', ScrollTrigger.update);

    // Lenis is advanced by GSAP's ticker: do not start a second RAF loop.
    const ticker = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    const context = gsap.context(() => {
      scenes.forEach(scene => {
        const value = values.get(scene.id);
        if (!value) return;
        ScrollTrigger.create({
          id: `scene-${scene.id}`,
          trigger: `#section-${scene.id}`,
          start: 'top top',
          end: 'bottom bottom',
          scrub: reducedMotion ? false : 0.65,
          onEnter: () => { onSceneChange(scene); value.set(0); onProgress(scene.id, 0); },
          onEnterBack: () => onSceneChange(scene),
          onUpdate: self => {
            value.set(self.progress);
            onProgress(scene.id, self.progress);
          },
          onRefresh: self => {
            if (self.isActive) onProgress(scene.id, self.progress);
          }
        });
      });
      ScrollTrigger.refresh();
    });

    onReady(true);
    return () => {
      context.revert();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.vars.id?.toString().startsWith('scene-')) trigger.kill();
      });
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, [scenes, values, onSceneChange, onProgress, onReady]);
}