import {canonicalGamePath} from '../shared/game-paths.mjs';
import React, { useEffect, useState, useRef } from "react";
import "./marketplace.css";
import {sameDraft, reconcileSavedDraft, creditChanges, missingCreditNames} from "./publishing-model.mjs";
const loadCcc = () => import("@ckb-ccc/connector-react").then((m) => m.ccc);
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  Server,
  Gift,
  Wallet,
  RefreshCw,
  Copy,
  KeyRound,
  Receipt,
  ExternalLink,
  ChevronLeft,
  Code2,
  ShieldCheck,
} from "lucide-react";
import { Modal, Notice, Spinner, PageHeading, GameCredits } from "./ui.jsx";
import { formatCkb, parsePrice, splitPrice } from "../shared/pricing.mjs";
export async function marketApi(url, body) {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Unable to complete this action.");
  return d;
}
const emptyDraft = {
  title: "",
  description: "",
  gameUrl: "",
  runtimeUrl: "",
  version: "1.0.0",
  genre: "Arcade",
  players: "Single player",
  controls: "",
  pricing: "free",
  priceCkb: "",
  payoutAddress: "",
  developerName: "",
  developerAddress: "",
  developerSourceUrl: "",
  publisherName: "",
  supportUrl: "",
  refundUrl: "",
};
const money = (v) => formatCkb(v || "0");
const humanStatus = (s) =>
  ({
    created: "Ready to review",
    prepared: "Transaction reserved",
    pending: "Waiting for payment",
    confirming: "Confirming on CKB",
    confirmed: "Purchased",
    rejected: "Transaction rejected",
    cancelled: "Cancelled",
  })[s] || s;
async function copyText(text, set) {
  try {
    await navigator.clipboard.writeText(text);
    set("Copied.");
  } catch {
    set("Select the text and copy it manually.");
  }
}
export function Studio({ user, onConnect, onCatalogChange }) {
  const [projects, setProjects] = useState([]),
    [sales, setSales] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [editor, setEditor] = useState(null),
    [tab, setTab] = useState("projects"),
    [config, setConfig] = useState(null);
  const signed = !!user && !user.guest;
  async function refresh() {
    if (!signed) return;
    setLoading(true);
    setError("");
    try {
      const [p, s] = await Promise.all([
        marketApi("/api/developer/projects"),
        marketApi("/api/developer/sales"),
      ]);
      setProjects(p.projects);
      setSales(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setProjects([]);
    setSales(null);
    void refresh();
    marketApi("/api/commerce/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, [user?.id]);
  function done() {
    setEditor(null);
    void refresh();
    onCatalogChange();
  }
  return (
    <>
      <PageHeading
        eyebrow="UTXOPLAY / STUDIO"
        title="Publishing studio"
        description="Host your Myelin game. No listing fee. Keep 80% of paid sales."
      >
        <button className="primary" onClick={() => (signed ? setEditor({ new: true }) : onConnect())}>
          <Plus size={17} /> Publish a game
        </button>
      </PageHeading>
      <div className="publish-steps">
        <div>
          <b>01</b>
          <strong>Make it yours</strong>
          <p>Add the game, its controls and your hosted Myelin address.</p>
        </div>
        <div>
          <b>02</b>
          <strong>Connect your instance</strong>
          <p>Install the launch adapter and check the connection.</p>
        </div>
        <div>
          <b>03</b>
          <strong>Choose free or paid</strong>
          <p>Free by default. Paid access uses a direct 20 / 80 CKB split.</p>
        </div>
      </div>
      <div className="studio-toolbar">
        <div className="genre-filters">
          <button
            className={tab === "projects" ? "active" : ""}
            onClick={() => setTab("projects")}
          >
            Games {projects.length}
          </button>
          <button
            className={tab === "sales" ? "active" : ""}
            onClick={() => setTab("sales")}
          >
            Sales & receipts
          </button>
        </div>
        <a className="text-link" href="/publishing.html">
          Hosting & publishing guide <ArrowUpRight size={15} />
        </a>
      </div>
      {error && <Notice onRetry={refresh}>{error}</Notice>}
      {!signed ? (
        <div className="empty">
          <Code2 size={36} />
          <h2>Your first players are one connection away.</h2>
          <p>
            Connect your wallet to save a draft and publish. Free games need no
            payment or deposit.
          </p>
          <button className="primary" onClick={onConnect}>
            <Wallet size={17} />
            Connect to Studio
          </button>
        </div>
      ) : loading ? (
        <div className="empty" role="status">
          <Spinner />
          Loading your workspace…
        </div>
      ) : tab === "sales" ? (
        <>
          <div className="sales-summary">
            <span>CONFIRMED VENDOR REVENUE</span>
            <strong>
              {sales?.vendorCkb || "0"} <small>CKB</small>
            </strong>
            <p>
              Your 80% goes directly to the receive address saved with each
              sale. There is no Store withdrawal balance.
            </p>
          </div>
          {sales?.sales.length ? (
            <div className="receipt-list">
              {sales.sales.map((o) => (
                <ReceiptRow key={o.id} order={o} vendor />
              ))}
            </div>
          ) : (
            <div className="empty compact">
              <Receipt />
              <h3>Your sales will appear here.</h3>
              <p>Free launches have no charge and no revenue split.</p>
            </div>
          )}
        </>
      ) : projects.length ? (
        <div className="publisher-projects">
          {projects.map((p) => (
            <article key={p.id}>
              <div className="project-heading">
                <div>
                  <span className={"state-badge " + p.status}>{p.status}</span>
                  <h2>{(p.live || p.draft).title}</h2>
                  <p>
                    {(p.live || p.draft).pricing === "free"
                      ? "Free to play · No listing fee"
                      : (p.live || p.draft).priceCkb
                        ? `${(p.live || p.draft).priceCkb} CKB · You keep 80%`
                        : "Paid draft · Set a price"}
                  </p>
                </div>
                <Server size={25} />
              </div>
              <GameCredits game={p.liveCredits || p} compact linked={false}/>
              {p.live && !sameDraft(p.live, p.draft) && (
                <p className="fine">
                  Saved draft changes · Republish to update the live game
                </p>
              )}
              <p className="instance-host">
                {(p.live || p.draft).runtimeUrl ||
                  "Add your hosted Myelin instance"}
              </p>
              <div className="project-progress">
                <span className={p.keyConfigured ? "done" : ""}>
                  {p.keyConfigured ? (
                    <Check size={14} />
                  ) : (
                    <KeyRound size={14} />
                  )}
                  Launch key
                </span>
                <span
                  className={p.checkedRevision === p.revision ? "done" : ""}
                >
                  {p.checkedRevision === p.revision ? (
                    <Check size={14} />
                  ) : (
                    <Globe size={14} />
                  )}
                  Connection check
                </span>
              </div>
              <div className="project-actions">
                <button className="primary" onClick={() => setEditor(p)}>
                  {p.status === "published" ? "Manage game" : "Continue setup"}
                  <ArrowRight size={15} />
                </button>
                {p.live && (
                  <a className="text-link" href={canonicalGamePath("vendor-" + p.id)}>
                    View game <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Gift size={36} />
          <h2>No games published yet.</h2>
          <p>Choose “Publish a game” above to create your first listing.</p>
        </div>
      )}
      {editor && (
        <ProjectEditor
          initial={editor}
          user={user}
          config={config}
          onClose={() => {
            setEditor(null);
            void refresh();
          }}
          onDone={done}
        />
      )}
    </>
  );
}
function ProjectEditor({ initial, user, config, onClose, onDone }) {
  const [project, setProject] = useState(initial.new ? null : initial),
    [draft, setDraft] = useState(
      { ...emptyDraft, payoutAddress: user.address || "", publisherName: user.username || "", ...initial.draft },
    ),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [key, setKey] = useState(""),
    [rotate, setRotate] = useState(false),
    [price, setPrice] = useState(null),
    [unlist, setUnlist] = useState(false);
  const [discard, setDiscard] = useState(false);
  const savedDraft = useRef({ ...emptyDraft, payoutAddress: user.address || "", publisherName: user.username || "", ...initial.draft });
  const busyRef=useRef(false), [creditValidation,setCreditValidation]=useState(false);
  const changes=creditChanges(project?.live,draft), missing=missingCreditNames(draft);
  function requestClose() {
    if (!sameDraft(draft, savedDraft.current)) setDiscard(true);
    else onClose();
  }
  const formRef = useRef(null);
  useEffect(() => {
    if (creditValidation && step === 0)
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [creditValidation, step]);
  const field = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setNotice("");
    setPrice(null);
  };
  async function save() {
    const submitted=draft;
    const p = await marketApi(
      project
        ? `/api/developer/projects/${project.id}/save`
        : "/api/developer/projects",
      project ? { revision: project.revision, draft } : draft,
    );
    setProject(p);
    savedDraft.current = p.draft;
    setDraft(current=>reconcileSavedDraft(current,submitted,p.draft));
    return p;
  }
  async function action(name, fn) {
    if (busyRef.current) return;
    busyRef.current=true;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current=false;
      setBusy("");
    }
  }
  function next() {
    if (!formRef.current.reportValidity()) return;
    void action("Saving draft", async () => {
      await save();
      setStep(Math.min(2, step + 1));
      setNotice("Draft saved.");
    });
  }
  let split;
  try {
    split = splitPrice(parsePrice(draft.priceCkb));
  } catch {}
  const setup = project
    ? `UTXOPLAY_STORE_ORIGIN=https://store.utxoplay.io\nUTXOPLAY_PROJECT_ID=${project.id}\nUTXOPLAY_VERIFICATION_TOKEN=${project.verificationToken}\nUTXOPLAY_VENDOR_KEY=${key || "<your server-only launch key>"}\nVENDOR_PUBLIC_ORIGIN=${draft.runtimeUrl || "https://play.your-domain.com"}\nVENDOR_GAME_URL=${draft.gameUrl || "https://play.your-domain.com/game/"}\nMYELIN_RUNTIME_URL=http://127.0.0.1:8781\nMYELIN_RUNTIME_TOKEN=<your private runtime token>\nMYELIN_VERSION=<your deployed version>\nVENDOR_SESSION_SECRET=<a random secret of at least 32 characters>\nVENDOR_WEB_ROOT=/path/to/your/game/web`
    : "";
  return (
    <Modal
      title={project ? "Manage " + project.draft.title : "Publish your game"}
      className="publisher-modal"
      onClose={requestClose}
      dismissible={!busy}
    >
      {discard && (
        <div className="discard-draft" role="alert">
          <strong>Keep your latest changes?</strong>
          <p>Your changes since the last save are still in this form.</p>
          <button
            className="primary"
            type="button"
            onClick={() => setDiscard(false)}
          >
            Keep editing
          </button>{" "}
          <button className="outline" type="button" onClick={onClose}>
            Discard unsaved changes
          </button>
        </div>
      )}
      <div className="eyebrow">UTXOPLAY / PUBLISH</div>
      <h2>
        {project ? "Build your next release." : "Make room for your game."}
      </h2>
      <nav className="wizard-nav" aria-label="Publishing steps">
        {["Game details", "Your instance", "Price & publish"].map((s, i) => (
          <button
            key={s}
            type="button"
            aria-current={step === i ? "step" : undefined}
            disabled={!!busy || (i > 0 && !project)}
            className={step === i ? "active" : ""}
            onClick={() => setStep(i)}
          >
            <b>{i + 1}</b>
            {s}
          </button>
        ))}
      </nav>
      <form
        ref={formRef}
        className="publisher-form"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <fieldset className="publisher-fields" disabled={!!busy}>
        <legend className="sr-only">Listing editor</legend>
        {step === 0 && (
          <>
            <label>
              Game title
              <input
                value={draft.title}
                onChange={(e) => field("title", e.target.value)}
                required
                minLength={3}
                maxLength={80}
                placeholder="A game worth sharing"
              />
            </label>
            <fieldset className="credit-editor">
              <legend>Developer & publisher</legend>
              <p className="fine">Credit the people who made the game separately from the publisher responsible for this listing. Leave an unknown developer wallet blank.</p>
              <div className="form-columns">
                <label>Developer name<input id="credit-developer-name" aria-invalid={creditValidation&&missing.includes("developerName")||undefined} aria-describedby={creditValidation&&missing.includes("developerName")?"credit-name-help":undefined} value={draft.developerName} maxLength={80} onChange={e => field("developerName", e.target.value)} placeholder="Original creator or studio" /></label>
                <label>Publisher name<input id="credit-publisher-name" aria-invalid={creditValidation&&missing.includes("publisherName")||undefined} aria-describedby={creditValidation&&missing.includes("publisherName")?"credit-name-help":undefined} value={draft.publisherName} maxLength={80} onChange={e => field("publisherName", e.target.value)} placeholder="Your publishing name" /></label>
              </div>
              {creditValidation&&missing.length>0&&<p id="credit-name-help" className="credit-field-error" role="alert">Add both the original developer and publisher names before publishing. Unknown developer wallets may stay blank.</p>}
              <label>Developer CKB wallet (optional)<input value={draft.developerAddress} maxLength={300} onChange={e => field("developerAddress", e.target.value)} placeholder="ckb1… · Leave blank if unknown" spellCheck={false} /></label>
              <label>Original project website (optional)<input type="url" value={draft.developerSourceUrl} maxLength={500} onChange={e => field("developerSourceUrl", e.target.value)} placeholder="https://github.com/creator/original-game" /></label>
              <label>Publisher CKB wallet<input readOnly value={project?.publisher?.address || user.address || ""} onFocus={e => e.target.select()} /></label>
              <p className="fine">Your publisher wallet comes from the signed-in project owner and is public on the listing. Credit names and developer wallets are attribution supplied by the publisher. The payout address is configured separately in Pricing.</p>
            </fieldset>
            <label>
              Description
              <textarea
                value={draft.description}
                onChange={(e) => field("description", e.target.value)}
                required
                maxLength={2000}
                placeholder="Tell players what makes it fun."
              />
            </label>
            <div className="form-columns">
              <label>
                Genre
                <select
                  value={draft.genre}
                  onChange={(e) => field("genre", e.target.value)}
                >
                  {["Action", "Arcade", "Strategy", "Puzzle", "Other"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Play style
                <select
                  value={draft.players}
                  onChange={(e) => field("players", e.target.value)}
                >
                  {[
                    "Single player",
                    "Local multiplayer",
                    "Online multiplayer",
                    "Solo + multiplayer",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Controls & device requirements
              <textarea
                required
                value={draft.controls}
                onChange={(e) => field("controls", e.target.value)}
                maxLength={1200}
                placeholder="How do players move, aim or interact? Is a keyboard required?"
              />
            </label>
            <div className="form-columns">
              <label>
                Game URL
                <input
                  type="url"
                  value={draft.gameUrl}
                  onChange={(e) => field("gameUrl", e.target.value)}
                  required
                  placeholder="https://play.your-domain.com/game/"
                />
              </label>
              <label>
                Version
                <input
                  value={draft.version}
                  onChange={(e) => field("version", e.target.value)}
                  required
                  pattern="[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}"
                  placeholder="1.0.0"
                />
              </label>
            </div>
            <p className="fine">
              You host the game and Myelin runtime. Your first save creates a
              private draft.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <div className="inline-benefit">
              <Server />
              <div>
                <strong>Your runtime. Your infrastructure.</strong>
                <p>
                  Use the launch adapter in front of your own Myelin instance.
                  The store checks its public configuration; this is not a
                  gameplay security certification.
                </p>
              </div>
            </div>
            <label>
              Public Myelin instance / adapter URL
              <input
                type="url"
                value={draft.runtimeUrl}
                onChange={(e) => field("runtimeUrl", e.target.value)}
                required
                placeholder="https://play.your-domain.com"
              />
            </label>
            <p className="fine">
              HTTPS on port 443. Same origin as your game. Keep the private
              Myelin RPC and runtime token behind the adapter.
            </p>
            <div className="key-panel">
              <strong>
                {project.keyConfigured
                  ? "Launch key configured"
                  : "Create a server-only launch key"}
              </strong>
              <p>
                The adapter uses this key to exchange one-use player tickets.
                Never put it in your game’s browser code.
              </p>
              {project.keyConfigured && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rotate}
                    onChange={(e) => setRotate(e.target.checked)}
                  />
                  I understand rotating stops the old key. I will update my
                  server.
                </label>
              )}
              <button
                type="button"
                className="outline"
                disabled={!!busy || (project.keyConfigured && !rotate)}
                onClick={() =>
                  action("Generating key", async () => {
                    const d = await marketApi(
                      `/api/developer/projects/${project.id}/key`,
                      {},
                    );
                    setKey(d.key);
                    setProject(d.project);
                    setRotate(false);
                    setNotice(
                      "Copy the new key now. It is shown only in this session.",
                    );
                  })
                }
              >
                <KeyRound size={16} />
                {project.keyConfigured
                  ? "Rotate launch key"
                  : "Generate launch key"}
              </button>
              {key && (
                <label>
                  New key — save it on your server
                  <input
                    readOnly
                    value={key}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
            </div>
            <div className="setup-snippet">
              <div>
                <strong>Adapter environment</strong>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => copyText(setup, setNotice)}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <pre>{setup}</pre>
            </div>
            <a
              className="text-link"
              href="/publishing.html#hosting"
              target="_blank"
              rel="noreferrer"
            >
              Install the adapter and start your instance{" "}
              <ArrowUpRight size={15} />
            </a>
            <button
              type="button"
              className="outline full"
              disabled={!!busy}
              onClick={() => {
                if (formRef.current.reportValidity())
                  action("Checking instance", async () => {
                    const p = await save();
                    const checked = await marketApi(
                      `/api/developer/projects/${p.id}/check`,
                      {},
                    );
                    setProject(checked);
                    setNotice(
                      "Connection checked. The instance matches your project and reports its Myelin runtime ready.",
                    );
                  });
              }}
            >
              <Globe size={16} />
              Save & check connection
            </button>
            {project.checkError && (
              <p className="fine">Last check: {project.checkError}</p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <fieldset className="pricing-options">
              <legend>How would you like to share it?</legend>
              <label className={draft.pricing === "free" ? "selected" : ""}>
                <input
                  type="radio"
                  name="pricing"
                  checked={draft.pricing === "free"}
                  onChange={() => field("pricing", "free")}
                />
                <Gift />
                <span>
                  <strong>
                    Free to play <em>Recommended</em>
                  </strong>
                  <small>
                    No listing fee. No payment required for players. Easy to
                    try, easy to share.
                  </small>
                </span>
              </label>
              <label className={draft.pricing === "paid" ? "selected" : ""}>
                <input
                  type="radio"
                  name="pricing"
                  checked={draft.pricing === "paid"}
                  onChange={() => field("pricing", "paid")}
                />
                <Wallet />
                <span>
                  <strong>Paid access</strong>
                  <small>
                    One purchase, ongoing access. CKB mainnet. You receive 80%;
                    Store receives 20%.
                  </small>
                </span>
              </label>
            </fieldset>
            {draft.pricing === "paid" ? (
              <>
                <div className="form-columns">
                  <label>
                    One-time price · CKB
                    <input
                      inputMode="decimal"
                      value={draft.priceCkb}
                      onChange={(e) => field("priceCkb", e.target.value)}
                      required
                      pattern="[0-9]+(\.[0-9]{1,8})?"
                      placeholder="Price in CKB"
                    />
                  </label>
                  <label>
                    Publisher CKB mainnet payout address
                    <input
                      value={draft.payoutAddress}
                      onChange={(e) => field("payoutAddress", e.target.value)}
                      required
                      placeholder="ckb1…"
                    />
                  </label>
                </div>
                <div className="split-preview">
                  <span>
                    Your 80%<b>{split ? money(split.vendor) : "—"} CKB</b>
                  </span>
                  <span>
                    Store 20%<b>{split ? money(split.store) : "—"} CKB</b>
                  </span>
                </div>
                <p className="fine">
                  Both shares are outputs of the same transaction. Players pay
                  the network fee separately. CKB minimum cell capacities apply.
                </p>
                <button
                  type="button"
                  className="outline"
                  disabled={!!busy}
                  onClick={() => {
                    action("Checking price", async () => {
                      const p = await save();
                      setPrice(
                        await marketApi(
                          `/api/developer/projects/${p.id}/price`,
                          {},
                        ),
                      );
                    });
                  }}
                >
                  Check settlement & minimum price
                </button>
                {price && (
                  <div className="inline-benefit">
                    <Wallet />
                    <p>
                      {price.configured
                        ? `Minimum for these receive addresses: ${price.minimumCkb} CKB. ${price.valid ? "This price supports the direct split." : "Increase your price, or publish free."}`
                        : "Store settlement is waiting for its receive address. Your paid draft can be saved; free publishing is available now."}
                    </p>
                  </div>
                )}
                {config && !config.configured && (
                  <Notice>
                    Paid publishing is waiting for the Store receive address. No
                    funds are requested. You can publish free now.
                  </Notice>
                )}
                <label>
                  Support URL
                  <input
                    type="url"
                    value={draft.supportUrl}
                    onChange={(e) => field("supportUrl", e.target.value)}
                    required
                    placeholder="https://your-domain.com/support"
                  />
                </label>
                <label>
                  Refund-policy URL
                  <input
                    type="url"
                    value={draft.refundUrl}
                    onChange={(e) => field("refundUrl", e.target.value)}
                    required
                    placeholder="https://your-domain.com/refunds"
                  />
                </label>
              </>
            ) : (
              <div className="inline-benefit">
                <Gift />
                <div>
                  <strong>Free publishing. Free player access.</strong>
                  <p>
                    You cover your own hosting. There is no listing charge and
                    no revenue split for free launches. Wallet players retain
                    their free access if you later introduce a price.
                  </p>
                </div>
              </div>
            )}
            <div className="publish-review">
              <h3>Before it goes live</h3>
              <GameCredits linked={false} game={{developer:{name:draft.developerName,address:draft.developerAddress||null,sourceUrl:project?.draft?.developerSourceUrl === draft.developerSourceUrl ? draft.developerSourceUrl||undefined : undefined},publisher:{name:draft.publisherName,address:project?.publisher?.address||user.address}}}/>
              {(!draft.developerName.trim() || !draft.publisherName.trim()) && <p className="fine">Add both credit names in Game details before publishing. Developer wallets can stay unknown.</p>}
              <p>
                <strong>{draft.title}</strong> · v{draft.version} ·{" "}
                {draft.genre}
              </p>
              <p>{draft.runtimeUrl || "Add your Myelin instance in step 2."}</p>
              <p>
                Your instance is checked again when publishing. Players open
                your game on your domain. You are responsible for hosting,
                support and fulfilling access.
              </p>
              {!!changes.length&&<section className="credit-changes" aria-label="Credit changes to publish"><h4>Credit changes to publish</h4><p>These changes affect the listing after publication. Previous order credits stay as recorded.</p><dl>{changes.map(change=><div key={change.key}><dt>{change.label}</dt><dd><span><small>Live</small>{change.before||"Not provided"}</span><span><small>Draft</small>{change.after||"Not provided"}</span></dd></div>)}</dl></section>}
              {project?.live && (
                <p>
                  Edits stay in draft until republished. Existing purchases keep
                  access; changing a price does not change previous receipts.
                </p>
              )}
            </div>
          </>
        )}
        {error && <Notice>{error}</Notice>}
        {notice && (
          <p className="inline-success" role="status">
            <Check size={16} />
            {notice}
          </p>
        )}
        <div className="wizard-actions">
          {step > 0 && (
            <button
              type="button"
              className="text-link"
              disabled={!!busy}
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          <button
            type="button"
            className="outline"
            disabled={!!busy}
            onClick={() => {
              if (formRef.current.reportValidity())
                action("Saving draft", async () => {
                  await save();
                  setNotice(
                    "Draft saved. Your published release is unchanged.",
                  );
                });
            }}
          >
            Save draft
          </button>
          {step < 2 ? (
            <button key="continue" type="button" className="primary" disabled={!!busy} onClick={next}>
              {busy ? <Spinner /> : null}
              {busy || "Save & continue"}
              {!busy && <ArrowRight size={16} />}
            </button>
          ) : (
            <button
              key="publish"
              type="button"
              className="primary"
              disabled={
                !!busy ||
                (draft.pricing === "paid" && config && !config.configured)
              }
              onClick={() => {
                if(missing.length){setCreditValidation(true);setStep(0);setError("Complete the highlighted credit names before publishing.");return;}
                if (formRef.current.reportValidity())
                  action("Checking & publishing", async () => {
                    const p = await save();
                    await marketApi(`/api/developer/projects/${p.id}/publish`, {
                      revision: p.revision,
                    });
                    onDone();
                  });
              }}
            >
              {busy ? <Spinner /> : <Globe size={16} />}{" "}
              {busy ||
                (draft.pricing === "free"
                  ? "Publish free"
                  : "Publish paid game")}
            </button>
          )}
        </div>
        {project?.status === "published" && (
          <div className="unlist-panel">
            <button
              type="button"
              className="text-link"
              onClick={() => setUnlist(!unlist)}
            >
              Pause new discovery and sales
            </button>
            {unlist && (
              <>
                <p>
                  Unlisting removes this game from discovery. Existing owners
                  keep their access, so keep your instance running.
                </p>
                <button
                  type="button"
                  className="outline"
                  disabled={!!busy}
                  onClick={() =>
                    action("Unlisting", async () => {
                      await marketApi(
                        `/api/developer/projects/${project.id}/unpublish`,
                        {},
                      );
                      onDone();
                    })
                  }
                >
                  Unlist this game
                </button>
              </>
            )}
          </div>
        )}
        </fieldset>
      </form>
    </Modal>
  );
}
export function ReceiptRow({ order: o, vendor = false, onOpen }) {
  return (
    <article className="receipt-row">
      <div>
        <span className={"state-badge " + o.status}>
          {humanStatus(o.status)}
        </span>
        <h3>{o.title}</h3>
        {o.credits?.publisher && <p className="receipt-publisher">Published by {o.credits.publisher.name}</p>}
        <p>
          {new Date(o.created).toLocaleString()} · {o.id.slice(0, 12)}
        </p>
      </div>
      <div>
        <strong>{vendor ? money(o.vendor) : o.priceCkb} CKB</strong>
        <small>{vendor ? "Your 80%" : "One-time access"}</small>
        {onOpen && (
          <button className="text-link" onClick={() => onOpen(o)}>
            View receipt <ArrowRight size={14} />
          </button>
        )}
        {o.txHash && (
          <a
            className="text-link"
            href={"https://explorer.nervos.org/transaction/" + o.txHash}
            target="_blank"
            rel="noreferrer"
          >
            On-chain transaction <ExternalLink size={13} />
          </a>
        )}
      </div>
    </article>
  );
}
export function Purchases({ user, signer, onConnect, onPlay }) {
  const [orders, setOrders] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(null);
  const signed = user && !user.guest;
  async function load() {
    setLoading(true);
    try {
      const d = await marketApi("/api/orders");
      setOrders(d.orders);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setOrders([]);
    if (signed) void load();
    else setLoading(false);
  }, [user?.id]);
  return (
    <>
      <PageHeading
        eyebrow="YOUR PURCHASES"
        title="A receipt for every round to come."
        description="Follow payments, return to your games, and see exactly where your CKB went."
      />
      {!signed ? (
        <div className="empty">
          <Receipt size={35} />
          <h2>Your receipts follow your wallet.</h2>
          <button className="primary" onClick={onConnect}>
            Connect your wallet
          </button>
        </div>
      ) : error ? (
        <Notice onRetry={load}>{error}</Notice>
      ) : loading ? (
        <div className="empty" role="status">
          <Spinner />
          Loading receipts…
        </div>
      ) : orders.length ? (
        <div className="receipt-list">
          {orders.map((o) => (
            <ReceiptRow key={o.id} order={o} onOpen={setSelected} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Gift size={35} />
          <h2>Nothing to pay for yet.</h2>
          <p>
            Free games are always welcome in your library. Paid receipts will
            appear here.
          </p>
        </div>
      )}
      {selected && (
        <Checkout
          initialOrder={selected}
          user={user}
          signer={signer}
          onConnect={onConnect}
          onClose={() => {
            setSelected(null);
            void load();
          }}
          onOwned={() => {
            const id = selected.game;
            setSelected(null);
            onPlay(id);
          }}
        />
      )}
    </>
  );
}
export function VendorPlay({
  game,
  user,
  signer,
  onConnect,
  onRefresh,
  onStartGuest,
}) {
  const [owned, setOwned] = useState(false),
    [checkout, setCheckout] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [handoff, setHandoff] = useState(null);
  useEffect(() => {
    setOwned(false);
    setError("");
    setHandoff(null);
    if (user)
      marketApi("/api/library")
        .then((d) =>
          setOwned(d.games.some((g) => g.game === game.id && g.owned)),
        )
        .catch((e) => setError(e.message));
  }, [game.id, user?.id]);
  async function play() {
    setBusy(true);
    setError("");
    const name = "utxoplay_vendor_" + Date.now(),
      popup = window.open("", name);
    if (popup) {
      popup.opener = null;
      popup.document.title = "Opening " + game.title;
      popup.document.body.textContent = "Connecting to your game…";
    }
    try {
      const d = await marketApi("/api/games/" + game.id + "/launch", {});
      setOwned(true);
      onRefresh();
      if (popup) {
        const f = document.createElement("form");
        f.method = "POST";
        f.action = d.launchUrl;
        f.target = name;
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = "ticket";
        i.value = d.ticket;
        f.append(i);
        document.body.append(f);
        f.submit();
        f.remove();
      } else setHandoff(d);
    } catch (e) {
      popup?.close();
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="vendor-play">
      <div className="vendor-play-art">
        <img src={game.cover} alt="" />
        <span>INDEPENDENT / MYELIN</span>
      </div>
      <div className="vendor-play-copy">
        <div className="eyebrow">
          {game.genre} ·{" "}
          {game.pricing === "free"
            ? "FREE TO PLAY"
            : owned
              ? "IN YOUR LIBRARY"
              : game.priceCkb + " CKB"}
        </div>
        <h1>{game.title}</h1>
        <p>{game.description}</p>
        <GameCredits game={game} />
        <div className="vendor-host">
          <Server size={18} />
          <span>
            Hosted by the publisher<strong>{game.host}</strong>
          </span>
          <ExternalLink size={15} />
        </div>
        <p className="fine">
          This game opens on the publisher’s website. Your store cookies, wallet
          keys and login signature are never shared with it.
        </p>
        {game.pricing === "paid" && !owned ? (
          <>
            <div className="purchase-promise">
              <strong>{game.priceCkb} CKB</strong>
              <span>Pay once · No recurring subscription</span>
            </div>
            <p className="fine">
              Access has no scheduled expiry. The publisher hosts the game and
              handles support and refunds; continued play depends on that
              service remaining available.
            </p>
            <button
              className="primary full"
              onClick={() =>
                user && !user.guest ? setCheckout(true) : onConnect()
              }
            >
              <Wallet size={17} />
              {user && !user.guest ? "Review purchase" : "Sign in to purchase"}
              <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <button
            className="primary full"
            disabled={busy}
            onClick={user ? play : onStartGuest}
          >
            {busy ? <Spinner /> : <ArrowUpRight size={17} />}{" "}
            {busy
              ? "Connecting to your game…"
              : !user
                ? "Start a guest session"
                : "Open game on " + game.host}
          </button>
        )}
        {!user && (
          <p className="fine">No wallet required for this free game.</p>
        )}
        {handoff && (
          <form
            method="POST"
            action={handoff.launchUrl}
            target="_blank"
            rel="noopener"
          >
            <input type="hidden" name="ticket" value={handoff.ticket} />
            <p>Your browser blocked the new tab. Continue below.</p>
            <button className="primary">
              Continue to the game <ExternalLink size={16} />
            </button>
          </form>
        )}
        {error && <Notice>{error}</Notice>}
        <div className="control-note">
          <h3>How to play</h3>
          <p>{game.controls}</p>
          <p>
            {game.players} · v{game.version}
          </p>
        </div>
        <div className="vendor-links">
          {game.supportUrl && (
            <a href={game.supportUrl} target="_blank" rel="noreferrer">
              Publisher support <ExternalLink size={13} />
            </a>
          )}
          {game.refundUrl && (
            <a href={game.refundUrl} target="_blank" rel="noreferrer">
              Refund policy <ExternalLink size={13} />
            </a>
          )}
          <a href="/purchases">
            Your receipts <ArrowRight size={13} />
          </a>
        </div>
      </div>
      {checkout && (
        <Checkout
          game={game}
          user={user}
          signer={signer}
          onConnect={onConnect}
          onClose={() => setCheckout(false)}
          onOwned={() => {
            setOwned(true);
            setCheckout(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
function Checkout({
  game,
  initialOrder,
  user,
  signer,
  onConnect,
  onClose,
  onOwned,
}) {
  const [order, setOrder] = useState(initialOrder || null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false),
    [fee, setFee] = useState(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function check() {
    if (!order) return;
    const d = await marketApi(`/api/orders/${order.id}/check`, {});
    if (alive.current) setOrder(d.order);
    return d.order;
  }
  useEffect(() => {
    if (initialOrder) return;
    setBusy("Reserving your price");
    marketApi("/api/orders", { game: game.id })
      .then((d) => {
        if (d.owned) onOwned();
        else if (alive.current) setOrder(d.order);
      })
      .catch((e) => alive.current && setError(e.message))
      .finally(() => alive.current && setBusy(""));
  }, []);
  useEffect(() => {
    if (
      !order?.txHash ||
      ["confirmed", "cancelled", "rejected"].includes(order.status)
    )
      return;
    const t = setInterval(() => {
      void check().catch((e) => alive.current && setError(e.message));
    }, 10000);
    return () => clearInterval(t);
  }, [order?.id, order?.txHash, order?.status]);
  useEffect(() => {
    let live = true;
    setFee(null);
    if (order?.transaction && signer)
      loadCcc()
        .then((ccc) =>
          ccc.Transaction.from(order.transaction).getFee(signer.client),
        )
        .then((value) => live && setFee(formatCkb(value)))
        .catch(
          () =>
            live &&
            setError(
              "Unable to load the network fee. Reconnect your purchasing wallet before paying.",
            ),
        );
    return () => {
      live = false;
    };
  }, [order?.txHash, signer]);
  async function perform(label, fn) {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e.message || "Wallet request was cancelled. Your receipt is saved.",
      );
    } finally {
      if (alive.current) setBusy("");
    }
  }
  async function ensureWallet() {
    if (!signer)
      throw Error(
        "Connect the wallet used for this order before preparing a payment.",
      );
    const current = await signer.getRecommendedAddress();
    if (current !== user.address)
      throw Error("Switch to the purchasing wallet before paying this order.");
  }
  async function prepare() {
    await ensureWallet();
    const ccc = await loadCcc();
    const tx = ccc.Transaction.from({
      outputs: order.outputs,
      outputsData: ["0x", "0x"],
    });
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);
    const safe = JSON.parse(
      JSON.stringify(tx, (_k, v) =>
        typeof v === "bigint" ? "0x" + v.toString(16) : v,
      ),
    );
    const d = await marketApi(`/api/orders/${order.id}/prepare`, {
      transaction: safe,
    });
    setOrder(d.order);
    setFee(
      formatCkb(
        await ccc.Transaction.from(d.order.transaction).getFee(signer.client),
      ),
    );
  }
  async function pay() {
    await ensureWallet();
    const ccc = await loadCcc();
    const latest = await check();
    if (["confirmed", "confirming"].includes(latest.status)) return;
    if (latest.status === "rejected")
      throw Error(
        "This transaction was rejected. Contact support with your receipt before retrying.",
      );
    const tx = ccc.Transaction.from(latest.transaction);
    const signed = await signer.signTransaction(tx);
    if (signed.hash() !== latest.txHash)
      throw Error(
        "The wallet changed the prepared transaction. Nothing was broadcast. Contact support with your order ID.",
      );
    await signer.client.sendTransaction(signed);
    await check();
  }
  return (
    <Modal
      title="Purchase receipt"
      className="checkout-modal"
      onClose={onClose}
      dismissible={!busy}
    >
      <div className="eyebrow">
        <Receipt size={16} />
        CKB MAINNET / ONE-TIME ACCESS
      </div>
      <h2>{order?.title || game?.title || "Your purchase"}</h2>
      {order ? (
        <>
          <span className={"state-badge " + order.status}>
            {humanStatus(order.status)}
          </span>
          {order.credits ? <section className="receipt-credits"><h3>Credits recorded with this order</h3><GameCredits game={order.credits} linked={false}/><p className="fine">Recorded with this order. Later listing edits do not change these credits.</p></section> : <p className="fine">Developer and publisher credits were not recorded on this older receipt.</p>}
          <div className="checkout-total">
            <strong>
              {order.priceCkb} <small>CKB</small>
            </strong>
            <span>
              Network fee is additional{fee ? " · " + fee + " CKB" : ""}.
            </span>
          </div>
          <div className="split-preview">
            <span>
              Publisher share · 80%<b>{money(order.vendor)} CKB</b>
            </span>
            <span>
              Store · 20%<b>{money(order.store)} CKB</b>
            </span>
          </div>
          <details className="receipt-details">
            <summary>Payout addresses & order ID</summary>
            <p className="fine">The publisher’s payout address can differ from its identity wallet above.</p>
            <p>
              Publisher payout: <code>{order.vendorAddress}</code>
            </p>
            <p>
              Store: <code>{order.storeAddress}</code>
            </p>
            <p>
              Order: <code>{order.id}</code>
            </p>
          </details>
          {order.status === "confirmed" ? (
            <>
              <div className="inline-benefit">
                <Check />
                <p>
                  Your purchase is confirmed. Both shares were paid directly in
                  the same transaction.
                </p>
              </div>
              <button className="primary full" onClick={onOwned}>
                Open your game <ArrowRight size={17} />
              </button>
            </>
          ) : order.status === "cancelled" ? (
            <p>
              This unpaid quote was cancelled. Return to the game to create a
              new one.
            </p>
          ) : (
            <>
              <p className="fine">
                One purchase unlocks this wallet’s access without a scheduled
                expiry. The publisher provides hosting, support and refunds. The
                store does not hold these payments.
              </p>
              <div className="vendor-links">
                <a href={order.supportUrl} target="_blank" rel="noreferrer">
                  Support
                </a>
                <a href={order.refundUrl} target="_blank" rel="noreferrer">
                  Refund policy
                </a>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I reviewed the price, publisher hosting and refund policy.
              </label>
              {!signer ? (
                <button
                  className="primary full"
                  onClick={() => {
                    onClose();
                    onConnect();
                  }}
                >
                  Connect purchasing wallet
                </button>
              ) : !order.transaction ? (
                <button
                  className="primary full"
                  disabled={!accepted || !!busy}
                  onClick={() => perform("Preparing transaction", prepare)}
                >
                  {busy ? <Spinner /> : <Wallet size={17} />}{" "}
                  {busy || "Prepare & review network fee"}
                </button>
              ) : (
                <>
                  <button
                    className="primary full"
                    disabled={
                      !accepted ||
                      fee === null ||
                      !!busy ||
                      order.status === "confirming" ||
                      order.status === "rejected"
                    }
                    onClick={() => perform("Confirm in your wallet", pay)}
                  >
                    {busy ? <Spinner /> : <Wallet size={17} />}{" "}
                    {busy || "Sign & pay " + order.priceCkb + " CKB"}
                  </button>
                  <p className="fine">
                    This receipt reserves one transaction. Retrying uses that
                    same transaction, so it cannot charge you twice. If already
                    submitted, check status instead.
                  </p>
                </>
              )}
              {order.txHash && (
                <div className="confirmation-progress">
                  <span>
                    {order.confirmations} / {order.requiredConfirmations}{" "}
                    confirmations
                  </span>
                  <progress
                    max={order.requiredConfirmations}
                    value={Math.min(
                      order.confirmations,
                      order.requiredConfirmations,
                    )}
                  />
                  <p>
                    It is safe to close this receipt. Confirmation continues in
                    the background.
                  </p>
                </div>
              )}
              <button
                className="outline full"
                disabled={!!busy}
                onClick={() => perform("Checking CKB", check)}
              >
                <RefreshCw size={16} />
                Check payment status
              </button>
              {!order.txHash && (
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() =>
                    perform("Cancelling quote", async () =>
                      setOrder(
                        (await marketApi(`/api/orders/${order.id}/cancel`, {}))
                          .order,
                      ),
                    )
                  }
                >
                  Cancel unpaid quote
                </button>
              )}
            </>
          )}
          {order.txHash && (
            <a
              className="text-link"
              href={"https://explorer.nervos.org/transaction/" + order.txHash}
              target="_blank"
              rel="noreferrer"
            >
              View transaction on CKB <ExternalLink size={14} />
            </a>
          )}
        </>
      ) : busy ? (
        <div className="empty compact">
          <Spinner />
          {busy}…
        </div>
      ) : null}
      {error && <Notice>{error}</Notice>}
      <p className="fine">
        Receipts are saved under Purchases. Never send a second manual payment
        to fix a pending receipt.
      </p>
    </Modal>
  );
}
