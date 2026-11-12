import { useEffect, useRef, useState } from 'react';
import { Pizza, Coffee, Cake, Soup, Apple, Cherry, Fish, IceCream } from 'lucide-react';

const ICONS = [Pizza, Coffee, Cake, Soup, Apple, Cherry, Fish, IceCream];

/* Memory match: 16 cards, fewer moves means a higher score (0 to 100) */
export function MemoryGame({ onFinish }) {
  const [cards, setCards] = useState(() => [...ICONS, ...ICONS].map((_, i) => i % 8).sort(() => Math.random() - 0.5).map((k, i) => ({ id: i, k, open: false, done: false })));
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const first = useRef(null);
  const finished = useRef(false);

  const flip = (c) => {
    if (lock || c.open || c.done) return;
    setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, open: true } : x)));
    if (first.current === null) { first.current = c; return; }
    const a = first.current; first.current = null;
    setMoves((m) => m + 1); setLock(true);
    if (a.k === c.k) {
      setTimeout(() => { setCards((cs) => cs.map((x) => (x.k === c.k ? { ...x, done: true } : x))); setLock(false); }, 350);
    } else {
      setTimeout(() => { setCards((cs) => cs.map((x) => (x.id === a.id || x.id === c.id ? { ...x, open: false } : x))); setLock(false); }, 800);
    }
  };
  const done = cards.every((c) => c.done);
  useEffect(() => {
    if (done && !finished.current) { finished.current = true; onFinish(Math.max(10, Math.min(100, 100 - (moves - 8) * 8))); }
  // eslint-disable-next-line
  }, [done]);

  return (
    <div>
      <div className="mb-3 flex justify-between text-sm"><span>Match the pairs</span><span className="font-semibold">Moves: {moves}</span></div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => {
          const I = ICONS[c.k];
          return (
            <button key={c.id} onClick={() => flip(c)} aria-label={c.open || c.done ? 'Card face up' : 'Card face down'}
              className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${c.open || c.done ? 'border-forest bg-forest-light text-forest' : 'border-ink/10 bg-forest text-forest hover:bg-forest-dark'}`}>
              {(c.open || c.done) && <I size={26} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Tap the dish: 20 seconds, items pop up at random spots, score is hits capped at 100 */
export function TapGame({ onFinish }) {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(20);
  const [hits, setHits] = useState(0);
  const [target, setTarget] = useState(null);
  const hitsRef = useRef(0);

  const spawn = () => setTarget({ x: 8 + Math.random() * 78, y: 8 + Math.random() * 74, k: Math.floor(Math.random() * 8), id: Math.random() });
  useEffect(() => {
    if (!running) return;
    spawn();
    const t = setInterval(() => setTime((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (running && time <= 0) { setRunning(false); setTarget(null); onFinish(Math.min(100, hitsRef.current * 6)); }
  // eslint-disable-next-line
  }, [time]);
  useEffect(() => {
    if (!running || !target) return;
    const t = setTimeout(spawn, 1100);
    return () => clearTimeout(t);
  }, [target, running]);

  const tap = () => { hitsRef.current += 1; setHits(hitsRef.current); spawn(); };
  const I = target ? ICONS[target.k] : null;
  return (
    <div>
      <div className="mb-3 flex justify-between text-sm"><span>Tap every dish before it moves</span><span className="font-semibold">{running ? `${time}s` : '20s'} · {hits} hit{hits === 1 ? '' : 's'}</span></div>
      <div className="relative h-64 overflow-hidden rounded-lg border border-ink/10 bg-paper">
        {!running && <div className="absolute inset-0 flex items-center justify-center"><button className="btn-primary" onClick={() => { hitsRef.current = 0; setHits(0); setTime(20); setRunning(true); }}>Start</button></div>}
        {running && I && (
          <button key={target.id} onClick={tap} aria-label="Tap the dish" className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-saffron shadow-lift active:scale-90" style={{ left: `${target.x}%`, top: `${target.y}%` }}><I size={26} /></button>
        )}
      </div>
    </div>
  );
}
