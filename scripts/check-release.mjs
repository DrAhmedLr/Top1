import {spawnSync} from 'node:child_process';
// One reproducible gate; no production credentials or database writes needed.
for(const task of ['test','test:database','typecheck','build']){
 const result=spawnSync('pnpm',[task],{stdio:'inherit'});
 if(result.error){console.error(`Release check ${task} could not start.`);process.exit(1);}
 if(result.status!==0)process.exit(result.status??1);
}
console.log('All release checks passed.');
