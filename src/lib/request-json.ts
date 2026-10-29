export async function boundedJson(request:Request,maxBytes=16000):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new Error('A request body is required.');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new Error('Request is too large.');}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Send valid JSON.');}
}
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');if(!origin)return true;
 const url=new URL(request.url);
 // Next's local server may normalize request.url to localhost while the browser uses 127.0.0.1.
 // Host is the actual receiving host; browsers cannot override it on cross-origin fetches.
 const host=request.headers.get('host');
 return origin===url.origin || Boolean(host && origin===`${url.protocol}//${host}`);
}
