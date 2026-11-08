"use client";

// Qatar delivery address, one field per part (as on the blue address plate).
// The parts are also joined into one `address` line for orders, invoices and admin.
export const ADDRESS_PARTS = [
  {key: 'addrFlat', label: 'Flat no.', placeholder: 'Optional', required: false, numeric: false},
  {key: 'addrBuilding', label: 'Building no.', placeholder: 'e.g. 70', required: true, numeric: true},
  {key: 'addrStreet', label: 'Street no.', placeholder: 'e.g. 310', required: true, numeric: true},
  {key: 'addrZone', label: 'Zone no.', placeholder: 'e.g. 26', required: true, numeric: true},
] as const;
export const AREAS = ['Doha', 'Al Rayyan', 'Al Wakrah', 'Lusail', 'Al Daayen', 'Umm Salal', 'Al Khor', 'Al Shamal', 'Mesaieed', 'Other Qatar area'];

type Values = Record<string, unknown>;
const val = (v: Values, k: string) => String(v[k] ?? '').trim();

export function composeAddress(v: Values) {
  const parts = [
    val(v, 'addrFlat') && 'Flat ' + val(v, 'addrFlat'),
    val(v, 'addrBuilding') && 'Building ' + val(v, 'addrBuilding'),
    val(v, 'addrStreet') && 'Street ' + val(v, 'addrStreet'),
    val(v, 'addrZone') && 'Zone ' + val(v, 'addrZone'),
    val(v, 'area'),
  ].filter(Boolean).join(', ');
  const landmark = val(v, 'addrLandmark');
  return parts + (landmark ? ' · ' + landmark : '');
}

export function addressDetails(v: Values) {
  return Object.fromEntries(['addrFlat', 'addrBuilding', 'addrStreet', 'addrZone', 'area', 'addrLandmark'].map(k => [k, val(v, k).slice(0, 200)]));
}

export default function AddressFields({defaults = {}, requireAll = true}: {defaults?: Values; requireAll?: boolean}) {
  return <fieldset className="address-fields">
    <legend>Delivery address</legend>
    <div className="address-grid">
      {ADDRESS_PARTS.map(p => <label key={p.key}>{p.label}
        <input name={p.key} required={requireAll && p.required} placeholder={p.placeholder} maxLength={20}
          inputMode={p.numeric ? 'numeric' : undefined} defaultValue={val(defaults, p.key)}/></label>)}
      <label>Area<select name="area" defaultValue={val(defaults, 'area') || 'Doha'}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
    </div>
    <label>Landmark & delivery instructions <small className="muted">(optional)</small>
      <textarea name="addrLandmark" rows={2} maxLength={300} placeholder="e.g. Near Al Meera, call on arrival" defaultValue={val(defaults, 'addrLandmark')}/></label>
  </fieldset>;
}
