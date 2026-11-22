import assert from 'node:assert/strict';
import test from 'node:test';
import {commitGuestHistory,readStoredGuestHistory,GuestProfileConflictError,GuestProfileReadError,readGuestProfile,writeGuestProfile} from './guestProfileStorage';
import {LOCAL_PROFILE_KEYS} from './profile';

const [current,legacy]=LOCAL_PROFILE_KEYS;
const snapshot={demographics:{age:35,sex:'unselected' as const},values:{pushups:20}};
function memory(entries:Record<string,string>={}){
  const data=new Map(Object.entries(entries));
  return {
    data,
    removeItem:(key:string)=>{data.delete(key);},
    getItem:(key:string)=>data.get(key)??null,
    setItem:(key:string,value:string)=>{data.set(key,value);},
  };
}

test('guest edits preserve unreadable records at any supported profile key',()=>{
  for(const key of LOCAL_PROFILE_KEYS){
    for(const raw of ['', 'invalid JSON','null','{"demographics":{"age":15}}']){
      const storage=memory({[key]:raw});
      assert.throws(()=>readGuestProfile(storage.getItem),GuestProfileReadError);
      assert.throws(()=>writeGuestProfile(storage,snapshot),GuestProfileReadError);
      assert.deepEqual([...storage.data],[[key,raw]]);
    }
  }
});

test('a demo is skipped when a personal legacy profile exists',()=>{
  const raw=JSON.stringify(snapshot);
  const storage=memory({[current]:'{"demo":true}',[legacy]:raw});
  assert.deepEqual(readGuestProfile(storage.getItem)?.values,snapshot.values);
  writeGuestProfile(storage,{...snapshot,values:{...snapshot.values,sit_to_stand:12}});
  assert.deepEqual(readGuestProfile(storage.getItem)?.values,{pushups:20,sit_to_stand:12});
  assert.equal(storage.getItem(legacy),raw);
});

test('unreadable data introduced after opening survives the save, and explicit removal permits a fresh profile',()=>{
  const storage=memory();
  assert.equal(readGuestProfile(storage.getItem),null);
  storage.setItem(current,'broken after opening');
  assert.throws(()=>writeGuestProfile(storage,snapshot),GuestProfileReadError);
  assert.equal(storage.getItem(current),'broken after opening');
  storage.data.delete(current);
  writeGuestProfile(storage,snapshot);
  assert.deepEqual(readGuestProfile(storage.getItem)?.values,snapshot.values);
});

test('a stale guest tab cannot replace a newer saved profile',()=>{
  const storage=memory();
  const before=readGuestProfile(storage.getItem);
  const current=writeGuestProfile(storage,snapshot,before);
  assert.throws(()=>writeGuestProfile(storage,{...snapshot,values:{dips:8}},before),GuestProfileConflictError);
  assert.deepEqual(readGuestProfile(storage.getItem),current);
});

test('measurement journal and profile save together and preserve the original journal on failure',()=>{
  const storage=memory();
  const first={metricId:'pushups',value:20,cleared:false,recordedAt:'2026-11-20T12:00:00Z'};
  assert.throws(()=>commitGuestHistory(storage,[first],snapshot.demographics,()=>{throw Error('quota');}));
  assert.equal(storage.getItem('top1-history-guest'),null);
  commitGuestHistory(storage,[first],snapshot.demographics,()=>writeGuestProfile(storage,snapshot));
  const original=storage.getItem('top1-history-guest');
  assert.throws(()=>commitGuestHistory(storage,[first],snapshot.demographics,()=>{throw Error('different tab');}));
  assert.equal(storage.getItem('top1-history-guest'),original);
  commitGuestHistory(storage,[{...first,measuredAt:'2026-11-21T10:00:00Z'}],snapshot.demographics);
  assert.deepEqual(readStoredGuestHistory(storage).entries.map(row=>row.value),[20,20]);
});

test('an unreadable journal blocks a save before it touches the profile',()=>{
  const incomplete={id:'old',metricId:'bench_1rm',recordedAt:'2026-11-21T12:00:00Z',cleared:false,value:1,derivation:{formula:'epley_ratio_v1'}};
  for(const raw of ['', 'bad JSON', JSON.stringify({version:1,entries:[incomplete]})]){
    const storage=memory({'top1-history-guest':raw});
    assert.throws(()=>commitGuestHistory(storage,[],undefined,()=>writeGuestProfile(storage,snapshot)));
    assert.deepEqual([...storage.data],[['top1-history-guest',raw]]);
  }
});
