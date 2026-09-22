export const VIKTOR_SESSION_BUILD = 64 as const;
export const VIKTOR_SESSION_SCHEMA = 'gd-viktor-session/1' as const;
export const VIKTOR_STATES = Object.freeze(['OFF','READY','LISTENING','SPEAKING','ERROR'] as const);
export type ViktorState=(typeof VIKTOR_STATES)[number];

export interface ViktorSessionSnapshot {
  readonly schema: typeof VIKTOR_SESSION_SCHEMA;
  readonly build: typeof VIKTOR_SESSION_BUILD;
  readonly state: ViktorState;
  readonly enabled: boolean;
  readonly microphoneCaptured: boolean;
  readonly transportActive: boolean;
  readonly error: string | null;
  readonly activationIsCapabilityGrant: false;
  readonly activationIsApproval: false;
  readonly activationIsScopeLock: false;
  readonly persistentActivation: false;
  readonly backgroundListening: false;
}

export interface ViktorVoiceAdapter {
  requestMicrophonePermission(): Promise<void>;
  startMicrophoneCapture(): Promise<void>;
  stopMicrophoneCapture(): Promise<void>;
  stopVoiceTransport(): Promise<void>;
  cancelAssistantAudio(): Promise<void>;
}

export interface ViktorSessionController {
  snapshot(): ViktorSessionSnapshot;
  subscribe(listener:(snapshot:ViktorSessionSnapshot)=>void):()=>void;
  activate(): Promise<ViktorSessionSnapshot>;
  startListening(): Promise<ViktorSessionSnapshot>;
  markSpeaking(): ViktorSessionSnapshot;
  markReady(): ViktorSessionSnapshot;
  deactivate(): Promise<ViktorSessionSnapshot>;
}

function errorText(value:unknown):string {
  if(value instanceof Error&&value.message.trim()) return value.message.trim().slice(0,512);
  return 'Viktor voice is unavailable.';
}

export function createBrowserViktorVoiceAdapter():ViktorVoiceAdapter {
  let stream:MediaStream|null=null;
  return Object.freeze({
    async requestMicrophonePermission() {
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.');
      const permissionStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      for(const track of permissionStream.getTracks()) track.stop();
    },
    async startMicrophoneCapture() {
      if(stream) return;
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.');
      stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    },
    async stopMicrophoneCapture() {
      if(!stream) return;
      for(const track of stream.getTracks()) track.stop();
      stream=null;
    },
    async stopVoiceTransport() {},
    async cancelAssistantAudio() {},
  });
}

export function createViktorSessionController(adapter:ViktorVoiceAdapter):ViktorSessionController {
  let state:ViktorState='OFF';
  let microphoneCaptured=false;
  let transportActive=false;
  let error:string|null=null;
  const listeners=new Set<(snapshot:ViktorSessionSnapshot)=>void>();

  const snapshot=():ViktorSessionSnapshot=>Object.freeze({
    schema:VIKTOR_SESSION_SCHEMA,build:VIKTOR_SESSION_BUILD,state,enabled:state==='READY'||state==='LISTENING'||state==='SPEAKING',
    microphoneCaptured,transportActive,error,activationIsCapabilityGrant:false,activationIsApproval:false,
    activationIsScopeLock:false,persistentActivation:false,backgroundListening:false,
  });
  const publish=()=>{const value=snapshot();for(const listener of listeners)listener(value);return value;};
  const fail=async(value:unknown)=>{
    await adapter.stopMicrophoneCapture();await adapter.stopVoiceTransport();await adapter.cancelAssistantAudio();
    microphoneCaptured=false;transportActive=false;state='ERROR';error=errorText(value);return publish();
  };

  return Object.freeze({
    snapshot,
    subscribe(listener:(snapshot:ViktorSessionSnapshot)=>void) { listeners.add(listener);listener(snapshot());return()=>listeners.delete(listener); },
    async activate() {
      if(state!=='OFF'&&state!=='ERROR') return snapshot();
      error=null;
      try {
        await adapter.requestMicrophonePermission();
        state='READY';microphoneCaptured=false;transportActive=false;
        return publish();
      } catch (cause) { return fail(cause); }
    },
    async startListening() {
      if(state==='OFF'||state==='ERROR') throw new TypeError('Viktor must be explicitly activated before listening.');
      try {
        await adapter.startMicrophoneCapture();
        microphoneCaptured=true;state='LISTENING';error=null;return publish();
      } catch (cause) { return fail(cause); }
    },
    markSpeaking() {
      if(state==='OFF'||state==='ERROR') throw new TypeError('Viktor must be active before speaking.');
      state='SPEAKING';return publish();
    },
    markReady() {
      if(state==='OFF'||state==='ERROR') throw new TypeError('Viktor must be active before becoming ready.');
      state='READY';return publish();
    },
    async deactivate() {
      await adapter.stopMicrophoneCapture();await adapter.stopVoiceTransport();await adapter.cancelAssistantAudio();
      microphoneCaptured=false;transportActive=false;state='OFF';error=null;return publish();
    },
  });
}
