import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Capacitor} from '@capacitor/core';
/** Preserve the shared web export actions, including detached download anchors. */
export function installNativeDownloads(onError:(message:string)=>void){
 if(!Capacitor.isNativePlatform())return()=>{};
 const original=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){
  if(!this.download||!this.href.startsWith('blob:')){original.call(this);return;}
  const href=this.href,name=this.download.replace(/[^a-zA-Z0-9._-]/g,'_');
  void (async()=>{
   const blob=await (await fetch(href)).blob();
   const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
   const path=`top1-exports/${crypto.randomUUID()}/${name}`;
   const file=await Filesystem.writeFile({path,data:base64,directory:Directory.Cache,recursive:true});
   try{await Share.share({title:'TOP1 export',files:[file.uri]});}finally{await Filesystem.deleteFile({path,directory:Directory.Cache});}
  })().catch(()=>onError('Unable to share the export. Please try again.'));
 };
 return()=>{HTMLAnchorElement.prototype.click=original;};
}
