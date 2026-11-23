import test from 'node:test';
import assert from 'node:assert/strict';
import {captureEvent, recordView} from './analytics';
import {startCustomerJourney} from './customerJourneyClient';

test('journey capture works independently of daily counts, strips free text and retries only with the same event ID',async t=>{
  const document = Object.assign(new EventTarget(), {hidden:false,hasFocus:()=>true});
  let tick:()=>void = ()=>{};
  const window = Object.assign(new EventTarget(),{setInterval:(fn:()=>void)=>{tick=fn;return 0;}});
  t.mock.method(globalThis,'setInterval',()=>0);
  const captured:{consentId:string;events:{id:string;event:string;view:string;metric?:string}[]}[]=[];
  t.mock.method(globalThis,'fetch',async(_url:string,init:RequestInit)=>{
    captured.push(JSON.parse(String(init.body)));
    return new Response(null,{status:captured.length===1?503:200});
  });
  Object.defineProperties(globalThis,{document:{value:document,configurable:true},window:{value:window,configurable:true}});
  t.after(()=>{Reflect.deleteProperty(globalThis,'document');Reflect.deleteProperty(globalThis,'window');});
  const stop=startCustomerJourney('owner','consent','overview');
  try {
    const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
    await settle();
    tick(); await settle();
    assert.equal(captured[0].events[0].id,captured[1].events[0].id);
    recordView('program'); await settle();
    recordView('program');
    captureEvent('goal_saved',{metric_id:'pushups',value:85,email:'private@example.test'}); await settle();
    captureEvent('measurement_saved',{metric_id:'private message'}); await settle();
    const entries=captured.flatMap(page=>page.events);
    assert.equal(entries.filter(e=>e.event==='app_viewed'&&e.view==='program').length,1);
    assert.equal(entries.find(e=>e.event==='goal_saved')?.metric,'pushups');
    assert.equal(entries.find(e=>e.event==='measurement_saved')?.metric,undefined);
    assert.ok(!JSON.stringify(entries).includes('private'));
    assert.ok(captured.every(batch=>batch.consentId==='consent'));
    stop();
    const count=captured.length;
    captureEvent('goal_saved'); recordView('profile');tick();await settle();
    assert.equal(captured.length,count);
  } finally {stop();}
});
