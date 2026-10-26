export const genres = [
  "All games",
  "Action",
  "Arcade",
  "Strategy",
  "Puzzle",
  "Other",
];
export function selectGames(
  games,
  { query = "", genre = "All games", mode = "all", freeOnly = false } = {},
) {
  const q = query.trim().toLocaleLowerCase();
  return games.filter(
    (g) =>
      (!freeOnly || g.pricing !== "paid") &&
      (genre === "All games" || g.genre === genre) &&
      (!q ||
        `${g.title} ${g.description} ${g.genre} ${g.mode} ${g.developer?.name || ""} ${g.publisher?.name || ""}`
          .toLocaleLowerCase()
          .includes(q)) &&
      (mode === "all" ||
        (mode === "solo" &&
          (g.vendor
            ? ["Single player", "Solo + multiplayer"].includes(g.mode)
            : true)) ||
        (mode === "friends" &&
          (g.vendor ? g.mode !== "Single player" : g.mode !== "Single-player"))),
  );
}
// Display follows authentication, never just the presence of a wallet provider.
export function walletButtonState({user,loadingUser=false,walletBusy=false,walletPhase='idle',isOpen=false,signer=null,walletError=''}) {
 const pending=loadingUser?'checking':walletBusy?(walletPhase==='idle'?'loading':walletPhase):isOpen?'choosing':null;
 const labels={checking:'Checking session',loading:'Opening wallet',choosing:'Choose wallet',signature:'Confirm in wallet',verifying:'Verifying',logout:'Signing out'};
 if(pending)return {state:pending,label:labels[pending]||'Connecting',hint:labels[pending]||'Connecting',busy:true};
 if(user&&!user.guest){const address=user.address||'';return {state:'connected',label:user.username||address.slice(0,6)+'…'+address.slice(-4),hint:'Signed in · '+address+' · Open account',busy:false};}
 if(walletError)return {state:'error',label:'Try again',hint:walletError,busy:false};
 if(signer)return {state:'ready',label:'Sign in',hint:'Wallet selected · Sign a message to sign in',busy:false};
 return {state:user?.guest?'guest':'disconnected',label:'Connect wallet',hint:'Connect a wallet to sign in',busy:false};
}
export function apiError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError")
    return "This is taking longer than expected. Please try again.";
  if (error instanceof TypeError)
    return "We couldn’t reach UTXOPlay. Check your connection and try again.";
  return error?.message || "Something went wrong. Please try again.";
}


// Publisher collections follow wallet identity. Unverified developer claims stay
// inside the publishing account's catalog; names alone never merge identities.
export function creatorKey(game, role) {
  if (!["developer", "publisher"].includes(role)) return null;
  const person = game?.[role];
  if (!person?.name || ["Not specified", "Independent publisher"].includes(person.name) && !person.address) return null;
  if (role === "publisher") return JSON.stringify([role, person.address || game.id]);
  const scope = game.vendor ? ["publisher", game.publisher?.address || game.id] : ["curated"];
  const identity = person.address ? ["wallet", person.address] : !game.vendor && person.sourceUrl ? ["source", person.sourceUrl] : ["listing", game.id];
  return JSON.stringify([role, scope, identity]);
}
export function creatorHref(game, role) {
  return game?.id && creatorKey(game, role) ? `/creators/${role}/${encodeURIComponent(game.id)}` : null;
}
export function creatorCollection(games, role, gameId) {
  const anchor = games.find(game => game.id === gameId), key = creatorKey(anchor, role);
  if (!key) return null;
  return { person: anchor[role], anchor, games: games.filter(game => creatorKey(game, role) === key) };
}

export function creatorRoleLinks(games, role, gameId) {
  const current = creatorCollection(games, role, gameId);
  if (!current) return [];
  return ["developer", "publisher"].flatMap(target => {
    const anchor = target === role ? current.anchor : current.person.address && games.find(game =>
      game[target]?.address === current.person.address &&
      !!game.vendor === !!current.anchor.vendor &&
      (!game.vendor || game.publisher?.address === current.anchor.publisher?.address));
    const collection = anchor && creatorCollection(games, target, anchor.id);
    return collection ? [{role:target, href:creatorHref(anchor,target), count:collection.games.length}] : [];
  });
}
export function filterCreatorGames(games, {query="", genre="All games", freeOnly=false, sort="store"}={}) {
  const filtered = selectGames(games, {query,genre,freeOnly});
  if (["az", "za"].includes(sort)) filtered.sort((a,b) =>
    (sort === "az" ? 1 : -1) * (a.title.localeCompare(b.title, "en", {sensitivity:"base",numeric:true}) || a.id.localeCompare(b.id)));
  return filtered;
}
