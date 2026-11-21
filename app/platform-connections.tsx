"use client";
import {useState} from 'react';
import {Copy, KeyRound, Link2, Pause, Play, Plug, RefreshCw, Send, Trash2, Eye, Pencil, X, CheckCircle2, AlertTriangle} from 'lucide-react';
import {api} from './storefront';
import {API_SCOPES, WEBHOOK_EVENTS, PLATFORMS} from '../lib/integrations';

type Delivery = {event: string; ok: boolean; status: number; error: string; ms: number; at: string};
type Connection = {id: string; name: string; platform: string; keyPrefix: string; scopes: string[]; webhookUrl: string; events: string[];
  headerName: string; hasHeaderValue: boolean; active: boolean; created: string; lastUsed: string; rotated: string; deliveries: Delivery[]};
type Draft = {name: string; platform: string; webhookUrl: string; headerName: string; headerValue: string; scopes: string[]; events: string[]};
type Revealed = {id: string; name: string; apiKey?: string; signingSecret?: string};

const ALL_SCOPES = API_SCOPES.map(s => s.key as string), ALL_EVENTS = WEBHOOK_EVENTS.map(e => e.key as string);
const blank = (platform = 'leadvyne'): Draft => ({name: PLATFORMS.find(p => p.key === platform)?.name.split(' ')[0] || '', platform, webhookUrl: '', headerName: '', headerValue: '', scopes: ALL_SCOPES, events: ALL_EVENTS});
const when = (s: string) => s ? new Date(s).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qatar'}) : 'Never';
const toggle = (list: string[], k: string, on: boolean) => on ? [...new Set([...list, k])] : list.filter(x => x !== k);

// Admin > Integrations: connect Leadvyne (or any platform) with an API key for pulling orders/items
// and an optional webhook so new orders, status changes and stock updates are pushed automatically.
export default function PlatformConnections({connections, canManage, notify, reload}: {
  connections: Connection[]; canManage: boolean; notify: (m: string) => void; reload: () => Promise<unknown>;
}) {
  const [form, setForm] = useState<{id?: string; draft: Draft} | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [busy, setBusy] = useState('');
  const base = typeof window === 'undefined' ? '' : window.location.origin;

  async function call(tag: string, action: string, data: Record<string, unknown>) {
    setBusy(tag);
    try { const r = await api(action, data); await reload(); return r; }
    catch (e: any) { notify(e.message); return null; }
    finally { setBusy(''); }
  }
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); notify(what + ' copied'); } catch { notify('Select the text and copy it manually'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!form) return;
    const {headerValue, ...rest} = form.draft;
    // An empty value on edit keeps the saved header value.
    const data = form.id && !headerValue && form.draft.headerName ? rest : form.draft;
    const r: any = await call('form', form.id ? 'integrationUpdate' : 'integrationCreate', form.id ? {id: form.id, data} : {data});
    if (!r) return;
    setForm(null);
    if (r.apiKey) setRevealed({id: r.integration.id, name: r.integration.name, apiKey: r.apiKey, signingSecret: r.signingSecret});
    else notify('Connection saved');
  }

  if (!canManage) return <section className="panel"><h3><Plug size={15}/> Platform connections</h3><p className="muted">Only the store owner or an administrator can connect platforms such as Leadvyne.</p></section>;

  const d = form?.draft;
  const set = (patch: Partial<Draft>) => form && setForm({...form, draft: {...form.draft, ...patch}});
  return <div className="platform-connections">
    <section className="panel">
      <div className="between"><div><h3><Plug size={15}/> Platform connections</h3>
        <p className="muted">Auto-sync orders, items and stock with Leadvyne or any other platform. Each connection gets its own API key; add a webhook URL to push changes the moment they happen.</p></div>
        {!form && <div className="pc-actions">
          <button className="primary" onClick={() => setForm({draft: blank('leadvyne')})}><Link2 size={15}/> Connect Leadvyne</button>
          <button className="outline" onClick={() => setForm({draft: blank('custom')})}>Other platform</button>
        </div>}
      </div>

      {revealed && <div className="pc-secret" role="status">
        <div className="between"><b><KeyRound size={14}/> {revealed.name}: copy {revealed.apiKey && revealed.signingSecret ? 'these now' : 'this now'}</b><button className="icon" aria-label="Close" onClick={() => setRevealed(null)}><X size={16}/></button></div>
        <p className="muted">{revealed.apiKey ? 'The API key is shown only once. If you lose it, replace it. ' : ''}Paste these into {revealed.name}’s integration settings.</p>
        <Field label="Base URL" value={base + '/api/v1'} onCopy={copy}/>
        {revealed.apiKey && <Field label="API key" value={revealed.apiKey} onCopy={copy} secret/>}
        {revealed.signingSecret && <Field label="Webhook signing secret" value={revealed.signingSecret} onCopy={copy} secret/>}
        {revealed.apiKey && <><small className="block">Test it:</small><pre className="pc-code">{`curl -H "Authorization: Bearer ${revealed.apiKey}" ${base}/api/v1/orders?limit=5`}</pre></>}
      </div>}

      {form && d && <form className="pc-form" onSubmit={submit}>
        <h4>{form.id ? 'Edit connection' : 'New connection'}</h4>
        <div className="form-grid">
          <label>Platform<select value={d.platform} onChange={e => set({platform: e.target.value, ...(form.id ? {} : {name: blank(e.target.value).name})})}>{PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
          <label>Connection name<input required maxLength={60} value={d.name} onChange={e => set({name: e.target.value})} placeholder="Leadvyne"/></label>
        </div>
        <p className="muted small">{PLATFORMS.find(p => p.key === d.platform)?.note}</p>
        <fieldset><legend>What the API key can read (pull)</legend>
          {API_SCOPES.map(s => <label className="check" key={s.key}><input type="checkbox" checked={d.scopes.includes(s.key)} onChange={e => set({scopes: toggle(d.scopes, s.key, e.target.checked)})}/> {s.label}</label>)}
        </fieldset>
        <fieldset><legend>Webhook: push changes automatically (optional)</legend>
          <label>Webhook URL<input type="url" value={d.webhookUrl} onChange={e => set({webhookUrl: e.target.value})} placeholder="https://… (from Leadvyne’s webhook / integration page)"/></label>
          <div className="form-grid">
            <label>Extra header name<input value={d.headerName} onChange={e => set({headerName: e.target.value})} placeholder="e.g. Authorization or X-API-Key"/></label>
            <label>Header value{form.id && connections.find(c => c.id === form.id)?.hasHeaderValue ? ' (saved, leave blank to keep)' : ''}<input type="password" autoComplete="off" value={d.headerValue} onChange={e => set({headerValue: e.target.value})} placeholder="e.g. Bearer <your Leadvyne API key>" disabled={!d.headerName}/></label>
          </div>
          <small className="block">Use the extra header if the platform gives you its own key for incoming data.</small>
          <div className="pc-events">{WEBHOOK_EVENTS.map(ev => <label className="check" key={ev.key}><input type="checkbox" checked={d.events.includes(ev.key)} onChange={e => set({events: toggle(d.events, ev.key, e.target.checked)})}/> <span>{ev.label}<small className="block"><code>{ev.key}</code></small></span></label>)}</div>
        </fieldset>
        <div className="pc-actions"><button className="primary" disabled={busy === 'form'}>{form.id ? 'Save changes' : 'Create connection & API key'}</button><button type="button" className="outline" onClick={() => setForm(null)}>Cancel</button></div>
      </form>}

      {!connections.length && !form && <div className="empty"><h3>No platforms connected yet</h3><p className="muted">Choose <b>Connect Leadvyne</b> to create an API key. Orders and items then sync automatically.</p></div>}

      {connections.map(c => {
        const last = c.deliveries[0];
        return <article className="pc-card" key={c.id}>
          <div className="between">
            <div><h4>{c.name} <span className={'badge ' + (c.active ? 'green' : '')}>{c.active ? 'Syncing' : 'Paused'}</span></h4>
              <small className="block">{PLATFORMS.find(p => p.key === c.platform)?.name || c.platform} · key <code>{c.keyPrefix}</code> · last API call {when(c.lastUsed)}</small></div>
            <div className="pc-actions">
              <button className="outline" disabled={!!busy || !c.webhookUrl} title={c.webhookUrl ? 'Send a test event to the webhook' : 'Add a webhook URL first'} onClick={async () => { const r: any = await call(c.id, 'integrationTest', {id: c.id}); if (r?.ok) notify('Test event delivered'); }}><Send size={13}/> Test</button>
              <button className="outline" disabled={!!busy} onClick={() => setForm({id: c.id, draft: {name: c.name, platform: c.platform, webhookUrl: c.webhookUrl, headerName: c.headerName, headerValue: '', scopes: c.scopes, events: c.events}})}><Pencil size={13}/> Edit</button>
              <button className="outline" disabled={!!busy} onClick={() => call(c.id, 'integrationUpdate', {id: c.id, data: {active: !c.active}})}>{c.active ? <><Pause size={13}/> Pause</> : <><Play size={13}/> Resume</>}</button>
            </div>
          </div>
          <div className="pc-meta">
            <span><b>Pull</b> {c.scopes.length ? c.scopes.map(s => API_SCOPES.find(x => x.key === s)?.label).join(', ') : 'No API access'}</span>
            <span><b>Push</b> {c.webhookUrl ? <>{new URL(c.webhookUrl).host} · {c.events.length} event{c.events.length === 1 ? '' : 's'}{c.headerName && <> · header <code>{c.headerName}</code></>}</> : 'No webhook (platform pulls with the API key)'}</span>
            {last && <span><b>Last push</b> {last.ok ? <CheckCircle2 size={12} className="ok"/> : <AlertTriangle size={12} className="bad"/>} <code>{last.event}</code> {when(last.at)}{last.ok ? '' : ' · ' + last.error}</span>}
          </div>
          {c.deliveries.length > 0 && <details><summary>Recent deliveries ({c.deliveries.length})</summary><div className="table-scroll"><table><thead><tr><th>Time</th><th>Event</th><th>Result</th></tr></thead><tbody>
            {c.deliveries.map((x, i) => <tr key={i}><td>{when(x.at)}</td><td><code>{x.event}</code></td><td>{x.ok ? <span className="badge green">Delivered · {x.ms} ms</span> : <span className="badge red">{x.error}</span>}</td></tr>)}
          </tbody></table></div></details>}
          <div className="pc-actions pc-secondary">
            <button className="text-link" disabled={!!busy} onClick={async () => { const r: any = await call(c.id, 'integrationReveal', {id: c.id}); if (r) setRevealed({id: c.id, name: c.name, signingSecret: r.signingSecret}); }}><Eye size={13}/> Signing secret</button>
            <button className="text-link" disabled={!!busy} onClick={async () => { if (!confirm('Replace the API key for ' + c.name + '? The old key stops working immediately.')) return; const r: any = await call(c.id, 'integrationRotate', {id: c.id}); if (r) setRevealed({id: c.id, name: c.name, apiKey: r.apiKey}); }}><RefreshCw size={13}/> Replace API key</button>
            <button className="text-link" disabled={!!busy} onClick={async () => { if (!confirm('Replace the webhook signing secret for ' + c.name + '? Update it in the platform too.')) return; const r: any = await call(c.id, 'integrationRotate', {id: c.id, what: 'secret'}); if (r) setRevealed({id: c.id, name: c.name, signingSecret: r.signingSecret}); }}><KeyRound size={13}/> Replace secret</button>
            <button className="text-link danger" disabled={!!busy} onClick={async () => { if (!confirm('Disconnect ' + c.name + '? Its API key stops working and no more data is sent.')) return; if (await call(c.id, 'integrationDelete', {id: c.id})) notify(c.name + ' disconnected'); }}><Trash2 size={13}/> Disconnect</button>
          </div>
        </article>;
      })}
    </section>

    <section className="panel pc-reference">
      <h3>API reference</h3>
      <p className="muted">Base URL <code>{base}/api/v1</code> · send <code>Authorization: Bearer 4lf_…</code> · amounts are QAR decimals · up to 240 requests per minute per key.</p>
      <div className="table-scroll"><table><tbody>
        <tr><td><code>GET /orders?updated_since=2026-11-01T00:00:00Z</code></td><td>Orders changed since a time, oldest first (<code>limit</code>, <code>page</code>, <code>status</code>, <code>source</code>). Poll with the last <code>updated_at</code> you saw.</td></tr>
        <tr><td><code>GET /orders/&#123;id&#125;</code></td><td>One order with customer, items, payment and fulfilment.</td></tr>
        <tr><td><code>GET /products</code> · <code>/products/&#123;id&#125;</code></td><td>Items with SKU, price, variants and stock.</td></tr>
        <tr><td><code>GET /inventory</code></td><td>Stock for every size and colour.</td></tr>
        <tr><td><code>GET /ping</code></td><td>Checks the key.</td></tr>
      </tbody></table></div>
      <p className="muted small">Webhooks are POSTed as JSON <code>{'{id, event, created_at, data}'}</code> with <code>X-4L-Event</code>, <code>X-4L-Timestamp</code> and <code>{'X-4L-Signature: sha256=HMAC(secret, timestamp + "." + body)'}</code>. Failed pushes are retried once; platforms can always catch up with <code>updated_since</code>.</p>
    </section>
  </div>;
}

function Field({label, value, onCopy, secret}: {label: string; value: string; onCopy: (v: string, what: string) => void; secret?: boolean}) {
  return <label className="pc-field">{label}<span><input readOnly value={value} onFocus={e => e.target.select()} className={secret ? 'mono' : ''}/><button type="button" className="outline" onClick={() => onCopy(value, label)}><Copy size={13}/> Copy</button></span></label>;
}
