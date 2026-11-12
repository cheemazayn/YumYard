import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Star, Loader2, ImagePlus, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, imgUrl } from '../lib/api';

/* Loads data on mount and whenever deps change */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, setData, loading, error, reload: run };
}

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin text-forest ${className}`} size={20} aria-label="Loading" />;
export const Loading = ({ text = 'Loading' }) => <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/60"><Spinner /> {text}</div>;
export const ErrorBox = ({ message, retry }) => (
  <div className="rounded-lg border border-chili/30 bg-chili-light p-4 text-sm text-chili">
    {message} {retry && <button onClick={retry} className="ml-2 font-semibold underline">Try again</button>}
  </div>
);
export const Empty = ({ title, hint, action, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center py-14 text-center">
    <Icon className="mb-3 text-ink/30" size={32} />
    <p className="font-display text-lg font-bold">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-sm text-ink/60">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export function Img({ src, alt = '', className = '', fallback = 'bg-mist' }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (!src || bad) return <div className={`${className} ${fallback}`} role="img" aria-label={alt} />;
  return <img src={imgUrl(src)} alt={alt} className={className} loading="lazy" onError={() => setBad(true)} />;
}

export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-lift sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3.5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-ink/50 hover:bg-ink/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
  </label>
);

export const Toggle = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm">
    <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-ink/25'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
    </span>
    {label}
  </button>
);

export const Stars = ({ value = 0, size = 16, onChange }) => (
  <span className="inline-flex" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={onChange ? 'p-0.5' : 'cursor-default'} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
        <Star size={size} className={n <= Math.round(value) ? 'fill-saffron text-saffron' : 'text-ink/25'} />
      </button>
    ))}
  </span>
);

export const StatCard = ({ label, value, sub, tone }) => (
  <div className="card p-4">
    <p className="text-xs font-semibold text-ink/60">{label}</p>
    <p className={`mt-1 font-display text-2xl font-extrabold ${tone === 'danger' ? 'text-chili' : ''}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-ink/50">{sub}</p>}
  </div>
);

export const PageHeader = ({ title, sub, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 max-w-2xl text-sm text-ink/60">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink/10" role="tablist">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
        className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${value === t.id ? 'border-forest text-forest' : 'border-transparent text-ink/60 hover:text-ink'}`}>
        {t.label}{t.count !== undefined && <span className="ml-1.5 rounded bg-ink/10 px-1.5 text-xs">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const Badge = ({ children, className = 'bg-mist text-ink/70' }) => <span className={`badge ${className}`}>{children}</span>;

/* Upload a JPG/PNG (or PDF for documents) and get a URL back */
export function ImageUpload({ value, onChange, label = 'Image', allowPdf = false, aspect = 'aspect-video', linkInput = true }) {
  const [busy, setBusy] = useState(false);
  const input = useRef();
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const okTypes = ['image/jpeg', 'image/png', ...(allowPdf ? ['application/pdf'] : [])];
    if (!okTypes.includes(file.type)) return toast.error(`Unsupported format. Upload a JPG or PNG${allowPdf ? ' (or PDF)' : ''}.`);
    if (file.size > 3 * 1024 * 1024) return toast.error('That file is larger than 3 MB.');
    const fd = new FormData(); fd.append('file', file);
    setBusy(true);
    try { const { data } = await api.post('/upload', fd); onChange(data.url, data.name); toast.success('Uploaded'); }
    catch (err) { toast.error(errMsg(err)); }
    setBusy(false); e.target.value = '';
  };
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex gap-3">
        <div className={`${aspect} w-32 shrink-0 overflow-hidden rounded-md border border-dashed border-ink/25 bg-mist`}>
          {value && !value.endsWith('.pdf') ? <Img src={value} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-ink/30"><ImagePlus size={22} /></div>}
        </div>
        <div className="flex-1 space-y-2">
          <input ref={input} type="file" accept={allowPdf ? 'image/jpeg,image/png,application/pdf' : 'image/jpeg,image/png'} onChange={pick} className="hidden" />
          <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => input.current.click()}>{busy ? 'Uploading' : 'Upload file'}</button>
          {linkInput && <input className="input" placeholder="or paste an image link" value={value || ''} onChange={(e) => onChange(e.target.value)} />}
        </div>
      </div>
    </div>
  );
}

export const TAG_LABEL = { halal: 'Halal', veg: 'Veg', vegan: 'Vegan', 'gluten-free': 'Gluten-free', spicy: 'Spicy' };
export const TAG_STYLE = { halal: 'bg-forest-light text-forest', veg: 'bg-green-50 text-green-700', vegan: 'bg-lime-50 text-lime-700', 'gluten-free': 'bg-amber-50 text-amber-700', spicy: 'bg-chili-light text-chili' };

export const confirmAction = (msg) => window.confirm(msg);
