export function jsonExportStream(data:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(data));let cursor=0;
 return new ReadableStream<Uint8Array>({pull(controller){if(cursor>=bytes.length){controller.close();return;}const end=Math.min(bytes.length,cursor+32768);controller.enqueue(bytes.subarray(cursor,end));cursor=end;}});
}
