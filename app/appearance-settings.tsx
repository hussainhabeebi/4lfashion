"use client";
import {useState} from 'react';
import {initialSettings} from '../lib/catalog';

// Admin > Appearance: header and footer text shown on the storefront.
// Fields left untouched keep the default wording from initialSettings.
type Field = {key: string; label: string; hint?: string; multiline?: boolean};
const GROUPS: {title: string; note: string; fields: Field[]}[] = [
  {title: 'Header', note: 'Top of every page and the homepage banner.', fields: [
    {key: 'headerLocation', label: 'Location (top left, computers)'},
    {key: 'navSaleLabel', label: 'Sale link in the category bar', hint: 'Leave empty to hide it'},
    {key: 'heroEyebrow', label: 'Banner small heading'},
    {key: 'heroTitle', label: 'Banner title'},
    {key: 'heroSubtitle', label: 'Banner text'},
    {key: 'heroButton', label: 'Banner button'},
    {key: 'heroNote', label: 'Banner note (computers)'},
    {key: 'benefits', label: 'Highlights under the banner', hint: 'One per line', multiline: true},
  ]},
  {title: 'Newsletter', note: 'Sign-up strip above the footer.', fields: [
    {key: 'newsletterEyebrow', label: 'Small heading'},
    {key: 'newsletterTitle', label: 'Title'},
    {key: 'newsletterText', label: 'Text'},
  ]},
  {title: 'Footer', note: 'Bottom of every page.', fields: [
    {key: 'footerTagline', label: 'Tagline under the logo', hint: 'Line breaks are kept', multiline: true},
    {key: 'footerLocation', label: 'Location under the tagline'},
    {key: 'footerContactTitle', label: 'Contact heading'},
    {key: 'footerAddress', label: 'Address', hint: 'One line per row', multiline: true},
    {key: 'footerPhones', label: 'Phone numbers', hint: 'One per line', multiline: true},
    {key: 'email', label: 'Email'},
    {key: 'footerCopyright', label: 'Copyright line', hint: 'Shown after “© year 4L Fashion.”'},
    {key: 'footerBottomNote', label: 'Bottom-right note'},
  ]},
];

const defaults = initialSettings as unknown as Record<string, string>;

export default function AppearanceSettings({settings, busy, onSave}: {
  settings: Record<string, unknown>; busy: boolean; onSave: (changes: Record<string, string>) => Promise<unknown>;
}) {
  const initial = Object.fromEntries(GROUPS.flatMap(g => g.fields).map(f => [f.key, String(settings[f.key] ?? defaults[f.key] ?? '')]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const set = (k: string, v: string) => setValues(m => ({...m, [k]: v}));
  return <form className="appearance-settings" onSubmit={async e => { e.preventDefault(); try { await onSave(values); } catch {} }}>
    {GROUPS.map(g => <section className="panel" key={g.title}>
      <div className="between"><h3>{g.title}</h3><small className="muted">{g.note}</small></div>
      <div className="form-grid">{g.fields.map(f => <label key={f.key} className={f.multiline ? 'wide' : ''}>
        <span>{f.label}{f.hint && <small className="muted"> · {f.hint}</small>}</span>
        {f.multiline
          ? <textarea rows={f.key === 'footerTagline' ? 2 : 3} value={values[f.key]} onChange={e => set(f.key, e.target.value)}/>
          : <input type={f.key === 'email' ? 'email' : 'text'} required={['heroTitle', 'email'].includes(f.key)} value={values[f.key]} onChange={e => set(f.key, e.target.value)}/>}
        {defaults[f.key] !== undefined && values[f.key] !== String(defaults[f.key]) &&
          <button type="button" className="appearance-reset" onClick={() => set(f.key, String(defaults[f.key]))}>Reset to default</button>}
      </label>)}</div>
    </section>)}
    <button className="primary" disabled={busy}>Save appearance</button>
  </form>;
}
