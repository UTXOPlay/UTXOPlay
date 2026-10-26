import {WebSocket,WebSocketServer} from 'ws';

// Both standalone hosts and stores authenticate upgrades before forwarding them.
export function gameSockets({account,origin,limited,routes}) {
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 const peers=new Map();
 function reject(socket,status){socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);}
 function upgrade(req,socket,head){
  socket.on('error',()=>socket.destroy());
  const route=routes.get(req.url);
  if(!route)return reject(socket,'404 Not Found');
  const user=account(req);
  if(!user)return reject(socket,'401 Unauthorized');
  if(!user.service&&req.headers.origin!==origin)return reject(socket,'403 Forbidden');
  if(wss.clients.size>=128)return reject(socket,'503 Service Unavailable');
  if((peers.get(user.id)?.size||0)>=3||limited(user.id+':socket',30,60000))return reject(socket,'429 Too Many Requests');
  wss.handleUpgrade(req,socket,head,client=>{
   const group=peers.get(user.id)||new Set();group.add(client);peers.set(user.id,group);
   const url=new URL(route.url);url.protocol=url.protocol==='https:'?'wss:':'ws:';
   const upstream=new WebSocket(url,{headers:{'X-Runtime-Token':route.token,'X-UTXOPlay-Account':user.id},maxPayload:262144,perMessageDeflate:false,handshakeTimeout:5000});
   let windowStart=Date.now(),messages=0;client.alive=true;
   const valid=()=>account(req)?.id===user.id;
   const shutdown=()=>{client.terminate();upstream.terminate();};
   client.on('pong',()=>{client.alive=true;});
   const timer=setInterval(()=>{if(!valid()||!client.alive)return shutdown();client.alive=false;client.ping();},5000);timer.unref();
   client.on('error',shutdown);upstream.on('error',shutdown);
   client.on('close',()=>{clearInterval(timer);group.delete(client);if(!group.size)peers.delete(user.id);upstream.terminate();});
   upstream.on('close',()=>client.close(1013,'Realtime disconnected'));
   client.on('message',(raw,binary)=>{
    if(!valid())return shutdown();
    if(Date.now()-windowStart>=1000){windowStart=Date.now();messages=0;}
    if(binary||++messages>120||upstream.bufferedAmount>65536)return shutdown();
    if(upstream.readyState===WebSocket.OPEN)upstream.send(raw,{binary:false});
   });
   upstream.on('message',(raw,binary)=>{
    if(!valid()||binary||client.bufferedAmount>262144)return shutdown();
    if(client.readyState===WebSocket.OPEN)client.send(raw,{binary:false});
   });
  });
 }
 return {attach:server=>server.on('upgrade',upgrade),close:()=>{for(const ws of wss.clients)ws.terminate();wss.close();}};
}
