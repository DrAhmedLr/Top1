import type {ProfileState} from './profile';

export class SupersededSave extends Error {
  constructor(){super('This save was superseded. Review the current profile before saving.');}
}

/** Revisions advance only through our own acknowledged writes. A cloud reload
 * invalidates queued payloads rather than rebasing them onto another writer. */
export class ProfileSaveQueue {
  private owner?:string;
  private revision=0;
  private generation=0;
  private pending:Promise<unknown>=Promise.resolve();
  adopt(owner:string,revision:number){
    if(this.owner===owner&&revision<this.revision)return false;
    this.owner=owner;this.revision=revision;this.generation++;
    return true;
  }
  invalidate(){this.generation++;}
  currentRevision(owner:string){return this.owner===owner?this.revision:0;}
  enqueue(owner:string,profile:ProfileState,write:(profile:ProfileState)=>Promise<ProfileState>){
    const generation=this.generation;
    const current=()=>this.owner===owner&&this.generation===generation;
    const job=this.pending.catch(()=>{}).then(async()=>{
      if(!current())throw new SupersededSave();
      try{
        const saved=await write({...profile,revision:this.revision});
        if(!current())throw new SupersededSave();
        this.revision=saved.revision??this.revision;
        return saved;
      }catch(error){if(current())this.invalidate();throw error;}
    });
    this.pending=job;
    return job;
  }
}

/** Ordinary edits preserve server visibility. Publication is an explicit action. */
export function saveVisibility(current:boolean,input:unknown,intent:unknown){
  if(typeof input!=='boolean')throw new Error('Choose private or public visibility.');
  if(intent!==undefined&&typeof intent!=='boolean')throw new Error('Invalid visibility action.');
  return intent===true?input:current;
}
