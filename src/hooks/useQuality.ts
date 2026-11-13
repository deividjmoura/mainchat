import {useEffect,useState} from 'react';
export type Quality='high'|'medium'|'low';
export function useQuality(){
  const [quality,setQuality]=useState<Quality>('medium');
  const [webgl,setWebgl]=useState(true);
  useEffect(()=>{
    const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<760;
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??4;
    const cores=navigator.hardwareConcurrency??4;
    const canvas=document.createElement('canvas');
    const supported=!!(canvas.getContext('webgl2')||canvas.getContext('webgl'));
    setWebgl(supported);
    setQuality(reduced||mobile||memory<=4||cores<=4?'low':memory>=8&&cores>=8?'high':'medium');
  },[]);
  return {quality,webgl};
}