import { useEffect, useMemo, useState } from 'react';
import {
  createBrowserViktorVoiceAdapter,
  createViktorSessionController,
  type ViktorSessionSnapshot,
} from './viktor-session.js';

function label(snapshot:ViktorSessionSnapshot):string {
  if(snapshot.state==='OFF') return 'Off';
  if(snapshot.state==='READY') return 'Ready';
  if(snapshot.state==='LISTENING') return 'Listening';
  if(snapshot.state==='SPEAKING') return 'Speaking';
  return 'Unavailable';
}

export function ViktorToggle() {
  const controller=useMemo(()=>createViktorSessionController(createBrowserViktorVoiceAdapter()),[]);
  const [snapshot,setSnapshot]=useState<ViktorSessionSnapshot>(()=>controller.snapshot());

  useEffect(()=>{
    const unsubscribe=controller.subscribe(setSnapshot);
    return ()=>{
      unsubscribe();
      void controller.deactivate();
    };
  },[controller]);

  async function toggle():Promise<void> {
    if(snapshot.state==='OFF'||snapshot.state==='ERROR') await controller.activate();
    else await controller.deactivate();
  }

  return (
    <div className="viktor-control" data-viktor-state={snapshot.state}>
      <button
        type="button"
        className="viktor-toggle"
        aria-pressed={snapshot.enabled}
        aria-label={snapshot.enabled ? 'Turn Viktor off' : 'Turn Viktor on'}
        onClick={()=>void toggle()}
      >
        <span className="viktor-toggle-dot" aria-hidden="true" />
        <span>Viktor</span>
      </button>
      <span className="viktor-state" role={snapshot.state==='ERROR' ? 'alert' : 'status'}>
        {label(snapshot)}
      </span>
    </div>
  );
}
