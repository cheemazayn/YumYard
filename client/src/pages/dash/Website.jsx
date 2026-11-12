import { useEffect, useState } from 'react';
import { Check, ExternalLink, Copy, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../../lib/api';
import { useLoad, Loading, ErrorBox, PageHeader, Field, Toggle, ImageUpload } from '../../components/ui';
import { Storefront, FONTS } from '../Storefront';

const TEMPLATES = [['modern', 'Modern', 'Split hero with a photo and a card menu grid.'], ['classic', 'Classic', 'Full-width photo header and a compact list menu.'], ['bold', 'Bold', 'Large type on a solid color block.']];

export default function Website() {
  const { data: r, loading, error, reload } = useLoad(async () => (await api.get('/manage/restaurant')).data, []);
  const { data: pub } = useLoad(async () => {
    const [b, m] = await Promise.all([api.get('/manage/branches'), api.get('/manage/menu')]);
    return { branches: b.data, menu: m.data };
  }, []);
  const [f, setF] = useState(null);
  const [slug, setSlug] = useState('');
  const [slugState, setSlugState] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (r) { setF({ name: r.name, tagline: r.tagline, about: r.about, cuisine: r.cuisine, cover: r.cover, logo: r.logo, template: r.template, theme: { ...r.theme }, isPublished: r.isPublished, gallery: r.gallery || [] }); setSlug(r.slug); } }, [r]);
  useEffect(() => {
    if (!slug || !r || slug === r.slug) return setSlugState(null);
    const t = setTimeout(() => api.get('/manage/slug-check', { params: { slug } }).then((x) => setSlugState(x.data)).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [slug, r]);

  if (loading && !r) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!f) return null;
  const set = (k, v) => setF({ ...f, [k]: v });
  const url = `${window.location.origin}/r/${slug}`;

  const publish = async () => {
    setBusy(true);
    try {
      if (slug !== r.slug) await api.put('/manage/restaurant/slug', { slug });
      await api.put('/manage/restaurant', { ...f, isPublished: true });
      toast.success('Your website is live'); reload();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const saveDraft = async () => { setBusy(true); try { await api.put('/manage/restaurant', f); toast.success('Saved'); reload(); } catch (e) { toast.error(errMsg(e)); } setBusy(false); };

  const branches = pub?.branches?.filter((b) => b.isActive !== false) || [];
  const previewData = {
    restaurant: { ...r, ...f, slug, _id: r._id },
    branches, branch: branches[0]?._id,
    categories: pub?.menu?.categories || [],
    menu: (pub?.menu?.items || []).filter((i) => i.available).map((i) => ({ ...i, livePrice: i.price })),
    surge: null, reviews: [], rating: { avg: 0, count: 0 }, settings: { taxRate: 0, serviceFee: 0 },
  };

  return (
    <>
      <PageHeader title="Website" sub="Choose a layout, set your colors and fonts, then publish. Changes show in the preview straight away." actions={<>
        <button className="btn-outline" disabled={busy} onClick={saveDraft}>Save changes</button>
        <button className="btn-primary" disabled={busy || slugState?.available === false} onClick={publish}><Check size={15} />{f.isPublished ? 'Update website' : 'Publish website'}</button></>} />
      <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Your web address</h2>
            <div className="flex items-center rounded-md border border-ink/20 bg-white focus-within:ring-2 focus-within:ring-forest/20"><span className="pl-3 text-sm text-ink/50">{window.location.host}/r/</span><input className="w-full bg-transparent py-2 pr-3 text-sm outline-none" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} aria-label="URL name" /></div>
            {slugState && (slugState.available ? <p className="text-xs font-semibold text-forest">That address is available.</p> : <p className="text-xs text-chili">That address is taken. How about <button className="font-bold underline" onClick={() => setSlug(slugState.suggestion)}>{slugState.suggestion}</button>?</p>)}
            <div className="flex items-center justify-between"><Toggle checked={f.isPublished} onChange={(v) => set('isPublished', v)} label={f.isPublished ? 'Published' : 'Hidden from guests'} />
              {r.isPublished && <div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(url); toast.success('Link copied'); }}><Copy size={13} />Copy</button><a className="btn-ghost btn-sm" href={`/r/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={13} />Open</a></div>}</div>
          </section>
          <section className="card p-5"><h2 className="mb-3 font-bold">Layout</h2>
            <div className="grid gap-2">{TEMPLATES.map(([id, n, d]) => <button key={id} onClick={() => set('template', id)} aria-pressed={f.template === id} className={`rounded-lg border p-3 text-left ${f.template === id ? 'border-forest bg-forest-light' : 'border-ink/15 hover:border-ink/40'}`}><p className="text-sm font-bold">{n}</p><p className="text-xs text-ink/60">{d}</p></button>)}</div></section>
          <section className="card space-y-4 p-5"><h2 className="font-bold">Colors and type</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Main color"><div className="flex items-center gap-2"><input type="color" className="h-9 w-12 cursor-pointer rounded border border-ink/20" value={f.theme.primary} onChange={(e) => set('theme', { ...f.theme, primary: e.target.value })} /><span className="font-mono text-xs">{f.theme.primary}</span></div></Field>
              <Field label="Accent color"><div className="flex items-center gap-2"><input type="color" className="h-9 w-12 cursor-pointer rounded border border-ink/20" value={f.theme.secondary} onChange={(e) => set('theme', { ...f.theme, secondary: e.target.value })} /><span className="font-mono text-xs">{f.theme.secondary}</span></div></Field></div>
            <Field label="Heading font"><select className="input" value={f.theme.font} onChange={(e) => set('theme', { ...f.theme, font: e.target.value })}>{FONTS.map((x) => <option key={x}>{x}</option>)}</select></Field></section>
          <section className="card space-y-4 p-5"><h2 className="font-bold">Content</h2>
            <Field label="Restaurant name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Tagline"><input className="input" value={f.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <Field label="Cuisine"><input className="input" value={f.cuisine || ''} onChange={(e) => set('cuisine', e.target.value)} /></Field>
            <Field label="Our story"><textarea className="input" rows={4} value={f.about || ''} onChange={(e) => set('about', e.target.value)} /></Field>
            <ImageUpload label="Cover photo" value={f.cover} onChange={(u) => set('cover', u)} />
            <ImageUpload label="Logo" aspect="aspect-square" value={f.logo} onChange={(u) => set('logo', u)} /></section>
        </div>
        <div>
          <div className="sticky top-20">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink/60"><Eye size={15} />Live preview</p>
            <div className="max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-ink/15 shadow-lift">
              {pub ? <Storefront data={previewData} preview /> : <Loading />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
