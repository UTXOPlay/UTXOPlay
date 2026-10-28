// Keep the catalog and replay identity stable while changing the public URL.
// The store redirects old entry links; the game host also accepts canonical
// requests directly but must serve old upstream mounts without redirect loops.
export function installNightshiftRoutes(app,{redirectLegacy=true}={}) {
 const canonical='/games/nightshift',legacy='/games/drift-run';
 app.use((req,res,next)=>{
  const pathname=req.url.split('?')[0],query=req.url.slice(pathname.length);
  const navigation=req.method==='GET'||req.method==='HEAD';
  if(navigation&&(pathname===canonical||redirectLegacy&&(pathname===legacy||pathname===legacy+'/')))
   return res.redirect(308,canonical+'/'+query);
  if(pathname===canonical||pathname.startsWith(canonical+'/'))
   req.url=legacy+req.url.slice(canonical.length);
  next();
 });
}
