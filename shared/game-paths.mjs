export function canonicalGamePath(id){return '/games/'+(id==='drift-run'?'nerveshift':id)+'/';}
export function gameIdFromPath(path){const match=String(path).match(/^\/(?:games|play)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);return match?(['nightshift','nerveshift'].includes(match[1])?'drift-run':match[1]):null;}
