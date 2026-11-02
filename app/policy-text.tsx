import type {ReactNode} from 'react';

// Renders store-editable policy text (Markdown-style: **bold**, "# heading",
// "- item" / "1. item" lists) as safe React elements; no raw HTML is injected.
const inline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part);

const bullet = /^\s*(?:[-*•])\s+/, numbered = /^\s*\d+[.)]\s+/;

// Text pasted as one line keeps its list markers inline ("... fit. - The ..."):
// restore the line breaks so it renders as a heading, list and closing paragraph.
function restoreLines(text: string) {
  let t = text.replace(/^\s*(\*\*[^*]+\*\*)\s*/, '$1\n');
  if (!/\s[-•]\s+(?=[A-Z0-9])/.test(t)) return t;
  t = t.replace(/\s+[-•]\s+(?=[A-Z0-9])/g, '\n- ');
  const lines = t.split('\n'), last = lines.length - 1;
  const end = lines[last].search(/[.!?]\s+(?=[A-Z])/);
  if (bullet.test(lines[last]) && end > 0) lines.splice(last, 1, lines[last].slice(0, end + 1), '', lines[last].slice(end + 1).trim());
  return lines.join('\n');
}

export default function PolicyText({text, className = 'policy-text'}: {text: string; className?: string}) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  const lines = (source.includes('\n') ? source : restoreLines(source)).split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [], list: {ordered: boolean; items: string[]} | null = null;
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>);
    if (list) {
      const items = list.items.map((x, i) => <li key={i}>{inline(x)}</li>);
      blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    }
    para = []; list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^#{1,3}\s+(.*)$/) || line.match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) { flush(); blocks.push(<h2 key={blocks.length}>{heading[1].replace(/\*\*/g, '')}</h2>); continue; }
    const ordered = numbered.test(line);
    if (ordered || bullet.test(line)) {
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= {ordered, items: []};
      list.items.push(line.replace(ordered ? numbered : bullet, ''));
      continue;
    }
    if (list) flush();
    para.push(line);
  }
  flush();
  return <div className={className}>{blocks}</div>;
}
