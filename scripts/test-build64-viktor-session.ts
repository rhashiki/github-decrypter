import assert from 'node:assert/strict';
import { createViktorSessionController, type ViktorVoiceAdapter } from '../apps/studio/src/viktor-session.js';

function fakeAdapter(options:{permissionFails?:boolean}={}){
  const calls={permission:0,start:0,stop:0,transport:0,audio:0};
  const adapter:ViktorVoiceAdapter={
    async requestMicrophonePermission(){calls.permission+=1;if(options.permissionFails)throw new Error('permission denied');},
    async startMicrophoneCapture(){calls.start+=1;},
    async stopMicrophoneCapture(){calls.stop+=1;},
    async stopVoiceTransport(){calls.transport+=1;},
    async cancelAssistantAudio(){calls.audio+=1;},
  };
  return {adapter,calls};
}

const first=fakeAdapter();
const controller=createViktorSessionController(first.adapter);
assert.deepEqual(controller.snapshot(),{
  schema:'gd-viktor-session/1',build:64,state:'OFF',enabled:false,microphoneCaptured:false,transportActive:false,error:null,
  activationIsCapabilityGrant:false,activationIsApproval:false,activationIsScopeLock:false,persistentActivation:false,backgroundListening:false,
});
assert.deepEqual(first.calls,{permission:0,start:0,stop:0,transport:0,audio:0});

await assert.rejects(controller.startListening(),/explicitly activated/i);
assert.equal(first.calls.start,0);

const ready=await controller.activate();
assert.equal(ready.state,'READY');
assert.equal(ready.enabled,true);
assert.equal(ready.microphoneCaptured,false);
assert.equal(first.calls.permission,1);
assert.equal(first.calls.start,0);

const listening=await controller.startListening();
assert.equal(listening.state,'LISTENING');
assert.equal(listening.microphoneCaptured,true);
assert.equal(first.calls.start,1);

assert.equal(controller.markSpeaking().state,'SPEAKING');
assert.equal(controller.markReady().state,'READY');

const off=await controller.deactivate();
assert.equal(off.state,'OFF');
assert.equal(off.enabled,false);
assert.equal(off.microphoneCaptured,false);
assert.equal(first.calls.stop,1);
assert.equal(first.calls.transport,1);
assert.equal(first.calls.audio,1);

const second=fakeAdapter();
const newSession=createViktorSessionController(second.adapter);
assert.equal(newSession.snapshot().state,'OFF');
assert.equal(second.calls.permission,0);

const failing=fakeAdapter({permissionFails:true});
const failedController=createViktorSessionController(failing.adapter);
const failed=await failedController.activate();
assert.equal(failed.state,'ERROR');
assert.equal(failed.enabled,false);
assert.match(failed.error??'',/permission denied/i);
assert.equal(failing.calls.stop,1);
assert.equal(failing.calls.transport,1);
assert.equal(failing.calls.audio,1);

console.log(JSON.stringify({
  ok:true,schema:'gd-build64-viktor-session-runtime/1',build:64,
  defaultOff:true,explicitActivation:true,permissionHandshake:true,captureStartsOnlyAfterListening:true,
  immediateDeactivation:true,persistentActivation:false,backgroundListening:false,
},null,2));
