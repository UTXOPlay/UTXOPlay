import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import {
  MotionConfig,
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Play,
  Search,
  Gamepad2,
  Grid2X2,
  Library,
  Code2,
  ChevronRight,
  Check,
  Wallet,
  X,
  ShieldCheck,
  LogOut,
  Menu,
  Settings2,
  Copy,
  Download,
  Users,
  Sparkles,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import {
  StoreNavigation,
  WalletPickerGuard,
  BrandIcon,
  Spinner,
  Modal,
  Notice,
  Skeletons,
  GameCard,
  GameDetails,
  PageHeading,
} from "./ui.jsx";
import {
  genres,
  selectGames,
  walletButtonState,
  apiError,
  shuffleFeatured,
} from "./ui-model.mjs";
import "./style.css";
import {createWalletSession, disconnectWallet} from "./wallet-session.mjs";
import {ItemStore} from "./item-store.jsx";
import {CommunityPage,UsernameEditor} from "./community.jsx";
import {CreatorCollection} from "./creators.jsx";
import {GameFrame} from "./game-frame.jsx";
const loadMarketplace = () => import("./marketplace.jsx");
const Studio = lazy(() =>
  loadMarketplace().then((m) => ({ default: m.Studio })),
);
const VendorPlay = lazy(() =>
  loadMarketplace().then((m) => ({ default: m.VendorPlay })),
);
const Purchases = lazy(() =>
  loadMarketplace().then((m) => ({ default: m.Purchases })),
);
import initialGames from "../server/catalog.json";
async function api(url, body) {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("The service is temporarily unavailable. Please try again.");
  }
  if (!r.ok) {
    const e = Error(data.error || "Something went wrong. Please try again.");
    e.status = r.status;
    throw e;
  }
  return data;
}
const short = (a) => (a ? `${a.slice(0, 9)}…${a.slice(-6)}` : "");
function readMotion() {
  try {
    return localStorage.getItem("utxoplay:motion") || "system";
  } catch {
    return "system";
  }
}
function Root() {
  const [Host, setHost] = useState(null),
    [runtime, setRuntime] = useState({});
  const ready = useRef(null),
    pending = useRef(null);
  const onState = useCallback((value) => {
    ready.current = value;
    setRuntime((old) =>
      Object.keys(value).every((k) => old[k] === value[k]) ? old : value,
    );
    pending.current?.resolve(value);
    pending.current = null;
  }, []);
  const prepareWallet = useCallback(() => {
    if (ready.current) return Promise.resolve(ready.current);
    if (pending.current) return pending.current.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const timer = setTimeout(() => {
      pending.current?.reject(
        new Error("Wallet tools took too long to load. Please try again."),
      );
      pending.current = null;
    }, 20000);
    promise.then(
      () => clearTimeout(timer),
      () => clearTimeout(timer),
    );
    pending.current = { promise, resolve, reject };
    import("./wallet-runtime.jsx")
      .then((m) => setHost(() => m.default))
      .catch((e) => {
        pending.current?.reject(e);
        pending.current = null;
      });
    return promise;
  }, []);
  return (
    <>
      <App walletApi={{ ...runtime, prepareWallet }} />
      {Host && <Host onState={onState} />}
    </>
  );
}
function useAccountResource(user, url, revision = 0) {
  const [state, setState] = useState({
    owner: null,
    data: [],
    loading: false,
    error: "",
  });
  useEffect(() => {
    let live = true;
    const id = user?.id;
    if (!id) {
      setState({ owner: null, data: [], loading: false, error: "" });
      return;
    }
    setState({ owner: id, data: [], loading: true, error: "" });
    api(url)
      .then((d) => {
        if (live)
          setState({
            owner: id,
            data: d.games || d.projects || [],
            loading: false,
            error: "",
          });
      })
      .catch((e) => {
        if (live)
          setState({ owner: id, data: [], loading: false, error: apiError(e) });
      });
    return () => {
      live = false;
    };
  }, [user?.id, url, revision]);
  return state.owner === user?.id
    ? state
    : { data: [], loading: !!user, error: "" };
}
function App({ walletApi }) {
  const [remoteGame, setRemoteGame] = useState(null),
    [vendorLoading, setVendorLoading] = useState(false),
    [freeOnly, setFreeOnly] = useState(false);
  const [page, setPage] = useState(location.pathname),
    [games, setGames] = useState(initialGames),
    [catalogStatus, setCatalogStatus] = useState({loading:true,error:""}),
    [user, setUser] = useState(null),
    [loadingUser, setLoadingUser] = useState(true),
    [accountError, setAccountError] = useState("");
  const [query, setQuery] = useState(""),
    [genre, setGenre] = useState("All games"),
    [mode, setMode] = useState("all"),
    [featured, setFeatured] = useState(() => {
      let previous;
      try { previous = sessionStorage.getItem("utxoplay:last-featured"); } catch {}
      const order = shuffleFeatured(initialGames, previous);
      return { order, id: order[0] };
    });
  const [toast, setToast] = useState(null),
    [dialog, setDialog] = useState(null),
    [details, setDetails] = useState(null),
    [walletBusy, setWalletBusy] = useState(false),
    [walletPhase, setWalletPhase] = useState("idle"),
    [intent, setIntent] = useState(false),
    [walletError, setWalletError] = useState(""),
    [launching, setLaunching] = useState("");
  const [mobileNav, setMobileNav] = useState(false),
    [frameKey, setFrameKey] = useState(0),
    [revision, setRevision] = useState(0),
    [motionSetting, setMotionSetting] = useState(readMotion),
    [quality, setQuality] = useState(() => {
      try {
        return localStorage.getItem("utxoplay:quality") || "auto";
      } catch {
        return "auto";
      }
    }),
    [online, setOnline] = useState(navigator.onLine);
  const {
    signer,
    close: closePicker = () => {},
    disconnect = async () => {},
    wallet,
    isOpen = false,
    prepareWallet,
  } = walletApi;
  const [auth] = useState(() => createWalletSession(api));
  const previousSigner = useRef(null),
    signing = useRef(false),
    launchLock = useRef(false),
    searchRef = useRef(null),
    mainRef = useRef(null),
    walletPickerSeen = useRef(false),
    cancelSignature = useRef(null);
  const reduceSystem = useReducedMotion(),
    reduced = motionSetting === "reduced" || !!reduceSystem;
  const libraryState = useAccountResource(user, "/api/library", revision);
  const libraryGames = libraryState.data
    .map((p) => ({
      ...(games.find((g) => g.id === p.game) || p.details),
      updated: p.updated,
    }))
    .filter((g) => g.id);
  const featuredGames = games.filter((g) => !g.vendor);
  const game =
      games.find((g) => page === "/play/" + g.id) ||
      libraryGames.find((g) => page === "/play/" + g.id) ||
      (remoteGame && page === "/play/" + remoteGame.id ? remoteGame : null),
    hero = featuredGames.find((g) => g.id === featured.id) || featuredGames[0],
    signedIn = !!user && !user.guest;
  const activeGame = !!(game && !game.vendor && user && !loadingUser);
  // Preserve the shuffled deck when the API refreshes the same catalog.
  useEffect(() => {
    setFeatured(current => {
      const eligible = games.filter(g => !g.vendor).map(g => g.id);
      const kept = current.order.filter(id => eligible.includes(id));
      const added = shuffleFeatured(games.filter(g => !kept.includes(g.id)));
      const order = [...kept, ...added];
      return { order, id: order.includes(current.id) ? current.id : order[0] };
    });
  }, [games]);
  useEffect(() => {
    try { if (hero) sessionStorage.setItem("utxoplay:last-featured", hero.id); } catch {}
  }, [hero?.id]);
  function nextFeatured() {
    setFeatured(current => {
      const index = current.order.indexOf(current.id);
      if (index < current.order.length - 1) return { ...current, id: current.order[index + 1] };
      const order = shuffleFeatured(games, current.id);
      return { order, id: order[0] };
    });
  }

  useEffect(() => {
    let live = true;
    setRemoteGame(null);
    if (!page.startsWith("/play/vendor-")) {
      setVendorLoading(false);
      return;
    }
    setVendorLoading(true);
    api("/api/games/" + page.slice(6))
      .then((d) => {
        if (live) setRemoteGame(d.game);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setVendorLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page, user?.id, revision]);
  function refreshCatalog() {
    setCatalogStatus({loading:true,error:""});
    api("/api/games")
      .then((d) => { setGames(d.games); setCatalogStatus({loading:false,error:""}); })
      .catch((e) => { setCatalogStatus({loading:false,error:apiError(e)}); notify(apiError(e), "error"); });
    setRevision((r) => r + 1);
  }
  const notify = useCallback(
    (text, type = "success") => setToast({ text, type, id: Date.now() }),
    [],
  );
  const loadAccount = useCallback(async () => {
    setLoadingUser(true);
    setAccountError("");
    const result = await auth.readAccount();
    if (result.stale) return;
    if (result.error) setAccountError(apiError(result.error));
    else setUser(result.data.user);
    setLoadingUser(false);
  }, [auth]);
  function exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  function go(p) {
    if (p === page) {
      setMobileNav(false);
      return;
    }
    exitFullscreen();
    history.pushState({}, "", p);
    setPage(p);
    setMobileNav(false);
    setDialog(null);
    setDetails(null);
    window.scrollTo({top:0,left:0,behavior:"instant"});
    setRevision((r) => r + 1);
  }
  const navigateRef = useRef(go);
  navigateRef.current = go;
  useEffect(() => {
    const onPop = () => {
      setPage(location.pathname);
      setMobileNav(false);
      setDialog(null);
      setDetails(null);
      setRevision((r) => r + 1);
      window.scrollTo({top:0,left:0,behavior:"instant"});
    };
    addEventListener("popstate", onPop);
    loadAccount();
    setCatalogStatus({loading:true,error:""});
    api("/api/games")
      .then((d) => { setGames(d.games); setCatalogStatus({loading:false,error:""}); })
      .catch((e) => setCatalogStatus({loading:false,error:apiError(e)}));
    return () => removeEventListener("popstate", onPop);
  }, [loadAccount]);
  useEffect(() => {
    document.title =
      (game
        ? game.title
        : page === "/library"
          ? "Your library"
          : page.startsWith("/community")
            ? "Player community"
          : page.startsWith("/creators/")
            ? "Creator collection"
          : page === "/items"
            ? "Item store"
          : page === "/developers"
            ? "Studio"
            : page === "/purchases"
              ? "Purchases"
              : "Good games. Yours to play.") + " · UTXOPlay";
    if (!page.startsWith("/play/")) exitFullscreen();
    mainRef.current?.focus({ preventScroll: true });
  }, [page, game?.title]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.type === "error" ? 10000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
    try {
      localStorage.setItem("utxoplay:motion", motionSetting);
    } catch {}
  }, [motionSetting, reduced]);
  useEffect(() => {
    const onKey = (e) => {
      if (
        e.defaultPrevented ||
        page.startsWith("/play/") ||
        dialog ||
        details ||
        isOpen ||
        e.target.closest("input,textarea,select,[contenteditable]")
      )
        return;
      if (
        (e.key === "/" && !e.ctrlKey && !e.metaKey) ||
        ((e.metaKey || e.ctrlKey) && e.key === "k")
      ) {
        e.preventDefault();
        if (page !== "/") navigateRef.current("/");
        requestAnimationFrame(() => {
          document.getElementById("collection")?.scrollIntoView({
            block: "start",
            behavior: reduced ? "instant" : "smooth",
          });
          searchRef.current?.focus({ preventScroll: true });
        });
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [page, dialog, details, isOpen, reduced]);
  // Revoke after any in-flight verification, before another wallet can sign in.
  useEffect(() => {
    if (previousSigner.current && previousSigner.current !== signer) {
      cancelSignature.current?.();
      setLoadingUser(false);
      setUser(null);
      setFrameKey((k) => k + 1);
      auth.logout().catch((e) => {
        setWalletError(apiError(e));
        notify(apiError(e), "error");
      });
    }
    previousSigner.current = signer;
  }, [signer, notify, auth]);
  async function signIn() {
    if (!signer || signing.current) return;
    const epoch = auth.invalidate();
    setLoadingUser(false);
    setAccountError("");
    signing.current = true;
    setWalletBusy(true);
    setWalletPhase("signature");
    setIntent(false);
    setWalletError("");
    setDialog("wallet");
    const cancellation = new Promise((_, reject) => {
      cancelSignature.current = () => reject(new Error("Sign-in cancelled."));
    });
    cancellation.catch(() => {});
    try {
      await auth.settled();
      if (!auth.current(epoch)) return;
      const address = await Promise.race([
        signer.getRecommendedAddress(),
        cancellation,
      ]);
      const challenge = await auth.challenge(epoch, address);
      if (!auth.current(epoch)) return;
      const proof = await Promise.race([
        signer.signMessage(challenge.message),
        cancellation,
      ]);
      if (!auth.current(epoch)) return;
      setWalletPhase("verifying");
      cancelSignature.current = null;
      const d = await auth.verify(epoch, { id: challenge.id, proof });
      if (!auth.current(epoch)) return;
      setUser(d.user);
      setDialog(null);
      setFrameKey((k) => k + 1);
      notify("You’re signed in. Your wallet library is ready.");
    } catch (e) {
      if (auth.current(epoch)) setWalletError(apiError(e));
    } finally {
      cancelSignature.current = null;
      setWalletBusy(false);
      setWalletPhase("idle");
      signing.current = false;
    }
  }
  useEffect(() => {
    if (intent && signer && !isOpen) void signIn();
  }, [intent, signer, isOpen]);
  useEffect(() => {
    if (isOpen) walletPickerSeen.current = true;
    else if (walletPickerSeen.current) {
      walletPickerSeen.current = false;
      if (!signer) {
        setIntent(false);
        setDialog("wallet");
      }
    }
  }, [isOpen, signer]);
  function connect() {
    setWalletError("");
    setDialog("wallet");
  }
  async function chooseWallet(change = false) {
    if (signer && !change) {
      void signIn();
      return;
    }
    setWalletBusy(true);
    setWalletError("");
    setWalletPhase("loading");
    try {
      const runtime = await prepareWallet();
      setIntent(true);
      flushSync(() => setDialog(null));
      runtime.open();
    } catch (e) {
      setIntent(false);
      setDialog("wallet");
      setWalletError(
        "Wallet tools could not load. Check your connection and try again.",
      );
    } finally {
      setWalletBusy(false);
      setWalletPhase("idle");
    }
  }
  async function logout() {
    setWalletBusy(true);
    setWalletPhase("logout");
    try {
      setIntent(false);
      cancelSignature.current?.();
      await auth.logout();
      previousSigner.current = null;
      setUser(null);
      setLoadingUser(false);
      setAccountError("");
      setWalletError("");
      setFrameKey((k) => k + 1);
      setDialog(null);
      go("/");
      const disconnected = await disconnectWallet(disconnect);
      notify(disconnected
        ? "Signed out. Your saved games are kept for your next visit."
        : "Signed out of UTXOPlay. Your wallet is still connected; disconnect it in your wallet if needed.");
    } catch (e) {
      setWalletError(apiError(e));
    } finally {
      setWalletBusy(false);
      setWalletPhase("idle");
    }
  }
  async function launch(id) {
    if (launchLock.current || loadingUser || walletBusy || isOpen) return;
    launchLock.current = true;
    setLaunching(id);
    try {
      if (!user) {
        const ticket = auth.invalidate();
        const result = await auth.guest(ticket);
        if (!auth.current(ticket)) return;
        setUser(result.user);
      }
      setDetails(null);
      go("/play/" + id);
    } catch (e) {
      notify(apiError(e), "error");
    } finally {
      setLaunching("");
      launchLock.current = false;
    }
  }
  async function copy(text, message = "Copied to clipboard.") {
    try {
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify(
        "Clipboard is unavailable. Select and copy the text instead.",
        "error",
      );
    }
  }
  function resetFilters() {
    setQuery("");
    setGenre("All games");
    setMode("all");
    setFreeOnly(false);
    searchRef.current?.focus();
  }
  const walletDisplay = walletButtonState({ user, loadingUser, walletBusy, walletPhase, isOpen, signer, walletError });
  const filtered = selectGames(games, { query, genre, mode, freeOnly });
  const navItems = [
    ["/", "Discover", Grid2X2],
    ["/library", "My library", Library],
    ["/items", "Item store", Sparkles],
    ["/community", "Community", Users],
    ["/purchases", "Purchases", Wallet],
    ["/developers", "Publishing studio", Code2],
  ];
  const navContent = (
    <>
      <nav aria-label="Main navigation">
        {navItems.map(([p, label, Icon]) => (
          <button
            key={p}
            aria-current={(page === p || p === "/community" && page.startsWith("/community/")) ? "page" : undefined}
            className={(page === p || p === "/community" && page.startsWith("/community/")) ? "selected" : ""}
            onClick={() => go(p)}
          >
            <Icon size={18} />
            {label}
            {p === "/library" && libraryGames.length > 0 && (
              <span className="count">{libraryGames.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="preference-link"
          onClick={() => {
            setMobileNav(false);
            setDialog("preferences");
          }}
        >
          <Settings2 size={15} />
          Display preferences
        </button>
      </div>
    </>
  );
  return (
    <StoreNavigation.Provider value={go}>
    <MotionConfig
      reducedMotion={reduced ? "always" : "user"}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={"app" + (activeGame ? " game-active" : "")}
        inert={isOpen ? true : undefined}
      >
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNav}
          >
            <Menu />
          </button>
          <button
            className="brand"
            onClick={() => go("/")}
            aria-label="UTXOPlay home"
          >
            <BrandIcon />
            <span>
              UTXO<span className="brand-light">Play</span>
            </span>
          </button>
          <div className="top-right">
            <button
              className="top-search icon-btn"
              aria-label="Search games"
              onClick={() => {
                go("/");
                requestAnimationFrame(() => {
                  document.getElementById("collection")?.scrollIntoView({
                    behavior: reduced ? "instant" : "smooth",
                  });
                  searchRef.current?.focus({ preventScroll: true });
                });
              }}
            >
              <Search size={18} />
            </button>
            <button
              className="wallet-button"
              data-state={walletDisplay.state}
              disabled={walletDisplay.busy}
              aria-busy={walletDisplay.busy}
              aria-label={walletDisplay.hint}
              title={walletDisplay.hint}
              onClick={connect}
            >
              <span className="wallet-glyph" aria-hidden="true">
                {walletDisplay.busy ? <Spinner /> : <Wallet size={18} strokeWidth={1.6} />}
              </span>
              <span className="wallet-label" aria-live="polite">{walletDisplay.label}</span>
              <span className="wallet-state-dot" aria-hidden="true" />
              <ChevronRight className="wallet-chevron" size={14} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="shell">
          <aside className="sidebar">{navContent}</aside>
          <main className="main" id="main" tabIndex={-1} ref={mainRef}>
            {!online && (
              <Notice>
                You’re offline. Reconnect to load games or save changes.
              </Notice>
            )}
            {accountError && (
              <Notice onRetry={loadAccount}>{accountError}</Notice>
            )}
            <Suspense
              fallback={
                <div className="empty" role="status">
                  <Spinner />
                  Opening your workspace…
                </div>
              }
            >
              {page === "/" ? (
                <>
                  <h1 className="sr-only">Discover games</h1>
                  <section
                    className={"hero " + hero.id}
                    aria-label="Featured game"
                    style={{ "--accent": hero.presentation?.accent }}
                  >
                    <AnimatePresence initial={false}>
                      <motion.img
                        key={hero.id}
                        className="hero-image"
                        src={hero.cover}
                        alt=""
                        initial={{ opacity: 0, scale: reduced ? 1 : 1.025 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45 }}
                      />
                    </AnimatePresence>
                    <div className="hero-shade" />
                    <div className="hero-content">
                      <span className="pill">
                        <Sparkles size={12} />
                        FEATURED · {hero.genre}
                      </span>
                      <motion.div
                        key={hero.id}
                        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <h2>{hero.title}</h2>
                        <p className="hero-description">{hero.subtitle}</p>
                      </motion.div>
                      <div className="hero-actions">
                        <button
                          className="primary"
                          disabled={!!launching || loadingUser}
                          onClick={() => launch(hero.id)}
                        >
                          {launching === hero.id ? (
                            <Spinner />
                          ) : (
                            <Play size={17} fill="currentColor" />
                          )}
                          {launching === hero.id
                            ? "Opening…"
                            : "Play " + hero.title}
                          <ArrowUpRight size={17} />
                        </button>
                        <button
                          className="hero-details"
                          onClick={() => setDetails(hero)}
                        >
                          Details <ArrowRight size={17} />
                        </button>
                      </div>
                      <div className="hero-trust">
                        <span>
                          <Check size={13} />
                          Free to play
                        </span>
                        <span>
                          <Check size={13} />
                          No wallet required
                        </span>
                      </div>
                    </div>
                    <div className="hero-bottom">
                      <span className="hero-caption">
                        {hero.myelin?.based && <span className="myelin-badge"><img src="/assets/myelin-logo.png?v=0.7.1" alt="" />MYELIN</span>}
                      </span>
                      <span className="hero-index">
                        {String(featured.order.indexOf(hero.id) + 1).padStart(2, '0')}
                        <i> / {String(featuredGames.length).padStart(2, '0')}</i>
                      </span>
                      <button
                        className="hero-next icon-btn"
                        aria-label="Next featured game"
                        onClick={nextFeatured}
                      >
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </section>
                  {libraryGames.length > 0 && (
                    <section className="recent-strip">
                      <div>
                        <h2>Continue playing</h2>
                      </div>
                      <button
                        className="recent-game"
                        onClick={() => launch(libraryGames[0].id)}
                        disabled={!!launching}
                      >
                        <img src={libraryGames[0].cover} alt="" />
                        <span>
                          <strong>{libraryGames[0].title}</strong>
                          <small>{libraryGames[0].presentation?.length}</small>
                        </span>
                        <Play size={18} fill="currentColor" />
                      </button>
                      <button
                        className="text-link"
                        onClick={() => go("/library")}
                      >
                        Your library <ArrowRight size={15} />
                      </button>
                    </section>
                  )}
                  <section className="collection" id="collection">
                    <div className="section-head">
                      <div>
                        <h2>Browse games</h2>
                      </div>
                      <label className="search">
                        <Search size={18} />
                        <input
                          ref={searchRef}
                          aria-label="Search games"
                          placeholder="Search games"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {query ? (
                          <button
                            onClick={() => {
                              setQuery("");
                              searchRef.current?.focus();
                            }}
                            aria-label="Clear search"
                          >
                            <X size={16} />
                          </button>
                        ) : (
                          <kbd>/</kbd>
                        )}
                      </label>
                    </div>
                    <div className="filter-row">
                      <div
                        className="genre-filters"
                        role="group"
                        aria-label="Filter by genre"
                      >
                        {genres.map((g) => (
                          <button
                            key={g}
                            aria-pressed={genre === g}
                            className={genre === g ? "active" : ""}
                            onClick={() => setGenre(g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                      <button
                        className={"free-filter " + (freeOnly ? "active" : "")}
                        aria-pressed={freeOnly}
                        onClick={() => setFreeOnly((v) => !v)}
                      >
                        Free to play
                      </button>
                      <label className="mode-select">
                        <Users size={15} />
                        <span className="sr-only">Play style</span>
                        <select
                          aria-label="Play style"
                          value={mode}
                          onChange={(e) => setMode(e.target.value)}
                        >
                          <option value="all">Any play style</option>
                          <option value="solo">Play solo</option>
                          <option value="friends">With a friend</option>
                        </select>
                      </label>
                      <span className="results" role="status">
                        {filtered.length}{" "}
                        {filtered.length === 1 ? "game" : "games"}
                      </span>
                    </div>
                    <div className="game-grid">
                      {filtered.map((g) => (
                        <GameCard
                          key={g.id}
                          g={g}
                          onPlay={launch}
                          onDetails={setDetails}
                          launching={launching}
                        />
                      ))}
                    </div>
                    {!filtered.length && (
                      <div className="empty">
                        <Search size={32} />
                        <h3>No matches. Plenty to play.</h3>
                        <p>
                          Try another search or clear your filters to see all{" "}
                          {games.length} games.
                        </p>
                        <button className="outline" onClick={resetFilters}>
                          Clear filters <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                </>
              ) : page === "/library" ? (
                <>
                  <PageHeading
                    eyebrow="YOUR PERSONAL PLAYGROUND"
                    title="Welcome back to play."
                    description={
                      signedIn
                        ? "Your wallet library. Ready whenever you are."
                        : "Your guest library lives in this browser. Make yourself at home."
                    }
                  />
                  <div className="library-summary">
                    <div className="identity-orb">
                      <Library size={24} />
                    </div>
                    <div>
                      <strong>
                        {signedIn
                          ? short(user.address)
                          : "Your guest collection"}
                      </strong>
                      <p>
                        {libraryGames.length} games played ·{" "}
                        {signedIn
                          ? "Available when you sign in on another device"
                          : "Keep this browser’s cookies to keep access"}
                      </p>
                    </div>
                    <button className="outline" onClick={connect}>
                      {signedIn ? "Account details" : "Connect a wallet"}
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {libraryState.error ? (
                    <Notice onRetry={() => setRevision((r) => r + 1)}>
                      {libraryState.error}
                    </Notice>
                  ) : loadingUser || libraryState.loading ? (
                    <Skeletons />
                  ) : libraryGames.length ? (
                    <div className="game-grid library-grid">
                      {libraryGames.map((g) => (
                        <GameCard
                          key={g.id}
                          g={g}
                          updated={g.updated}
                          onPlay={launch}
                          onDetails={setDetails}
                          launching={launching}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty collection-empty">
                      <Gamepad2 size={42} />
                      <h2>Every library starts with a first game.</h2>
                      <p>
                        Play something you like. It will be waiting right here.
                      </p>
                      <button className="primary" onClick={() => go("/")}>
                        Find a game <ArrowRight size={17} />
                      </button>
                    </div>
                  )}
                  {!signedIn && (
                    <p className="library-note">
                      <ShieldCheck size={16} />
                      Wallet and guest libraries are separate. Signing in won’t
                      move your guest progress.
                    </p>
                  )}
                </>
              ) : page.startsWith("/creators/") ? (
                <CreatorCollection key={page} loading={catalogStatus.loading} error={catalogStatus.error} onRetry={refreshCatalog} games={games} role={page.split("/")[2]} gameId={page.split("/")[3]} onPlay={launch} onDetails={setDetails} launching={launching}/>
              ) : page === "/community" || page.startsWith("/community/") ? (
                <CommunityPage games={featuredGames} gameId={page.split("/")[2]} user={user} onConnect={connect} onPlay={launch} onChoose={id=>go("/community/"+id)}/>
              ) : page === "/items" ? (
                <ItemStore user={user} onConnect={connect} onOpen={id=>{try{sessionStorage.setItem("utxoplay:open-items",id);}catch{}launch(id);}}/>
              ) : page === "/developers" ? (
                <Studio
                  key={user?.id || "anonymous"}
                  user={user}
                  onConnect={connect}
                  onCatalogChange={refreshCatalog}
                />
              ) : page === "/purchases" ? (
                <Purchases
                  key={user?.id || "anonymous"}
                  user={user}
                  signer={signer}
                  onConnect={connect}
                  onPlay={launch}
                />
              ) : game?.vendor ? (
                <>
                  <button className="back" onClick={() => go("/")}>
                    <ArrowLeft size={16} />
                    Store
                  </button>
                  <VendorPlay
                    key={game.id + ":" + (user?.id || "anonymous")}
                    game={game}
                    user={user}
                    signer={signer}
                    onConnect={connect}
                    onRefresh={() => setRevision((r) => r + 1)}
                    onStartGuest={() => launch(game.id)}
                  />
                </>
              ) : vendorLoading ? (
                <div className="empty" role="status">
                  <Spinner />
                  Opening game…
                </div>
              ) : game ? (
                <>
                  <div className="play-heading">
                    <button onClick={() => go("/")} className="back">
                      <ArrowLeft size={16} />
                      Store
                    </button>
                    <span className="play-divider">/</span>
                    <span>{game.title}</span>
                  </div>
                  <div className="play-title">
                    <div>
                      <div className="eyebrow">
                        {game.genre}
                        <span>·</span>
                        {game.players}
                      </div>
                      <h1>{game.title}</h1>
                    </div>
                    <span className="save-indicator">
                      <i />
                      {loadingUser
                        ? "Checking account"
                        : signedIn
                          ? "Wallet library"
                          : user
                            ? "Guest library"
                            : "Free to play"}
                    </span>
                  </div>
                  {loadingUser ? (
                    <div className="launch-placeholder" role="status">
                      <Spinner />
                      <h2>Getting your playground ready…</h2>
                    </div>
                  ) : user ? (
                    <GameFrame key={game.id+":"+user.id+":"+frameKey} game={game}/>
                  ) : (
                    <div
                      className="launch-placeholder"
                      style={{ "--launch-cover": `url(${game.cover})` }}
                    >
                      <div>
                        <span className="pill">FREE · IN YOUR BROWSER</span>
                        <h2>Your next round is waiting.</h2>
                        <p>
                          Play as a guest, or connect a wallet to open your
                          library.
                        </p>
                        <button
                          className="primary"
                          disabled={!!launching}
                          onClick={() => launch(game.id)}
                        >
                          {launching ? <Spinner /> : <Play size={17} />}Play as
                          a guest <ArrowRight size={17} />
                        </button>
                        <button className="text-link" onClick={connect}>
                          Connect a wallet instead <Wallet size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="play-info">
                    <div>
                      <Gamepad2 size={21} />
                      <h3>Find your rhythm.</h3>
                      <p>{game.controls}</p>
                    </div>
                    <div>
                      <ShieldCheck size={21} />
                      <h3>A round worth keeping.</h3>
                      <p>
                        {game.replayDescription}
                      </p>
                      <p>
                        {signedIn
                          ? "Sign back in with this wallet to return to your library."
                          : "Guest saves belong to this browser. Wallet accounts have a separate library."}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty">
                  <Gamepad2 size={38} />
                  <h1>
                    {page.startsWith("/play/vendor-")
                      ? "This game isn’t currently listed."
                      : "This page took a wrong turn."}
                  </h1>
                  <p>
                    {page.startsWith("/play/vendor-")
                      ? "If you already own it, sign in with your purchasing wallet and open your library."
                      : "There are better adventures in the store."}
                  </p>
                  {page.startsWith("/play/vendor-") && !signedIn && (
                    <button className="outline" onClick={connect}>
                      Connect purchasing wallet
                    </button>
                  )}
                  <button className="primary" onClick={() => go("/")}>
                    Back to the playground <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </Suspense>
            <footer className="footer">
              <nav aria-label="Footer navigation">
                <a
                  href="https://github.com/UTXOPlay/UTXOPlay"
                  target="_blank"
                  rel="noreferrer"
                >
                  Source <ArrowUpRight size={12} />
                </a>
                <a href="/about.html">About</a>
                <a href="/privacy.html">Privacy</a>
              </nav>
              <span>© {new Date().getFullYear()} UTXOPlay</span>
            </footer>
          </main>
        </div>
        {isOpen && (
          <WalletPickerGuard
            onClose={() => {
              setIntent(false);
              closePicker();
            }}
          />
        )}
        {mobileNav && (
          <Modal
            title="Navigation"
            onClose={() => setMobileNav(false)}
            className="mobile-drawer"
          >
            {navContent}
          </Modal>
        )}
        {details && (
          <GameDetails
            game={details}
            onCommunity={id=>{setDetails(null);go("/community/"+id);}}
            onClose={() => setDetails(null)}
            onPlay={launch}
            launching={launching}
          />
        )}
        {dialog === "wallet" && (
          <Modal
            title="Wallet account"
            onClose={() => {
              if (!walletBusy || walletPhase === "signature") {
                if (walletBusy) {
                  auth.invalidate();
                  cancelSignature.current?.();
                }
                setDialog(null);
                setIntent(false);
              }
            }}
            dismissible={!walletBusy || walletPhase === "signature"}
            className="wallet-modal"
          >
            <div className="modal-icon">
              <BrandIcon />
            </div>
            <div className="eyebrow">YOUR KEY TO THE PLAYGROUND</div>
            <h2>
              {signedIn ? "You’re right at home." : "One wallet. More play."}
            </h2>
            {signedIn ? (
              <>
                <p>
                  Your CKB account is signed in. Your library is ready on any
                  device you sign in from.
                </p>
                <UsernameEditor key={user.id} user={user} onSaved={username=>setUser(current=>current?.id===user.id?{...current,username}:current)}/>
                <div className="address">{user.address}</div>
                <button
                  className="text-link copy-address"
                  onClick={() => copy(user.address, "Wallet address copied.")}
                >
                  <Copy size={15} />
                  Copy address
                </button>
                <button
                  className="primary full"
                  onClick={() => {
                    setDialog(null);
                    go("/library");
                  }}
                >
                  Open my library <ArrowRight size={17} />
                </button>
                <button
                  className="text-button"
                  disabled={walletBusy}
                  onClick={logout}
                >
                  {walletBusy ? <Spinner /> : <LogOut size={15} />}Sign out
                </button>
              </>
            ) : (
              <>
                <p>
                  Choose a wallet and sign a login message. No funds needed, and
                  nothing to buy.
                </p>
                <div className="wallet-steps">
                  <span className={walletBusy || signer ? "done" : ""}>
                    <b>{signer ? <Check size={13} /> : 1}</b>Choose wallet
                  </span>
                  <i />
                  <span className={walletBusy ? "current" : ""}>
                    <b>2</b>Sign in
                  </span>
                </div>
                <div className="wallet-list">
                  <span>JoyID</span>
                  <span>UTXO Global</span>
                  <span>UniSat</span>
                  <span>OKX</span>
                </div>
                <button
                  className="primary full"
                  disabled={walletBusy}
                  onClick={() => chooseWallet()}
                >
                  {walletBusy ? <Spinner /> : <Wallet size={17} />}
                  <span>
                    {walletBusy
                      ? walletPhase === "loading"
                        ? "Loading wallet tools…"
                        : walletPhase === "verifying"
                          ? "Verifying your signature…"
                          : "Confirm in your wallet…"
                      : signer
                        ? "Sign in with " + (wallet?.name || "wallet")
                        : "Choose a wallet"}
                  </span>
                  {!walletBusy && <ArrowUpRight size={17} />}
                </button>
                {signer && !walletBusy && (
                  <button
                    className="text-button"
                    onClick={() => chooseWallet(true)}
                  >
                    Choose another wallet
                  </button>
                )}
                <div className="modal-note">
                  <ShieldCheck size={16} />
                  <span>A login signature only. No transactions.</span>
                </div>
                <p className="fine">
                  CKB mainnet · Available choices depend on your installed
                  wallets. Wallet and guest libraries stay separate.
                </p>
              </>
            )}
            {walletError && <Notice>{walletError}</Notice>}
          </Modal>
        )}
        {dialog === "preferences" && (
          <Modal title="Display preferences" onClose={() => setDialog(null)}>
            <div className="modal-icon">
              <Settings2 />
            </div>
            <div className="eyebrow">MAKE YOURSELF COMFORTABLE</div>
            <h2>Comfort meets performance.</h2>
            <p>
              Keep the little transitions, or make the store a quieter place.
            </p>
            <fieldset className="motion-options">
              <legend className="sr-only">Animation preference</legend>
              {[
                [
                  "system",
                  "Follow your device",
                  "Subtle transitions. Respects your system’s reduced-motion setting.",
                ],
                [
                  "reduced",
                  "Reduce motion",
                  "No moving backgrounds or sliding transitions.",
                ],
              ].map(([v, label, desc]) => (
                <label key={v}>
                  <input
                    type="radio"
                    name="motion"
                    value={v}
                    checked={motionSetting === v}
                    onChange={() => setMotionSetting(v)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{desc}</small>
                  </span>
                  {motionSetting === v && <Check size={18} />}
                </label>
              ))}
            </fieldset>
            <fieldset className="motion-options">
              <legend>Game graphics</legend>
              {[
                [
                  "auto",
                  "Adaptive · recommended",
                  "Balances sharpness and smooth play on your device.",
                ],
                [
                  "high",
                  "High detail",
                  "Sharper rendering on high-density screens.",
                ],
                [
                  "low",
                  "Performance",
                  "Lower rendering resolution for lighter GPU use.",
                ],
              ].map(([value, label, description]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="quality"
                    value={value}
                    checked={quality === value}
                    onChange={() => {
                      setQuality(value);
                      try {
                        localStorage.setItem("utxoplay:quality", value);
                      } catch {}
                      window.dispatchEvent(new Event("utxoplay:quality"));
                    }}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  {quality === value && <Check size={18} />}
                </label>
              ))}
            </fieldset>
            <p className="fine">
              Saved on this browser. Motion applies to the store. Games also
              provide their own rendering controls.
            </p>
          </Modal>
        )}
        <AnimatePresence>
          {toast && !activeGame && (
            <motion.div
              className={"toast " + toast.type}
              role={toast.type === "error" ? "alert" : "status"}
              key={toast.id}
              initial={{ opacity: 0, y: reduced ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            >
              {toast.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <WifiOff size={18} />
              )}
              <span>{toast.text}</span>
              <button
                className="icon-btn"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
              >
                <X size={17} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
    </StoreNavigation.Provider>
  );
}
createRoot(document.getElementById("root")).render(<Root />);
