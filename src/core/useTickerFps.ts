import {useEffect,useState} from 'react';
import gsap from 'gsap';

// Shares GSAP's ticker; this does not create a second animation frame loop.
export function useTickerFps() {
  const [fps,setFps]=useState(0);
  useEffect(()=>{
    let frames=0;
    let elapsed=0;
    const tick=(_time:number,delta:number)=>{
      frames++;
      elapsed+=delta;
      if(elapsed>=1000){setFps(Math.round(frames*1000/elapsed));frames=0;elapsed=0;}
    };
    gsap.ticker.add(tick);
    return ()=>gsap.ticker.remove(tick);
  },[]);
  return fps;
}