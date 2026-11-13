import {useEffect} from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import type {MotionValue} from 'motion';
import type {SceneDefinition} from '../scenes/types';
gsap.registerPlugin(ScrollTrigger);

export function useSceneManager({scenes,values,onSceneChange,onProgress,onReady}:{scenes:SceneDefinition[];values:Map<string,MotionValue<number>>;onSceneChange:(scene:SceneDefinition)=>void;onProgress:(id:string,value:number)=>void;onReady:(ready:boolean)=>void}) {
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis=new Lenis({duration:reduced?0:1.1,smoothWheel:!reduced,syncTouch:false});
    lenis.on('scroll',ScrollTrigger.update);
    const ticker=(time:number)=>lenis.raf(time*1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);
    const context=gsap.context(()=>{
      scenes.forEach(scene=>{
        const value=values.get(scene.id);
        if(!value) return;
        ScrollTrigger.create({
          trigger:`#section-${scene.id}`,start:'top top',end:'bottom bottom',
          scrub:reduced?false:.7,
          onEnter:()=>onSceneChange(scene),onEnterBack:()=>onSceneChange(scene),
          onUpdate:self=>{value.set(self.progress);onProgress(scene.id,self.progress)}
        });
      });
      ScrollTrigger.refresh();
    });
    onReady(true);
    return()=>{context.revert();gsap.ticker.remove(ticker);lenis.destroy()};
  },[scenes,values,onSceneChange,onProgress,onReady]);
}