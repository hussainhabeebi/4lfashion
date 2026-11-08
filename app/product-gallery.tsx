"use client";
import {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, X} from 'lucide-react';

// Product page photo carousel: swipe (touch), trackpad/drag (desktop), arrows,
// dots and thumbnails, auto-advancing until the shopper interacts with it.
const AUTO_MS = 4500, RESUME_MS = 9000;

export default function ProductGallery({images, alt, active, video}: {images: string[]; alt: string; active?: string; video?: string}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0), [zoom, setZoom] = useState<string | null>(null);
  const pausedUntil = useRef(0), hover = useRef(false), drag = useRef<{x: number; left: number; moved: boolean} | null>(null);
  const count = images.length;

  const goTo = useCallback((i: number, user = true) => {
    const el = track.current; if (!el || !count) return;
    const next = (i + count) % count;
    if (user) pausedUntil.current = Date.now() + RESUME_MS;
    el.scrollTo({left: next * el.clientWidth, behavior: 'smooth'});
  }, [count]);

  // Keep the active dot/thumbnail in sync with the scroll position (swipes included).
  useEffect(() => {
    const el = track.current; if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, {passive: true});
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-advance; pauses while hovered, after any interaction, when the tab is hidden,
  // and is off entirely for people who prefer reduced motion.
  useEffect(() => {
    if (count < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (hover.current || zoom || document.hidden || Date.now() < pausedUntil.current) return;
      goTo(index + 1, false);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [count, index, zoom, goTo]);

  // A colour choice (or a new product) jumps to that colour's photo.
  const firstRun = useRef(true);
  useEffect(() => {
    const i = active ? images.indexOf(active) : 0;
    const el = track.current;
    if (el) el.scrollTo({left: Math.max(0, i) * el.clientWidth});
    if (!firstRun.current) pausedUntil.current = Date.now() + RESUME_MS;
    firstRun.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the photo set or active photo changes
  }, [active, images.join('|')]);

  // Mouse drag on desktop (touch devices use native swipe + scroll snap).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !track.current) return;
    drag.current = {x: e.clientX, left: track.current.scrollLeft, moved: false};
    track.current.classList.add('dragging');
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current, el = track.current; if (!d || !el) return;
    const dx = e.clientX - d.x; if (Math.abs(dx) > 4) d.moved = true;
    el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current, el = track.current; if (!d || !el) return;
    el.classList.remove('dragging'); drag.current = null;
    if (d.moved) { const dx = el.scrollLeft - d.left; goTo(index + (Math.abs(dx) > el.clientWidth * .15 ? Math.sign(dx) : 0)); }
  };

  if (!count) return <div className="pdp-gallery"/>;
  return <div className="pdp-gallery" onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; endDrag(); }}>
    <div className="gallery-stage">
      <div ref={track} className="gallery-track" tabIndex={0} aria-roledescription="carousel" aria-label={alt + ' photos'}
        onKeyDown={e => { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); } }}
        onTouchStart={() => { pausedUntil.current = Date.now() + RESUME_MS; }}
        onWheel={() => { pausedUntil.current = Date.now() + RESUME_MS; }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag}>
        {images.map((src, i) => <div className="gallery-slide" key={src} aria-label={`Photo ${i + 1} of ${count}`}>
          <img src={src} alt={i ? alt + ' – view ' + (i + 1) : alt} loading={i ? 'lazy' : 'eager'} draggable={false}
            onClick={() => { if (!drag.current?.moved) setZoom(src); }}/>
        </div>)}
      </div>
      {count > 1 && <>
        <button type="button" className="gallery-arrow prev" aria-label="Previous photo" onClick={() => goTo(index - 1)}><ChevronLeft size={20}/></button>
        <button type="button" className="gallery-arrow next" aria-label="Next photo" onClick={() => goTo(index + 1)}><ChevronRight size={20}/></button>
        <div className="gallery-dots">{images.map((src, i) => <button type="button" key={src} aria-label={'Show photo ' + (i + 1)} className={i === index ? 'on' : ''} onClick={() => goTo(i)}/>)}</div>
        <span className="gallery-count">{index + 1} / {count}</span>
      </>}
    </div>
    {count > 1 && <div className="gallery-thumbnails">{images.map((src, i) =>
      <button type="button" key={src} className={i === index ? 'on' : ''} aria-label={'Show photo ' + (i + 1)} onClick={() => goTo(i)}><img src={src} alt=""/></button>)}</div>}
    <small>Swipe or use the arrows to see more · tap a photo to zoom</small>
    {video && <video controls src={video}/>}
    {zoom && <div className="gallery-zoom" role="dialog" aria-label="Zoomed photo" onClick={() => setZoom(null)}>
      <button type="button" aria-label="Close zoom" onClick={() => setZoom(null)}><X/></button>
      <img src={zoom} alt={alt}/>
    </div>}
  </div>;
}
