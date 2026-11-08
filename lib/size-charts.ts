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
  return saved.length ? saved : [legacyChart(settings.sizeChart)];
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
