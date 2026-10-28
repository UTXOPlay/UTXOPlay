import {canonicalGamePath,gameIdFromPath} from '../shared/game-paths.mjs';
// Documents use the store's account/launch flow. Iframes, APIs, artwork and
// scripts continue through the authenticated game gateway at the same prefix.
export function installGamePages(app){
 app.use((req,res,next)=>{
  if(req.method!=='GET'&&req.method!=='HEAD')return next();
  const path=req.url.split('?')[0],id=gameIdFromPath(path);if(!id)return next();
  const query=req.url.slice(path.length),canonical=canonicalGamePath(id);
  if(path.startsWith('/play/'))return res.redirect(308,canonical+query);
  res.vary('Accept');res.vary('Sec-Fetch-Dest');
  const params=new URLSearchParams(query.slice(1)),embedded=req.headers['sec-fetch-dest']==='iframe'||params.has('launch')||params.has('review');
  const document=req.headers['sec-fetch-dest']==='document'||/text\/html/.test(req.headers.accept||'');
  if(!embedded&&document){if(path!==canonical)return res.redirect(308,canonical+query);req.url='/'+query;}
  next();
 });
}
