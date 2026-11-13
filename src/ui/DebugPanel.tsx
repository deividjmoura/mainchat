import type {Quality} from '../hooks/useQuality';
type Option = {id:string;label:string};
type Props = {sceneId:string;progress:number;quality:Quality;fps:number;scenes:Option[];onSceneChange:(id:string)=>void;onProgressChange:(value:number)=>void};
export default function DebugPanel({sceneId,progress,quality,fps,scenes,onSceneChange,onProgressChange}:Props) {
  return <aside className="debug-panel" aria-label="Painel de depuração">
    <strong>SCROLL ENGINE / DEBUG</strong>
    <label>Cena<select value={sceneId} onChange={event=>onSceneChange(event.target.value)}>{scenes.map(scene=><option key={scene.id} value={scene.id}>{scene.label}</option>)}</select></label>
    <label>Progress <output>{progress.toFixed(3)}</output><input type="range" min="0" max="1" step="0.001" value={progress} onChange={event=>onProgressChange(Number(event.target.value))}/></label>
    <div className="debug-metrics"><span>FPS <b>{fps}</b></span><span>QUALITY <b>{quality.toUpperCase()}</b></span></div>
  </aside>;
}