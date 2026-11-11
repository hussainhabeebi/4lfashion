"use client";
// Admin for "Life in Qatar": community group orders, Doha community events calendar,
// festival dates that move each year, the new-arrivals welcome offer and group discount tiers.
import {useState} from 'react';
import {Phone, Trash2, Plus} from 'lucide-react';
import {FESTIVALS, sanitizeTiers, groupTotals, type GroupLine} from '../lib/qatar';

/* eslint-disable @typescript-eslint/no-explicit-any -- admin data mirrors the untyped records API */
type Run = (action: string, payload?: Record<string, unknown>) => Promise<unknown>;
const STATUS = ['open', 'closed', 'submitted', 'confirmed', 'ready', 'completed', 'cancelled'];

export default function QatarAdmin({data, run, busy, notify}: {data: any; run: Run; busy: boolean; notify: (m: string) => void}) {
  const settings = data.settings || {}, tiers = sanitizeTiers(settings.groupTiers);
  const groups = [...(data.group || [])].sort((a: any, b: any) => String(b.created).localeCompare(String(a.created)));
  const events = [...(data.communityEvent || [])].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  const [open, setOpen] = useState<string | null>(null);
  const price = (id: string) => Number(data.product.find((p: any) => p.id === id)?.price || 0), pname = (id: string) => data.product.find((p: any) => p.id === id)?.name || id;
  const saveSettings = (changes: Record<string, unknown>) => run('save', {kind: 'settings', id: 'store-settings', data: {...settings, ...changes}});
  return <>
    <section className="panel">
      <h3>Community group orders</h3>
      <p className="muted">Groups are started by organisers from Life in Qatar → Group orders. Members add their own sizes through a shared link. Confirm stock and pricing with the organiser, then create the order(s) in POS or Orders.</p>
      {groups.length ? <div className="table-scroll"><table><thead><tr><th>Group</th><th>Event</th><th>Organiser</th><th>Pieces</th><th>Est. total</th><th>Status</th></tr></thead><tbody>{groups.map((g: any) => {
        const lines: GroupLine[] = g.members.map((m: any) => ({...m, price: price(m.productId)})), t = groupTotals(lines, tiers);
        return [<tr key={g.code} onClick={() => setOpen(open === g.code ? null : g.code)} style={{cursor: 'pointer'}}>
          <td><b>{g.name}</b><small className="block">{g.code} · {g.organisation}</small></td><td>{g.event}<small className="block">{g.date} · sizes by {g.deadline}</small></td>
          <td>{g.organiserName}<small className="block"><a href={'tel:' + g.phone} onClick={e => e.stopPropagation()}><Phone size={11}/> {g.phone}</a></small></td>
          <td>{t.pieces}</td><td>QAR {t.total}{t.percent > 0 && <small className="block">{t.percent}% off</small>}</td>
          <td onClick={e => e.stopPropagation()}><select value={g.status} disabled={busy} onChange={async e => { try { await run('groupUpdate', {code: g.code, status: e.target.value}); } catch (er: any) { notify(er.message); } }}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></td>
        </tr>, open === g.code && <tr key={g.code + '-d'}><td colSpan={6}>
          <p><b>Theme:</b> {g.theme || '—'} · <a href={'/pages/group/' + g.code} target="_blank" rel="noreferrer">Open group page ↗</a></p>
          <p><b>Size breakdown:</b> {Object.entries(t.sizes).map(([k, s]) => `${pname(k.split('|')[0])} (${k.split('|')[1]}): ` + Object.entries(s).map(([z, n]) => `${z}×${n}`).join(', ')).join(' · ') || 'none yet'}</p>
          <table><thead><tr><th>Name</th><th>Phone</th><th>Piece</th><th>Size</th><th>Qty</th><th>Note</th></tr></thead><tbody>{g.members.map((m: any) => <tr key={m.id}><td>{m.name}</td><td>{m.phone}</td><td>{pname(m.productId)} · {m.colour}</td><td>{m.size}</td><td>{m.qty}</td><td>{m.note}</td></tr>)}</tbody></table>
        </td></tr>];
      })}</tbody></table></div> : <p className="muted">No group orders yet.</p>}
    </section>

    <section className="panel">
      <h3>Doha community events</h3>
      <p className="muted">Shown on Life in Qatar under “Coming up” and in festival kits. Add real events only (associations, ICC/ICBF, churches, temples, mosques, schools). The AI never invents events.</p>
      <form className="form-grid" onSubmit={async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); try { await run('save', {kind: 'communityEvent', data: f}); (e.target as HTMLFormElement).reset(); notify('Event added'); } catch (er: any) { notify(er.message); } }}>
        <label>Event<input name="name" required maxLength={100} placeholder="Onam celebration 2027"/></label>
        <label>Date<input name="date" type="date" required/></label>
        <label>Venue<input name="venue" maxLength={100} placeholder="Indian Cultural Centre, Abu Hamour"/></label>
        <label>Organiser<input name="organiser" maxLength={100}/></label>
        <label>Link (https)<input name="link" type="url" maxLength={300}/></label>
        <label>Festival<select name="festival"><option value="">—</option>{FESTIVALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <button className="primary" disabled={busy}><Plus size={15}/> Add event</button>
      </form>
      {events.length > 0 && <table><tbody>{events.map((e: any) => <tr key={e.id}><td>{e.date}</td><td><b>{e.name}</b><small className="block">{[e.venue, e.organiser].filter(Boolean).join(' · ')}</small></td><td>{FESTIVALS.find(f => f.id === e.festival)?.name || ''}</td>
        <td><button className="icon" aria-label="Delete event" onClick={async () => { if (confirm('Delete ' + e.name + '?')) { try { await run('deleteCommunityEvent', {id: e.id}); } catch (er: any) { notify(er.message); } } }}><Trash2 size={14}/></button></td></tr>)}</tbody></table>}
    </section>

    <section className="panel">
      <h3>Festival dates, welcome offer and group discounts</h3>
      <form onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget);
        const festivalDates = Object.fromEntries(FESTIVALS.map(x => [x.id, String(f.get('fd-' + x.id) || '')]).filter(([, v]) => v));
        const groupTiers = sanitizeTiers([1, 2, 3].map(i => ({min: f.get('tmin' + i), percent: f.get('tpct' + i)})).filter(t => t.min && t.percent));
        try { await saveSettings({festivalDates, welcomeCoupon: String(f.get('welcomeCoupon') || '').trim().toUpperCase(), welcomeText: String(f.get('welcomeText') || '').trim(), groupTiers}); notify('Life in Qatar settings saved'); } catch (er: any) { notify(er.message); } }}>
        <p className="muted">Eid, Onam and Diwali move every year. Set this year’s date once it is announced; leave blank to show the usual month. Christmas, Vishu and Pongal use their usual dates unless you set one.</p>
        <div className="form-grid">{FESTIVALS.map(x => <label key={x.id}>{x.name}<input type="date" name={'fd-' + x.id} defaultValue={settings.festivalDates?.[x.id] || ''}/></label>)}</div>
        <p className="muted">Welcome offer for new arrivals, shown on Life in Qatar. Create the code under Discounts first.</p>
        <div className="form-grid"><label>Coupon code<input name="welcomeCoupon" defaultValue={settings.welcomeCoupon || ''} placeholder="WELCOMEQA"/></label><label>Offer text<input name="welcomeText" defaultValue={settings.welcomeText || ''} placeholder="10% off your first order"/></label></div>
        <p className="muted">Group discount tiers (total pieces → % off), applied to estimated group totals.</p>
        <div className="form-grid">{[1, 2, 3].map(i => <label key={i}>Tier {i}<span className="q-tier"><input type="number" min={2} name={'tmin' + i} defaultValue={tiers[i - 1]?.min ?? ''} placeholder="pieces"/><input type="number" min={1} max={50} name={'tpct' + i} defaultValue={tiers[i - 1]?.percent ?? ''} placeholder="% off"/></span></label>)}</div>
        <button className="primary" disabled={busy}>Save</button>
      </form>
    </section>
  </>;
}
