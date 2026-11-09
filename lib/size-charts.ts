// Size charts: several named charts, one marked as the store default.
// A product picks a chart by id in `sizeChart`; empty means "use the default".
// Stores saved before this existed only have the single `sizeChart` rows
// (bust/waist/hip), which become the "Standard" default chart.

export type SizeChart = {id: string; name: string; columns: string[]; rows: {size: string; values: Record<string, string>}[]};
type Settings = {sizeCharts?: unknown; defaultSizeChart?: unknown; sizeChart?: unknown};
type LegacyRow = {size?: unknown; bust?: unknown; waist?: unknown; hip?: unknown};

export function legacyChart(rows: unknown): SizeChart {
  const list = Array.isArray(rows) ? rows as LegacyRow[] : [];
  return {id: 'standard', name: 'Standard', columns: ['Bust', 'Waist', 'Hip'],
    rows: list.map(r => ({size: String(r.size ?? ''), values: {Bust: String(r.bust ?? ''), Waist: String(r.waist ?? ''), Hip: String(r.hip ?? '')}}))};
}

export function sizeCharts(settings: Settings): SizeChart[] {
  const saved = Array.isArray(settings.sizeCharts) ? (settings.sizeCharts as SizeChart[]).filter(c => c && c.id && Array.isArray(c.rows)) : [];
  return (saved.length ? saved : [legacyChart(settings.sizeChart)]).map(withCurrentSizes);
}

// Size-range changes, oldest first. A chart is brought up to date by applying every
// step after the one it was last saved at: retired sizes are dropped and new sizes are
// appended, continuing each numeric column's last step (e.g. +2 in; +2 when the
// last step is missing or over 4 in). Charts saved from
// the admin carry the current `sizeSet`, so later edits there are left as they are.
const STEPS = [
  {set: 'M-4XL', drop: ['XS', 'S'], add: ['3XL', '4XL']},
  {set: 'M-5XL', drop: [] as string[], add: ['5XL']},
];
export const SIZE_SET = STEPS[STEPS.length - 1].set;
const norm = (s: unknown) => String(s).trim().toUpperCase();
export function withCurrentSizes(chart: SizeChart): SizeChart {
  const done = STEPS.findIndex(s => s.set === (chart as SizeChart & {sizeSet?: string}).sizeSet);
  if (done === STEPS.length - 1) return chart;
  let rows = chart.rows;
  for (const step of STEPS.slice(done + 1)) {
    rows = rows.filter(r => !step.drop.includes(norm(r.size)));
    for (const size of step.add) {
      if (rows.some(r => norm(r.size) === size)) continue;
      const last = rows[rows.length - 1], prev = rows[rows.length - 2], values: Record<string, string> = {};
      for (const col of chart.columns) {
        const a = Number(last?.values[col]), b = Number(prev?.values[col]);
        values[col] = last && last.values[col] !== '' && Number.isFinite(a) ? String(+(a + (Number.isFinite(b) && prev?.values[col] !== '' && a > b && a - b <= 4 ? a - b : 2)).toFixed(2)) : '';
      }
      rows = [...rows, {size, values}];
    }
  }
  return {...chart, rows, sizeSet: SIZE_SET} as SizeChart;
}

export function defaultChartId(settings: Settings) {
  const charts = sizeCharts(settings), id = String(settings.defaultSizeChart || '');
  return charts.some(c => c.id === id) ? id : charts[0].id;
}

// The chart for a product: its own choice if it still exists, else the store default.
export function chartFor(settings: Settings, product?: {sizeChart?: unknown} | null): SizeChart {
  const charts = sizeCharts(settings), want = String(product?.sizeChart || '');
  return charts.find(c => c.id === want) || charts.find(c => c.id === defaultChartId(settings)) || charts[0];
}
