import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {sealStream,openArchive,outsideRepository,loadKey} from './encrypted-backup.mjs';
test('encrypted archive round-trip, authentication and private file permissions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'top1-backup-test-'));
 try{
  const key=randomBytes(32),plain=Buffer.concat([Buffer.from('PGDMP synthetic test fixture\n'),randomBytes(200000)]),archive=join(dir,'fixture.top1bak');
  await sealStream(Readable.from([plain]),key,archive);
  assert.equal((await stat(archive)).mode&0o777,0o600);
  assert.equal((await readFile(archive)).includes(Buffer.from('synthetic test fixture')),false);
  assert.deepEqual(await openArchive(archive,key),{authenticated:true,bytes:plain.length});
  const output=join(dir,'fixture.dump');await openArchive(archive,key,output);assert.deepEqual(await readFile(output),plain);
  assert.equal((await stat(output)).mode&0o777,0o600);
  await assert.rejects(openArchive(archive,randomBytes(32),join(dir,'wrong-key.dump')));
  const tampered=await readFile(archive);tampered[100]^=1;await writeFile(join(dir,'tampered'),tampered);
  await assert.rejects(openArchive(join(dir,'tampered'),key,join(dir,'tampered.dump')));
  await writeFile(join(dir,'short'),tampered.subarray(0,25));await assert.rejects(openArchive(join(dir,'short'),key));
  assert.equal((await readdir(dir)).some(f=>f.endsWith('.partial')||f==='wrong-key.dump'||f==='tampered.dump'),false);
  await assert.rejects(sealStream(Readable.from([plain]),key,archive));assert.deepEqual(await readFile(output),plain);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('failed database dump never commits a backup; key stays outside source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'top1-backup-test-'));
 try{
  await assert.rejects(sealStream(Readable.from(['incomplete']),randomBytes(32),join(dir,'failed'),async()=>{throw new Error('dump failed');}));
  assert.deepEqual(await readdir(dir),[]);
  await assert.rejects(outsideRepository(join(process.cwd(),'key')));
  const key=join(dir,'key');await writeFile(key,randomBytes(32),{mode:0o644});await assert.rejects(loadKey(key));
 }finally{await rm(dir,{recursive:true,force:true});}
});
