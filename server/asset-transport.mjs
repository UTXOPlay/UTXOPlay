import http from 'node:http';
import https from 'node:https';
import {Readable} from 'node:stream';

// Asset representations must keep their encoded bytes, validators and ranges.
// Fetch transparently decodes bodies and changes conditional request semantics.
export function assetTransport(url,{method='GET',headers={},signal}={}){
 return new Promise((resolve,reject)=>{
  const target=new URL(url);
  if(!['http:','https:'].includes(target.protocol)){reject(new TypeError('Unsupported asset origin'));return;}
  const request=(target.protocol==='https:'?https:http).request(target,{method,headers,signal},response=>{
   const resultHeaders=new Headers();
   for(let n=0;n<response.rawHeaders.length;n+=2)resultHeaders.append(response.rawHeaders[n],response.rawHeaders[n+1]);
   const status=response.statusCode;
   const empty=method==='HEAD'||[204,205,304].includes(status);
   if(empty)response.resume();
   resolve({status,headers:resultHeaders,body:empty?null:Readable.toWeb(response)});
  });
  request.once('error',reject);
  request.once('upgrade',(_response,socket)=>{socket.destroy();reject(new Error('Asset origin attempted a protocol upgrade'));});
  request.end();
 });
}
