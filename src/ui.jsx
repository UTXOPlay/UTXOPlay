import React, { useEffect, useRef, useId, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  X,
  Copy,
  Check,
  ArrowUpRight,
  Play,
  Users,
  Clock,
  Gamepad2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { creatorHref } from "./ui-model.mjs";
export function BrandIcon({ className = "" }) {
  return (
    <img
      className={"utxoplay-mark " + className}
      src="/brand/utxoplay-logo-dark-96.webp"
      srcSet="/brand/utxoplay-logo-dark-96.webp 1x, /brand/utxoplay-logo-dark-192.webp 2x"
      width="40"
      height="40"
      alt=""
    />
  );
}
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
export function Modal({
  title,
  onClose,
  children,
  className = "",
  dismissible = true,
}) {
  const ref = useRef(null),
    titleId = useId(),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current,
      previous = document.activeElement;
    el.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = prior;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      className={"modal " + className}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <h2 id={titleId} className="sr-only">
        {title}
      </h2>
      <button
        type="button"
        className="modal-close icon-btn"
        disabled={!dismissible}
        onClick={onClose}
        aria-label={"Close " + title}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>,
    document.body,
  );
}
export function Notice({ children, onRetry }) {
  return (
    <div className="notice" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
      {onRetry && (
        <button onClick={onRetry}>
          <RefreshCw size={15} />
          Retry
        </button>
      )}
    </div>
  );
}
export function Skeletons() {
  return (
    <div
      className="game-grid skeleton-grid"
      aria-label="Loading games"
      role="status"
    >
      {[0, 1].map((i) => (
        <div className="skeleton-card" key={i}>
          <span />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}
export function MyelinBadge({ game }) {
  return game.myelin?.based ? <span className="myelin-badge" title="Myelin host replay. Off-chain; no CKB settlement."><img src="/assets/myelin-logo.png?v=0.7.1" alt="" />MYELIN</span> : null;
}
export const StoreNavigation = createContext(null);
export function StoreLink({ href, children, ...props }) {
  const navigate = useContext(StoreNavigation);
  return <a href={href} {...props} onClick={event => {
    if (navigate && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate(href);
    }
  }}>{children}</a>;
}
export function CreditWallet({ person, role }) {
  const [copied, setCopied] = useState("");
  useEffect(() => setCopied(""), [person?.address]);
  if (!person?.address) return <span className="credit-unknown">Wallet not provided</span>;
  const address = person.address;
  return <details className="credit-wallet">
    <summary>CKB wallet <span>{address.slice(0, 9)}…{address.slice(-6)}</span></summary>
    <div className="credit-address"><code>{address}</code><button type="button" className="icon-btn" aria-label={"Copy " + role.toLowerCase() + " wallet address"} onClick={async () => {
      try { await navigator.clipboard.writeText(address); setCopied("Copied"); }
      catch { setCopied("Select the address to copy it manually."); }
    }}>{copied === "Copied" ? <Check size={16}/> : <Copy size={16}/>}</button></div>
    <span role="status" className="fine">{copied}</span>
  </details>;
}
export function GameCredits({ game, compact = false, linked = true }) {
  const roles = [["Developer", game.developer], ["Publisher", game.publisher]];
  if (!compact && game.portedBy) roles.push(["Port & Myelin integration", game.portedBy]);
  return <dl className={compact ? "credit-byline" : "game-credits"} aria-label="Game credits">
    {roles.map(([role, person]) => <div key={role} className="game-credit">
      <dt>{role}</dt><dd><strong>{linked && creatorHref(game, role.toLowerCase()) ? <StoreLink className="credit-name" href={creatorHref(game, role.toLowerCase())} title={"Explore games · " + person.name + " · " + role}>{person.name}</StoreLink> : person?.name || "Not specified"}</strong>
        {!compact && <><CreditWallet person={person} role={role}/>{person?.sourceUrl && <a className="credit-source" href={person.sourceUrl} target="_blank" rel="noopener noreferrer">Original project <ArrowUpRight size={13}/></a>}</>}
      </dd>
    </div>)}
  </dl>;
}
export function GameCard({ g, onPlay, onDetails, launching, updated }) {
  const meta = g.presentation || { accent: "#8bf4b9", length: "Publisher hosted" };
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={"game-card " + g.id}
      style={{ "--accent": meta.accent }}
    >
      <button className="card-overview" onClick={() => onDetails(g)} aria-label={"View " + g.title + " details"}>
        <span className="cover-button">
          <img src={g.cover} alt="" loading="lazy" />
          <span className="card-badge">{g.genre}</span>
          <MyelinBadge game={g} />
          <span className="card-explore">Details <ArrowUpRight size={17} /></span>
        </span>
        <span className="game-card-info">
          <span className="card-copy">
            <span className="card-title" role="heading" aria-level="3">{g.title}</span>
            <span className="card-subtitle">{g.subtitle}</span>
          </span>
          <span className={"price" + (g.pricing !== "paid" ? " price-free" : "")}>
            {g.pricing === "paid" ? g.priceCkb + " CKB" : "FREE"}
          </span>
        </span>
      </button>
      <GameCredits game={g} compact />
      <div className="card-meta">
        <span>
          <Users size={14} />
          {g.players}
        </span>
        <span>
          <Clock size={14} />
          {meta.length}
        </span>
      </div>
      <div className="card-actions">
        <button
          className="card-launch"
          disabled={!!launching}
          onClick={() => onPlay(g.id)}
        >
          {launching === g.id ? (
            <Spinner />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
          {launching === g.id
            ? "Opening…"
            : updated
              ? "Play again"
              : g.pricing === "paid"
                ? "View & buy"
                : "Play now"}
          <ArrowUpRight size={15} />
        </button>
      </div>
      {updated && (
        <p className="last-played">
          <Clock size={12} />
          Last played{" "}
          {new Date(updated).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      )}
    </motion.article>
  );
}
export function GameDetails({ game, onClose, onPlay, launching, onCommunity }) {
  const meta = game.presentation || {
    tag: "INDEPENDENT / MYELIN",
    length: "Publisher hosted",
    input: "See controls",
    note: "Opens on the publisher’s website: " + game.host,
  };
  return (
    <Modal
      title={game.title + " details"}
      onClose={onClose}
      className="game-detail"
    >
      <div className={"detail-art " + game.id}>
        <img src={game.cover} alt="" />
        <span>{meta.tag}</span>
      </div>
      <div className="detail-copy">
        <div className="eyebrow">
          {game.genre} <span>·</span>{" "}
          {game.pricing === "paid"
            ? game.priceCkb + " CKB · BUY ONCE"
            : "FREE TO PLAY"}
        </div>
        <h2>{game.title}</h2>
        <MyelinBadge game={game} />
        <p>{game.description}</p>
        <div className="detail-facts">
          <span>
            <Users />
            {game.players}
          </span>
          <span>
            <Clock />
            {meta.length}
          </span>
          <span>
            <Gamepad2 />
            {meta.input}
          </span>
        </div>
        <GameCredits game={game} />
        <div className="control-note">
          <h3>Before you jump in</h3>
          <p>{meta.note}</p>
          <p>{game.controls}</p>
        </div>
        <button
          className="primary full"
          disabled={!!launching}
          onClick={() => onPlay(game.id)}
        >
          {launching === game.id ? (
            <Spinner />
          ) : (
            <Play size={17} fill="currentColor" />
          )}
          {launching === game.id ? "Opening your game…" : "Play " + game.title}
          <ArrowUpRight size={17} />
        </button>
        {!game.vendor&&onCommunity&&<button className="outline full" style={{marginTop:12}} onClick={()=>onCommunity(game.id)}>Player reviews & community <ArrowUpRight size={17}/></button>}
        <p className="fine centered">
          {game.pricing === "paid"
            ? "Wallet purchase required. Review price and publisher details before paying."
            : "No download. No deposit. A guest session is all you need."}
        </p>
      </div>
    </Modal>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="tiny-line" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

// CCC uses nested shadow roots. Keep its keyboard navigation inside the picker.
export function WalletPickerGuard({ onClose }) {
  const button = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    button.current?.focus();
    function controls(root) {
      return [...root.children].flatMap((el) => {
        if (el.hidden || getComputedStyle(el).display === "none") return [];
        const own =
          el.matches(
            'button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
          ) && el.getClientRects().length
            ? [el]
            : [];
        return [
          ...own,
          ...controls(el),
          ...(el.shadowRoot ? controls(el.shadowRoot) : []),
        ];
      });
    }
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const connector = document.querySelector("ccc-connector");
      const items = [
        button.current,
        ...(connector ? controls(connector.shadowRoot || connector) : []),
      ].filter(Boolean);
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement)
        active = active.shadowRoot.activeElement;
      const i = items.indexOf(active),
        next = (i + (e.shiftKey ? -1 : 1) + items.length) % items.length;
      e.preventDefault();
      items[next]?.focus();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.body.style.overflow = overflow;
      if (before?.isConnected) before.focus();
    };
  }, []);
  return createPortal(
    <button ref={button} className="wallet-picker-close" onClick={onClose}>
      <X size={18} />
      Cancel wallet selection
    </button>,
    document.body,
  );
}
