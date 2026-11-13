import {Suspense,useMemo,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {EffectComposer,Bloom,Noise,Vignette} from '@react-three/postprocessing';
import {motionValue} from 'motion';
import {scenes} from './scenes/stubs';
import {useJourneyStore} from './store/useJourneyStore';
import {useQuality} from './hooks/useQuality';
import NarrativeText from './components/NarrativeText';
import ProgressRail from './components/ProgressRail';
import StaticFallback from './components/StaticFallback';
import DebugPanel from './ui/DebugPanel';
import {palette} from './design/tokens';
import {useSceneManager} from './core/SceneManager';
import {getTransitionState} from './core/transitions';
import {useTickerFps} from './core/useTickerFps';

export default function App(){
  const {quality,webgl}=useQuality();
  const [active,setActive]=useState(scenes[0]);
  const [ready,setReady]=useState(false);
  const [debug]=useState(()=>new URLSearchParams(window.location.search).get('debug')==='1');
  const [values]=useState(()=>new Map(scenes.map(scene=>[scene.id,motionValue(0)])));
  const {sceneId,progress,setJourney}=useJourneyStore();
  const fps=useTickerFps();
  const activeIndex=Math.max(0,scenes.findIndex(scene=>scene.id===active.id));
  const activeProgress=values.get(active.id)!;
  const transition=getTransitionState(active.id,progress);
  const background=useMemo(()=>{
    if(active.id.startsWith('05')) return palette.neural.background;
    if(active.id.startsWith('03')||active.id.startsWith('04')) return palette.blood.background;
    if(active.id.startsWith('02')) return palette.fungus.background;
    return palette.soil.background;
  },[active]);
  useSceneManager({scenes,values,onSceneChange:setActive,onProgress:setJourney,onReady:setReady});

  const selectDebugScene=(id:string)=>{
    const selected=scenes.find(scene=>scene.id===id);
    if(!selected)return;
    setActive(selected);
    values.get(id)?.set(0);
    setJourney(id,0);
  };
  const setManualProgress=(value:number)=>{
    activeProgress.set(value);
    setJourney(active.id,value);
  };

  return <>
    <div className="world" style={{background}}>
      {webgl?<Canvas dpr={quality==='high'?[1,2]:quality==='medium'?[1,1.5]:1} gl={{antialias:quality!=='low',powerPreference:'high-performance'}} camera={{position:[0,0,5.5],fov:42}}>
        <color attach="background" args={[background]}/>
        <ambientLight intensity={.55}/>
        <directionalLight position={[3,5,4]} intensity={1.15}/>
        <pointLight position={[-3,-1,2]} color={background} intensity={1.1}/>
        <Suspense fallback={null}>
          {scenes.map((scene,index)=>Math.abs(index-activeIndex)<=1?<group key={scene.id} visible={index===activeIndex}><scene.Component progress={values.get(scene.id)!}/></group>:null)}
        </Suspense>
        {quality!=='low'&&<EffectComposer><Bloom intensity={.5} luminanceThreshold={.72}/><Noise opacity={.035}/><Vignette eskil={false} offset={.18} darkness={.7}/></EffectComposer>}
      </Canvas>:<StaticFallback label="Visualização 3D indisponível neste dispositivo"/>}
      <div className="grain"/>
      {transition&&<div className="transition-veil" data-mode={transition.mode} style={{opacity:transition.opacity}} aria-hidden="true"/>}
    </div>
    {!ready&&<div className="preloader">E <small>UMA JORNADA PELA CIÊNCIA</small></div>}
    <header className="topbar"><a href="#intro">ENTRE <i>MUNDOS</i></a><span>BIOLOGIA · FARMACOLOGIA · NEUROCIÊNCIA</span></header>
    <ProgressRail sceneId={sceneId} progress={progress}/>
    <NarrativeText progress={activeProgress} blocks={active.textBlocks}/>
    {debug&&<DebugPanel sceneId={active.id} progress={progress} quality={quality} fps={fps} scenes={scenes.map(scene=>({id:scene.id,label:scene.id}))} onSceneChange={selectDebugScene} onProgressChange={setManualProgress}/>}
    <main>
      <section id="intro" className="intro"><p className="eyebrow">BIOLOGIA · FARMACOLOGIA · NEUROCIÊNCIA</p><h1>Tudo começa<br/><em>na terra.</em></h1><p>Uma jornada visual pelas relações entre fungos, moléculas e cérebro.</p><small>ROLE PARA EXPLORAR ↓</small></section>
      {scenes.map(scene=><section id={'section-'+scene.id} className="scene-section" key={scene.id} style={{minHeight:`${scene.scrollLength}vh`}/>)}
      <section className="outro"><p className="eyebrow">FIM DA JORNADA</p><h2>Conhecer é também<br/><em>reconhecer limites.</em></h2><p>Psilocibina é uma substância psicoativa que pode produzir efeitos intensos e imprevisíveis. Há riscos, interações e contraindicações. Conteúdo educativo; não substitui orientação profissional ou informação médica.</p><small>CONTEÚDO EDUCATIVO · BIOLOGIA E NEUROCIÊNCIA</small><a href="#intro">VOLTAR AO INÍCIO ↑</a></section>
    </main>
  </>;
}