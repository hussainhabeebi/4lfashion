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

// The store moved from XS–XXL to M–4XL. A chart saved before that loses its XS/S rows
// and gains 3XL/4XL rows, continuing each numeric column's last step (e.g. +2 in).
// Charts saved from the admin after the change carry `sizeSet`, so they are left as edited.
export const SIZE_SET = 'M-4XL';
const RETIRED = ['XS', 'S'], ADDED = ['3XL', '4XL'];
export function withCurrentSizes(chart: SizeChart): SizeChart {
  if ((chart as SizeChart & {sizeSet?: string}).sizeSet === SIZE_SET) return chart;
  const rows = chart.rows.filter(r => !RETIRED.includes(String(r.size).trim().toUpperCase()));
  for (const size of ADDED) {
    if (rows.some(r => String(r.size).trim().toUpperCase() === size)) continue;
    const last = rows[rows.length - 1], prev = rows[rows.length - 2], values: Record<string, string> = {};
    for (const col of chart.columns) {
      const a = Number(last?.values[col]), b = Number(prev?.values[col]);
      values[col] = last && last.values[col] !== '' && Number.isFinite(a) ? String(+(a + (Number.isFinite(b) && prev?.values[col] !== '' && a > b ? a - b : 2)).toFixed(2)) : '';
    }
    rows.push({size, values});
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
