"use client";
import {useState} from 'react';
import {Plus, Star, Trash2, X} from 'lucide-react';
import {sizeCharts, defaultChartId, type SizeChart} from '../lib/size-charts';

// Admin > Size charts: several named charts; one is the default used by any
// product that has no chart of its own.
const newId = () => 'chart-' + Math.random().toString(36).slice(2, 8);

export default function SizeChartsAdmin({settings, busy, onSave}: {
  settings: Record<string, unknown>; busy: boolean; onSave: (changes: Record<string, unknown>) => Promise<unknown>;
}) {
  const [charts, setCharts] = useState<SizeChart[]>(() => JSON.parse(JSON.stringify(sizeCharts(settings))));
  const [def, setDef] = useState(() => defaultChartId(settings));
  const [open, setOpen] = useState(def);
  const update = (id: string, fn: (c: SizeChart) => SizeChart) => setCharts(cs => cs.map(c => c.id === id ? fn(c) : c));
  const chart = charts.find(c => c.id === open) || charts[0];

  function addChart() {
    const base = charts.find(c => c.id === def) || charts[0];
    const c: SizeChart = {id: newId(), name: 'New size chart', columns: [...base.columns], rows: base.rows.map(r => ({size: r.size, values: {}}))};
    setCharts(cs => [...cs, c]); setOpen(c.id);
  }
  function remove(id: string) {
    if (id === def || !window.confirm('Delete this size chart? Products using it will show the default chart.')) return;
    setCharts(cs => cs.filter(c => c.id !== id)); setOpen(def);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = charts.map(c => ({...c, name: c.name.trim() || 'Untitled chart', columns: c.columns.map(x => x.trim()).filter(Boolean),
      rows: c.rows.filter(r => r.size.trim()).map(r => ({size: r.size.trim(), values: r.values}))}));
    const d = clean.find(c => c.id === def) || clean[0];
    // Keep the old single-chart field in step with the default, for anything still reading it.
    const legacy = d.rows.map(r => ({size: r.size, bust: Number(r.values.Bust) || 0, waist: Number(r.values.Waist) || 0, hip: Number(r.values.Hip) || 0}));
    try { await onSave({sizeCharts: clean, defaultSizeChart: d.id, sizeChart: legacy}); } catch {}
  }

  return <form className="size-charts-admin" onSubmit={save}>
    <section className="panel">
      <div className="between"><div><h3>Size charts</h3><p className="muted">Pick a chart on each product. Products without one use the <b>default</b> chart.</p></div>
        <button type="button" className="text-link" onClick={addChart}><Plus size={14}/> New chart</button></div>
      <div className="chart-tabs">{charts.map(c => <button type="button" key={c.id} className={c.id === chart.id ? 'on' : ''} onClick={() => setOpen(c.id)}>
        {c.name || 'Untitled'}{c.id === def && <span className="badge green">Default</span>}</button>)}</div>
    </section>
    <section className="panel" key={chart.id}>
      <div className="chart-head">
        <label>Chart name<input required value={chart.name} onChange={e => update(chart.id, c => ({...c, name: e.target.value}))}/></label>
        <div className="chart-actions">
          {chart.id === def ? <span className="muted"><Star size={14}/> Default chart</span>
            : <button type="button" className="text-link" onClick={() => setDef(chart.id)}><Star size={14}/> Make default</button>}
          {chart.id !== def && <button type="button" className="text-link danger" onClick={() => remove(chart.id)}><Trash2 size={14}/> Delete</button>}
        </div>
      </div>
      <div className="chart-table-wrap"><table className="chart-edit">
        <thead><tr><th>Size</th>{chart.columns.map((col, ci) => <th key={ci}>
          <input aria-label={'Column ' + (ci + 1)} value={col} onChange={e => update(chart.id, c => {
            const old = c.columns[ci], name = e.target.value;
            return {...c, columns: c.columns.map((x, i) => i === ci ? name : x), rows: c.rows.map(r => { const v = {...r.values}; v[name] = v[old] ?? ''; if (old !== name) delete v[old]; return {...r, values: v}; })};
          })}/>
          <button type="button" aria-label={'Remove column ' + col} onClick={() => update(chart.id, c => ({...c, columns: c.columns.filter((_, i) => i !== ci)}))}><X size={12}/></button>
        </th>)}<th><button type="button" className="text-link" onClick={() => update(chart.id, c => ({...c, columns: [...c.columns, 'Length']}))}><Plus size={12}/> Column</button></th></tr></thead>
        <tbody>{chart.rows.map((row, ri) => <tr key={ri}>
          <td><input aria-label={'Size ' + (ri + 1)} value={row.size} onChange={e => update(chart.id, c => ({...c, rows: c.rows.map((r, i) => i === ri ? {...r, size: e.target.value} : r)}))}/></td>
          {chart.columns.map(col => <td key={col}><input aria-label={row.size + ' ' + col} inputMode="decimal" value={row.values[col] ?? ''}
            onChange={e => update(chart.id, c => ({...c, rows: c.rows.map((r, i) => i === ri ? {...r, values: {...r.values, [col]: e.target.value}} : r)}))}/></td>)}
          <td><button type="button" aria-label={'Remove size ' + row.size} onClick={() => update(chart.id, c => ({...c, rows: c.rows.filter((_, i) => i !== ri)}))}><Trash2 size={14}/></button></td>
        </tr>)}</tbody>
      </table></div>
      <button type="button" className="text-link" onClick={() => update(chart.id, c => ({...c, rows: [...c.rows, {size: '', values: {}}]}))}><Plus size={14}/> Add size</button>
      <p className="muted">Measurements in inches. The first column is used for the “find my size” helper.</p>
    </section>
    <button className="primary" disabled={busy}>Save size charts</button>
  </form>;
}
