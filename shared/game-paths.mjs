export function canonicalGamePath(id){return '/games/'+(id==='drift-run'?'nightshift':id)+'/';}
export function gameIdFromPath(path){const match=String(path).match(/^\/(?:games|play)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);return match?(match[1]==='nightshift'?'drift-run':match[1]):null;}
