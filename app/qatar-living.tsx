"use client";
// "Life in Qatar" hub for expat shoppers: this month's AC-to-heat wardrobe, Qatar dress-sense
// guide, festival-far-from-home kits, new-to-Qatar welcome kit and community group orders.
import {useEffect, useState} from 'react';
import {Sparkles, Sun, Snowflake, MapPin, CalendarHeart, Users, Gift, Phone, Share2, Copy, Trash2, Video, ShieldCheck, Plus, X, ArrowUpRight} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the storefront's untyped api() helper
type Api = (action: string, data?: Record<string, unknown>) => Promise<any>;
type Pick = {productId: string; name: string; price: number; image?: string; colour: string; fabric: string; why: string};
type Variant = {product: string; size: string; colour: string; stock: number};
type Common = {api: Api; money: (n: number) => string; notify: (m: string) => void; onOpen: (id: string) => void};
const err = (e: unknown, f: string) => e instanceof Error && e.message ? e.message : f;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJson(action: string, params = ''): Promise<any> { const r = await fetch('/api/store?action=' + action + params, {cache: 'no-store'}); const d: any = await r.json(); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; }

function Picks({picks, money, onOpen, label}: {picks: (Pick & {member?: string})[]; money: (n: number) => string; onOpen: (id: string) => void; label?: string}) {
  if (!picks?.length) return null;
  return <div className="q-picks">{picks.map((p, i) => <button key={p.productId + i} className="q-pick" onClick={() => onOpen(p.productId)}>
    <span className="q-pick-img">{p.image && <img src={p.image} alt="" loading="lazy"/>}</span>
    <span>{(label || p.member) && <small className="eyebrow">{p.member ? 'FOR ' + p.member.toUpperCase() : label}</small>}<b>{p.name}</b><em>{money(p.price)}</em><small>{p.why}</small></span>
    <ArrowUpRight size={15}/></button>)}</div>;
}
const Source = ({s}: {s?: string}) => <small className="muted q-source">{s === 'ai' ? 'Personalised by our AI stylist using live stock.' : 'From our stylists’ guide, using live stock.'} Etiquette notes are general guidance.</small>;

const TABS = [['month', 'This month', Sun], ['dress', 'Dress-sense guide', ShieldCheck], ['festivals', 'Festivals', CalendarHeart], ['welcome', 'New to Qatar', Gift], ['groups', 'Group orders', Users]] as const;
type Tab = typeof TABS[number][0];

export default function QatarLiving(props: Common & {user: {displayName?: string} | null; variants: Variant[]}) {
  const initial = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Tab;
  const [tab, setTabState] = useState<Tab>(TABS.some(t => t[0] === initial) ? initial : 'month');
  const [month, setMonth] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => { getJson('qatarMonth').then(setMonth).catch(e => props.notify(err(e, 'Could not load this month’s guide'))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, '', '#' + t); };
  return <div className="qatar">
    <span className="eyebrow">LIFE IN QATAR · FOR EXPAT FAMILIES</span>
    <h1>Dress for Doha, feel at home.</h1>
    <p className="muted">Respectful, modest-friendly style for life here: what to wear where, what works in this month’s heat, festivals far from home, a starter wardrobe for new arrivals, and matching outfits for your community.</p>
    <div className="q-tabs" role="tablist">{TABS.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}><Icon size={15}/>{label}</button>)}</div>
    {tab === 'month' && <MonthTab data={month} {...props} goFestival={() => setTab('festivals')}/>}
    {tab === 'dress' && <DressTab {...props}/>}
    {tab === 'festivals' && <FestivalTab data={month} {...props}/>}
    {tab === 'welcome' && <WelcomeTab {...props} welcome={month?.welcome}/>}
    {tab === 'groups' && <GroupsTab {...props}/>}
  </div>;
}

// ---------- This month ----------
function MonthTab({data, money, onOpen, goFestival}: Common & {data: any; goFestival: () => void}) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!data) return <p className="muted">Loading this month’s guide…</p>;
  const c = data.climate, hot = c.season === 'hot' || c.season === 'humid-hot';
  const soon = (data.festivals || []).filter((f: {soon: boolean}) => f.soon);
  return <section className="q-section">
    <div className="q-weather">
      <div><small className="eyebrow">{c.month.toUpperCase()} IN DOHA</small><h2>{data.headline}</h2>{data.intro && <p>{data.intro}</p>}</div>
      <div className="q-temps"><span><Sun size={18}/> Outside <b>{c.high}°C</b></span><span><Snowflake size={18}/> Office AC <b>18–20°C</b></span><span>Evenings <b>{c.low}°C</b> · humidity {c.humidity}</span></div>
    </div>
    <ul className="q-tips">{data.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
    <h3>Pieces for {c.month}</h3>
    <Picks picks={data.picks} money={money} onOpen={onOpen}/>
    {(soon.length > 0 || data.events?.length > 0) && <div className="q-coming">
      <h3><CalendarHeart size={17}/> Coming up</h3>
      {soon.map((f: {id: string; name: string; when: string}) => <button key={f.id} className="q-chip" onClick={goFestival}>{f.name} · {f.when}</button>)}
      {data.events?.map((e: {id: string; name: string; date: string; venue: string}) => <span key={e.id} className="q-chip plain">{e.name} · {new Date(e.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}{e.venue && ' · ' + e.venue}</span>)}
    </div>}
    {hot && <p className="muted small">Tip: our cotton and linen pieces are unlined unless noted. Ask us on WhatsApp about lining for sheer fabrics.</p>}
    <Source s={data.source}/>
  </section>;
}

// ---------- Dress-sense guide ----------
const QUESTIONS = ['What can I wear to a mall in Lusail?', 'What should I wear to my office in West Bay?', 'We are invited to a majlis. What should I wear?', 'Corniche on Qatar National Day with kids', 'My mother is visiting on a visit visa. What should she pack for Souq Waqif and the mosque?'];
function DressTab({api, money, onOpen, notify}: Common) {
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  async function ask(text = q) { if (text.trim().length < 4) return notify('Tell us where you’re going'); setQ(text); setBusy(true); try { setRes(await api('dressGuide', {question: text})); } catch (e) { notify(err(e, 'Could not answer right now')); } finally { setBusy(false); } }
  return <section className="q-section">
    <h2>What can I wear to…?</h2>
    <p className="muted">Ask about any place or occasion in Qatar. We’ll explain the local norms and suggest modest-friendly pieces from our stock. Great for new arrivals and family visiting on visit visas.</p>
    <form className="q-ask" onSubmit={e => { e.preventDefault(); ask(); }}><input value={q} maxLength={400} onChange={e => setQ(e.target.value)} placeholder="e.g. What can I wear to a mall in Lusail?"/><button className="primary" disabled={busy}><Sparkles size={15}/>{busy ? 'Thinking…' : 'Ask'}</button></form>
    <div className="planner-examples">{QUESTIONS.map(x => <button key={x} onClick={() => ask(x)}>{x}</button>)}</div>
    {res && <div className="q-answer">
      <p className="q-lead">{res.answer}</p>
      {res.tips?.length > 0 && <ul className="q-tips">{res.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>}
      {res.places.map((p: {id: string; label: string; norms: string[]}) => <details key={p.id} open={res.places.length === 1}><summary><MapPin size={14}/> {p.label}</summary><ul>{p.norms.map((n, i) => <li key={i}>{n}</li>)}</ul></details>)}
      <h3>Pieces that work</h3><Picks picks={res.picks} money={money} onOpen={onOpen}/><Source s={res.source}/>
    </div>}
  </section>;
}

// ---------- Festivals far from home ----------
function FestivalTab({data, api, money, onOpen, notify}: Common & {data: any}) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const fests: {id: string; name: string; communities: string; when: string; soon: boolean}[] = data?.festivals || [];
  const [sel, setSel] = useState(''), [kit, setKit] = useState<any>(null), [busy, setBusy] = useState(false); // eslint-disable-line @typescript-eslint/no-explicit-any
  async function open(id: string) { setSel(id); setBusy(true); setKit(null); try { setKit(await api('festivalKit', {festival: id})); } catch (e) { notify(err(e, 'Could not load this festival')); } finally { setBusy(false); } }
  useEffect(() => { const first = fests.find(f => f.soon); if (first && !sel) Promise.resolve().then(() => open(first.id)); }, [fests.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="q-section">
    <h2>Festivals far from home</h2>
    <p className="muted">What to wear, local community celebrations in Doha, and ideas to share the day with family on a video call.</p>
    <div className="q-fests">{fests.map(f => <button key={f.id} className={(sel === f.id ? 'selected ' : '') + (f.soon ? 'soon' : '')} onClick={() => open(f.id)}><b>{f.name}</b><small>{f.when}</small>{f.soon && <em>Coming up</em>}</button>)}</div>
    {busy && <p className="muted">Preparing your festival kit…</p>}
    {kit && <div className="q-answer">
      <h3>{kit.festival.name} <small className="muted">· {kit.festival.when}</small></h3>
      {kit.intro && <p className="q-lead">{kit.intro}</p>}
      <p><b>What to wear:</b> {kit.festival.dress}</p>
      <Picks picks={kit.picks} money={money} onOpen={onOpen}/>
      <div className="q-two">
        <div><h4><CalendarHeart size={16}/> In Doha</h4>{kit.events?.length ? <ul>{kit.events.map((e: {id: string; name: string; date: string; venue: string; organiser: string; link: string}) => <li key={e.id}><b>{e.name}</b>, {new Date(e.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'long'})}{e.venue && ', ' + e.venue}{e.organiser && ' · ' + e.organiser}{e.link && <> · <a href={e.link} target="_blank" rel="noreferrer">Details</a></>}</li>)}</ul> : <p className="muted">No community events listed yet. Check with your association, church, temple or mosque.</p>}</div>
        <div><h4><Video size={16}/> Family video call</h4><ul>{kit.call.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>
      </div>
      <Source s={kit.source}/>
    </div>}
  </section>;
}

// ---------- New to Qatar ----------
type Row = {who: string; age: string; size: string};
function WelcomeTab({api, money, onOpen, notify, welcome}: Common & {welcome?: {code: string; text: string} | null}) {
  const [rows, setRows] = useState<Row[]>([{who: 'Me', age: '', size: ''}]), [budget, setBudget] = useState(''), [busy, setBusy] = useState(false), [kit, setKit] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const up = (i: number, k: keyof Row, v: string) => setRows(r => r.map((x, j) => j === i ? {...x, [k]: v} : x));
  async function build() { setBusy(true); try { setKit(await api('welcomeKit', {members: rows.map(r => ({who: r.who, age: r.age ? Number(r.age) : undefined, size: r.size})), budget: Number(budget) || 0})); } catch (e) { notify(err(e, 'Could not build your kit')); } finally { setBusy(false); } }
  const offer = kit?.welcome || welcome;
  return <section className="q-section">
    <h2>Welcome to Qatar 👋</h2>
    <p className="muted">Just arrived? Tell us who’s in the family and we’ll build a starter wardrobe for school events, the office and the mall, plus the dress norms worth knowing.</p>
    <div className="q-family">{rows.map((r, i) => <div key={i} className="q-member">
      <label>Who<input value={r.who} maxLength={30} onChange={e => up(i, 'who', e.target.value)} placeholder="Me, Wife, Daughter…"/></label>
      <label>Age<input type="number" min={1} max={99} value={r.age} onChange={e => up(i, 'age', e.target.value)} placeholder="optional"/></label>
      <label>Size<select value={r.size} onChange={e => up(i, 'size', e.target.value)}><option value="">Not sure</option>{['M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'].map(s => <option key={s}>{s}</option>)}</select></label>
      {rows.length > 1 && <button aria-label="Remove" className="icon" onClick={() => setRows(x => x.filter((_, j) => j !== i))}><X size={16}/></button>}
    </div>)}
      {rows.length < 6 && <button className="text-link" onClick={() => setRows(r => [...r, {who: '', age: '', size: ''}])}><Plus size={14}/> Add family member</button>}
      <label className="q-budget">Total budget (QAR, optional)<input type="number" min={0} value={budget} onChange={e => setBudget(e.target.value)}/></label>
      <button className="primary" disabled={busy} onClick={build}><Sparkles size={15}/>{busy ? 'Building…' : 'Build our starter wardrobe'}</button>
    </div>
    {offer && <div className="q-offer"><Gift size={18}/><span>{offer.text || 'Welcome offer for new arrivals'}: use code <b>{offer.code}</b> on your first order.</span></div>}
    {kit && <div className="q-answer">
      <p className="q-lead">{kit.intro}</p>
      {kit.sections.map((s: {id: string; label: string; items: (Pick & {member: string})[]}) => s.items.length > 0 && <div key={s.id}><h3>{s.label}</h3><Picks picks={s.items} money={money} onOpen={onOpen}/></div>)}
      {kit.kidsNote && <p className="q-note">{kit.kidsNote}</p>}
      <p><b>Kit total:</b> {money(kit.total)}</p>
      <h3><ShieldCheck size={17}/> Good to know in Qatar</h3><ul className="q-tips">{kit.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
      <Source s={kit.source}/>
    </div>}
  </section>;
}

// ---------- Community group orders ----------
function GroupsTab({api, money, notify, user}: Common & {user: {displayName?: string} | null}) {
  const [theme, setTheme] = useState(''), [matches, setMatches] = useState<Pick[] | null>(null), [chosen, setChosen] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<{code: string; name: string; event: string; date: string; status: string; members: number}[]>([]);
  useEffect(() => { if (user) getJson('myGroups').then(d => setMine(d.groups)).catch(() => {}); }, [user]);
  async function match() { setBusy(true); try { const r = await api('groupTheme', {theme}); setMatches(r.picks); setChosen(r.picks.slice(0, 1).map((p: Pick) => p.productId)); } catch (e) { notify(err(e, 'Could not match the theme')); } finally { setBusy(false); } }
  return <section className="q-section">
    <h2>Community group orders</h2>
    <p className="muted">For Indian and Kerala associations, ICC and ICBF events, church and mosque gatherings, school annual days and Onam sadya. Choose a theme, share one link, and everyone adds their own size. Group discounts apply automatically.</p>
    {!user ? <div className="q-offer"><Users size={18}/><span>Organisers sign in to start a group. Members don’t need an account.</span><button className="primary" onClick={() => window.top!.location.assign('/admin/login?return_to=/pages/qatar')}>Sign in to start</button></div> : <>
      {mine.length > 0 && <div className="q-mygroups"><h3>Your groups</h3>{mine.map(g => <a key={g.code} href={'/pages/group/' + g.code}><b>{g.name}</b><span>{g.event} · {g.date} · {g.members} joined · {g.status}</span></a>)}</div>}
      <form className="q-group-form" onSubmit={async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); if (!chosen.length) return notify('Choose at least one piece'); setBusy(true);
        try { const r = await api('groupCreate', {data: {...f, theme, productIds: chosen}}); location.assign('/pages/group/' + r.code); } catch (er) { notify(err(er, 'Could not create the group')); } finally { setBusy(false); } }}>
        <h3>1. Theme</h3>
        <div className="q-ask"><input value={theme} maxLength={200} onChange={e => setTheme(e.target.value)} placeholder="e.g. All ladies in kasavu with green borders"/><button type="button" className="outline" disabled={busy || theme.trim().length < 3} onClick={match}><Sparkles size={15}/>Find matching pieces</button></div>
        {matches && <div className="q-choose">{matches.map(p => <label key={p.productId} className={chosen.includes(p.productId) ? 'on' : ''}><input type="checkbox" checked={chosen.includes(p.productId)} onChange={e => setChosen(c => e.target.checked ? [...c, p.productId].slice(0, 4) : c.filter(x => x !== p.productId))}/>
          {p.image && <img src={p.image} alt=""/>}<span><b>{p.name}</b><em>{money(p.price)}</em><small>{p.why}</small></span></label>)}</div>}
        <h3>2. Details</h3>
        <div className="form-grid">
          <label>Group name<input name="name" required maxLength={80} placeholder="Ladies’ wing · Onam 2027"/></label>
          <label>Association / church / school<input name="organisation" maxLength={80}/></label>
          <label>Event<input name="event" maxLength={80} placeholder="Onam sadya"/></label>
          <label>Event date<input name="date" type="date" required/></label>
          <label>Sizes due by<input name="deadline" type="date" required/></label>
          <label>Your WhatsApp number<input name="phone" required inputMode="tel" placeholder="+974 …"/></label>
        </div>
        <button className="primary" disabled={busy || !chosen.length}><Users size={15}/>Create group and get the link</button>
      </form></>}
  </section>;
}

// ---------- Shared group page: /pages/group/CODE ----------
export function GroupPage({code, api, money, notify, onOpen, variants, whatsapp}: Common & {code: string; variants: Variant[]; whatsapp: string}) {
  const [g, setG] = useState<any>(null), [error, setError] = useState(''), [pid, setPid] = useState(''), [colour, setColour] = useState(''), [busy, setBusy] = useState(false); // eslint-disable-line @typescript-eslint/no-explicit-any
  const load = () => getJson('group', '&code=' + encodeURIComponent(code)).then(d => { setG(d); setPid(p => p || d.products[0]?.id || ''); }).catch(e => setError(err(e, 'Group not found')));
  useEffect(() => { load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p>{error}</p>;
  if (!g) return <p className="muted">Loading group…</p>;
  const link = typeof location !== 'undefined' ? location.origin + '/pages/group/' + g.code : '';
  const pv = variants.filter(v => v.product === pid), colours = [...new Set(pv.map(v => v.colour))], col = colour && colours.includes(colour) ? colour : colours[0];
  const productName = (id: string) => g.products.find((p: {id: string}) => p.id === id)?.name || id;
  const open = g.status === 'open' && g.deadline >= new Date().toISOString().slice(0, 10);
  const t = g.totals;
  async function update(body: Record<string, unknown>) { try { setG(await api('groupUpdate', {code: g.code, ...body})); } catch (e) { notify(err(e, 'Could not update')); } }
  const summary = `${g.name} (${g.code}) · ${g.event} on ${g.date}\n` + Object.entries(t.sizes as Record<string, Record<string, number>>).map(([k, s]) => `${productName(k.split('|')[0])} (${k.split('|')[1]}): ` + Object.entries(s).map(([z, n]) => `${z}×${n}`).join(', ')).join('\n') + `\nPieces: ${t.pieces} · Est. total QAR ${t.total}`;
  return <div className="q-group">
    <span className="eyebrow">COMMUNITY GROUP ORDER · {g.code}</span>
    <h1>{g.name}</h1>
    <p className="muted">{[g.organisation, g.event, g.date && 'on ' + new Date(g.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})].filter(Boolean).join(' · ')}{g.theme && <> · Theme: “{g.theme}”</>}</p>
    <div className="q-status"><span className={'badge ' + (open ? 'green' : '')}>{open ? 'Taking sizes until ' + new Date(g.deadline).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) : g.status === 'open' ? 'Deadline passed' : g.status}</span>
      <span>{t.pieces} pieces · {t.percent ? t.percent + '% group discount' : 'No discount yet'}</span>{t.next && <span className="muted">{t.next.more} more {t.next.more === 1 ? 'piece' : 'pieces'} unlocks {t.next.percent}% off</span>}</div>
    <div className="q-group-products">{g.products.map((p: Pick & {id: string}) => <button key={p.id} className={pid === p.id ? 'selected' : ''} onClick={() => { setPid(p.id); setColour(''); }}>{p.image && <img src={p.image} alt=""/>}<b>{p.name}</b><em>{money(p.price)}</em></button>)}</div>
    {open && <form className="q-join" onSubmit={async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true);
      try { await api('groupJoin', {code: g.code, ...f, productId: pid, colour: col, qty: Number(f.qty)}); notify('You’re in! Your size has been added.'); (e.target as HTMLFormElement).reset(); load(); } catch (er) { notify(err(er, 'Could not add your size')); } finally { setBusy(false); } }}>
      <h3>Add your size</h3>
      <div className="form-grid">
        <label>Your name<input name="name" required maxLength={60} autoComplete="name"/></label>
        <label>Phone (WhatsApp)<input name="phone" required inputMode="tel" autoComplete="tel"/></label>
        {colours.length > 1 && <label>Colour<select value={col} onChange={e => setColour(e.target.value)}>{colours.map(c => <option key={c}>{c}</option>)}</select></label>}
        <label>Size<select name="size" required>{pv.filter(v => v.colour === col).map(v => <option key={v.size}>{v.size}</option>)}</select></label>
        <label>Quantity<select name="qty">{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Note (optional)<input name="note" maxLength={140} placeholder="e.g. longer sleeves please"/></label>
      </div>
      <div className="q-join-actions"><button className="primary" disabled={busy || !pid}>Add me to the group</button><button type="button" className="text-link" onClick={() => onOpen(pid)}>Not sure of your size? See the size guide ↗</button></div>
    </form>}
    <h3>Sizes so far</h3>
    <div className="q-sizes">{Object.entries(t.sizes as Record<string, Record<string, number>>).map(([k, s]) => <div key={k}><b>{productName(k.split('|')[0])} · {k.split('|')[1]}</b><span>{Object.entries(s).map(([z, n]) => <em key={z}>{z} × {n}</em>)}</span></div>)}{!t.pieces && <p className="muted">No one has joined yet. Share the link!</p>}</div>
    <div className="q-share"><a className="outline" href={'https://wa.me/?text=' + encodeURIComponent(`Join our group order for ${g.event || g.name} and add your size here: ${link}`)} target="_blank" rel="noreferrer"><Share2 size={15}/> Share on WhatsApp</a><button className="outline" onClick={() => { navigator.clipboard?.writeText(link); notify('Link copied'); }}><Copy size={15}/> Copy link</button></div>
    {g.isOrganiser && <section className="q-organiser">
      <h3>Organiser view</h3>
      <p>Estimated: {money(t.subtotal)}{t.discount > 0 && <> − {money(t.discount)} ({t.percent}% group discount)</>} = <b>{money(t.total)}</b>. Final prices and stock are confirmed by 4L.</p>
      <div className="table-scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Piece</th><th>Size</th><th>Qty</th><th/></tr></thead><tbody>{g.members.map((m: {id: string; name: string; phone: string; productId: string; colour: string; size: string; qty: number; note?: string}) => <tr key={m.id}><td>{m.name}{m.note && <small className="block">{m.note}</small>}</td><td><a href={'tel:' + m.phone}><Phone size={12}/> {m.phone}</a></td><td>{productName(m.productId)} · {m.colour}</td><td>{m.size}</td><td>{m.qty}</td><td>{['open', 'closed'].includes(g.status) && <button aria-label="Remove" className="icon" onClick={() => confirm('Remove ' + m.name + '?') && update({removeMember: m.id})}><Trash2 size={14}/></button>}</td></tr>)}</tbody></table></div>
      <div className="q-share">
        {g.status === 'open' && <button className="outline" onClick={() => update({status: 'closed'})}>Stop taking sizes</button>}
        {g.status === 'closed' && <button className="outline" onClick={() => update({status: 'open'})}>Reopen</button>}
        {['open', 'closed'].includes(g.status) && t.pieces > 0 && <button className="primary" onClick={() => update({status: 'submitted'})}>Send order to 4L</button>}
        <a className="outline" href={'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(summary)} target="_blank" rel="noreferrer"><Share2 size={15}/> WhatsApp the store</a>
      </div>
      {g.status === 'submitted' && <p className="q-note">Sent to 4L. Our team will confirm stock, final pricing and delivery with you on WhatsApp.</p>}
    </section>}
  </div>;
}
