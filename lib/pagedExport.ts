export type ExportPart={name:string;pages:()=>AsyncIterable<unknown[]>};
/** Changed data aborts the download before the JSON completion marker. */
export function pagedExport(metadata:Record<string,unknown>,parts:ExportPart[],verify:()=>Promise<void>){
 async function* chunks(){yield JSON.stringify(metadata).slice(0,-1);for(const part of parts){yield `,${JSON.stringify(part.name)}:[`;let first=true;for await(const page of part.pages())for(const row of page){yield `${first?'':','}${JSON.stringify(row)}`;first=false;}yield ']';}await verify();yield ',"complete":true}';}
 const iterator=chunks(),encoder=new TextEncoder();
 return new ReadableStream<Uint8Array>({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(next.value));}catch(e){controller.error(e);}},async cancel(){await iterator.return(undefined);}});
}
