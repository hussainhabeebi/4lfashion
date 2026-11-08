"use client";
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {occasionList} from '../lib/catalog';

// Occasion tick boxes for the product editor. `known` is every occasion in use
// (the standard ones plus custom ones on other products); new custom occasions
// can be typed in and are ticked straight away.
export default function OccasionPicker({value, known, onChange}: {value: unknown; known: string[]; onChange: (v: string) => void}) {
  const list = occasionList(value), [draft, setDraft] = useState('');
  const options = [...known, ...list.filter(o => !known.includes(o))];
  const toggle = (o: string, on: boolean) => onChange((on ? [...list, o] : list.filter(x => x !== o)).join(','));
  function add() {
    const name = draft.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!name) return;
    const existing = options.find(o => o.toLowerCase() === name.toLowerCase()) || name;
    if (!list.includes(existing)) toggle(existing, true);
    setDraft('');
  }
  return <fieldset className="occasion-picker">
    <legend>Occasions <small>· shown in “Shop by occasion” on the homepage</small></legend>
    {options.map(o => <label key={o} className={list.includes(o) ? 'on' : ''}>
      <input type="checkbox" checked={list.includes(o)} onChange={e => toggle(o, e.target.checked)}/>{o}</label>)}
    <span className="occasion-add">
      <input aria-label="Custom occasion" placeholder="Add a custom occasion…" maxLength={30} value={draft}
        onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}/>
      <button type="button" onClick={add} disabled={!draft.trim()}><Plus size={14}/> Add</button>
    </span>
  </fieldset>;
}
