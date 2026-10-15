// Local operator tool. Database credentials use libpq environment/service files,
// never command arguments. No scheduler, production restore or cloud upload.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {readFile,writeFile,stat,realpath,link,unlink,open} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {Writable} from 'node:stream';
import {spawn} from 'node:child_process';
const MAGIC=Buffer.from('TOP1BK01'),HEADER_BYTES=20,TAG_BYTES=16;
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function keyCheck(key){if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('A 32-byte backup key is required.');}
export async function outsideRepository(path){
 if(!path||!isAbsolute(path))throw new Error('Use an absolute path outside the repository.');
 const parent=await realpath(dirname(path)),root=await realpath(repository),candidate=resolve(parent,path.split('/').at(-1)),part=relative(root,candidate);
 if(part===''||(!part.startsWith('..'+ '/')&&part!=='..'&&!isAbsolute(part)))throw new Error('Backup material must stay outside the repository.');
 return candidate;
}
export async function loadKey(path){
 path=await outsideRepository(path);const info=await stat(path);
 if(!info.isFile()||(info.mode&0o077)!==0)throw new Error('The backup key must be a private file (mode 600).');
 const key=await readFile(path);keyCheck(key);return key;
}
async function commit(partial,destination){await link(partial,destination);await unlink(partial);}
export async function sealStream(source,key,destination,beforeCommit=async()=>{}){
 keyCheck(key);const partial=destination+'.'+randomBytes(8).toString('hex')+'.partial',nonce=randomBytes(12),header=Buffer.concat([MAGIC,nonce]);
 let created=false;
 try{
  const handle=await open(partial,'wx',0o600);created=true;await handle.writeFile(header);await handle.close();
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(header);
  await pipeline(source,cipher,createWriteStream(partial,{flags:'a',mode:0o600}));
  await writeFile(partial,cipher.getAuthTag(),{flag:'a'});
  await beforeCommit();await commit(partial,destination);created=false;
 }finally{if(created)await unlink(partial).catch(()=>{});}
}
export async function openArchive(source,key,destination){
 keyCheck(key);const info=await stat(source);
 if(info.size<HEADER_BYTES+TAG_BYTES)throw new Error('Truncated backup.');
 const handle=await open(source,'r'),header=Buffer.alloc(HEADER_BYTES),tag=Buffer.alloc(TAG_BYTES);
 try{await handle.read(header,0,HEADER_BYTES,0);await handle.read(tag,0,TAG_BYTES,info.size-TAG_BYTES);}finally{await handle.close();}
 if(!header.subarray(0,8).equals(MAGIC))throw new Error('Unsupported backup format.');
 const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8));decipher.setAAD(header);decipher.setAuthTag(tag);
 const partial=destination?destination+'.'+randomBytes(8).toString('hex')+'.partial':null;
 let created=false,bytes=0;
 try{
  let sink=new Writable({write(chunk,_encoding,done){bytes+=chunk.length;done();}});
  if(partial){const file=await open(partial,'wx',0o600);await file.close();created=true;sink=createWriteStream(partial,{flags:'a',mode:0o600});}
  await pipeline(createReadStream(source,{start:HEADER_BYTES,end:info.size-TAG_BYTES-1}),decipher,sink);
  // Never expose a completed plaintext archive until its GCM tag verifies.
  if(partial){await commit(partial,destination);created=false;}
  return {authenticated:true,bytes:destination?(await stat(destination)).size:bytes};
 }finally{if(created)await unlink(partial).catch(()=>{});}
}
async function main(){
 const [command,keyPath,archivePath,plainPath]=process.argv.slice(2);
 if(command==='init-key'){
  const path=await outsideRepository(keyPath);await writeFile(path,randomBytes(32),{flag:'wx',mode:0o600});
  console.log('Private backup key created. Keep a separate protected copy; losing it makes backups unrecoverable.');return;
 }
 if(!['backup','verify','decrypt'].includes(command))throw new Error('Usage: node scripts/encrypted-backup.mjs init-key KEY | backup KEY ARCHIVE | verify KEY ARCHIVE | decrypt KEY ARCHIVE PLAINTEXT');
 const key=await loadKey(keyPath),archive=await outsideRepository(archivePath);
 if(command==='backup'){
  if(!process.env.PGSERVICE&&!process.env.PGHOST)throw new Error('Configure a private libpq service or PGHOST/PGUSER/PGDATABASE and PGPASSFILE first.');
  if(process.env.PGPASSWORD)throw new Error('Use a private PGPASSFILE instead of PGPASSWORD.');
  if(!process.env.PGPASSFILE)throw new Error('Set PGPASSFILE to a private password file outside the repository.');
  const pass=await outsideRepository(process.env.PGPASSFILE),info=await stat(pass);
  if((info.mode&0o077)!==0)throw new Error('PGPASSFILE must have mode 600.');
  const child=spawn(process.env.TOP1_PG_DUMP||'pg_dump',['--format=custom','--no-password'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PGSSLMODE:'verify-full',PGCONNECT_TIMEOUT:'15',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=0 -c lock_timeout=10000'}});
  child.stderr.resume();const done=new Promise((res,rej)=>{child.once('error',()=>rej(new Error('pg_dump could not start. Install PostgreSQL 17+ client tools.')));child.once('close',code=>code===0?res():rej(new Error('Database backup failed. Check the private connection and matching client version.')));});
  // Handle failure immediately even if stream processing has not finished.
  done.catch(()=>{});
  try{await sealStream(child.stdout,key,archive,()=>done);}catch(error){child.kill();await done.catch(()=>{});throw error;}
  const result=await openArchive(archive,key);console.log(JSON.stringify({backupCreated:true,...result,scope:'Database archive only. Storage objects and service configuration need separate recovery.'}));return;
 }
 const destination=command==='decrypt'?await outsideRepository(plainPath):undefined;
 const result=await openArchive(archive,key,destination);console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Backup operation failed. Check private file paths, permissions, credentials, integrity and PostgreSQL client prerequisites. No restore was attempted.');process.exitCode=1;});
