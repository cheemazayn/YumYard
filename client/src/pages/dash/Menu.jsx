import { useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Sparkles, Flame, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useLoad, Loading, ErrorBox, PageHeader, Img, Modal, Field, Toggle, Empty, Badge, ImageUpload, TAG_LABEL, TAG_STYLE, confirmAction } from '../../components/ui';

const TAGS = ['halal', 'veg', 'vegan', 'gluten-free', 'spicy'];
const blank = (category) => ({ name: '', description: '', category, basePrice: '', cost: '', prepMinutes: 15, image: '', dietaryTags: [], recipe: [] });

function ItemForm({ open, onClose, item, categories, branch, onSaved, ingredientNames }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) setF(item ? { ...item, basePrice: item.basePrice, recipe: item.recipe || [] } : blank(categories[0]?._id)); }
  if (!f) return null;
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async () => {
    setBusy(true);
    try {
      if (item) await api.put(`/manage/menu/${item._id}`, f); else await api.post('/manage/menu', { ...f, branch });
      toast.success(item ? 'Dish updated' : 'Dish added'); onSaved(); onClose();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const generate = async () => {
    setGen(true);
    try { const { data } = await api.post('/manage/ai/image', { name: f.name, description: f.description }); set('image', data.url); toast.success('Image generated. Save the dish to keep it.'); }
    catch (e) { toast.error(errMsg(e)); }
    setGen(false);
  };
  return (
    <Modal open={open} onClose={onClose} wide title={item ? `Edit ${item.name}` : 'Add a dish'} footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save dish'}</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dish name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
        <Field label="Description" className="sm:col-span-2"><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Price (Rs)"><input className="input" inputMode="decimal" value={f.basePrice} onChange={(e) => set('basePrice', e.target.value)} /></Field>
        <Field label="Food cost per portion (Rs)" hint="Used to rank your most profitable dishes."><input className="input" inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        <Field label="Preparation time (minutes)"><input className="input" type="number" min="1" value={f.prepMinutes} onChange={(e) => set('prepMinutes', e.target.value)} /></Field>
        <div><span className="label">Dietary tags</span><div className="flex flex-wrap gap-1.5">{TAGS.map((t) => <button type="button" key={t} aria-pressed={f.dietaryTags.includes(t)} onClick={() => set('dietaryTags', f.dietaryTags.includes(t) ? f.dietaryTags.filter((x) => x !== t) : [...f.dietaryTags, t])} className={`rounded-full border px-3 py-1 text-xs font-semibold ${f.dietaryTags.includes(t) ? 'border-forest bg-forest text-white' : 'border-ink/20'}`}>{TAG_LABEL[t]}</button>)}</div></div>
        <div className="sm:col-span-2">
          <ImageUpload label="Photo" value={f.image} onChange={(u) => set('image', u)} />
          <button type="button" className="btn-accent btn-sm mt-2" disabled={gen || !f.name.trim()} onClick={generate}><Sparkles size={14} />{gen ? 'Generating' : 'Generate with AI'}</button>
          <span className="ml-2 text-xs text-ink/50">Uses the dish name and description. Generated images can take a few seconds to appear.</span>
        </div>
        <div className="sm:col-span-2">
          <span className="label">Ingredients per portion (deducted from stock automatically)</span>
          <div className="space-y-2">
            {f.recipe.map((r, i) => (
              <div key={i} className="flex gap-2"><input className="input flex-1" list="ingredients" placeholder="Ingredient name, as in Inventory" value={r.name} onChange={(e) => set('recipe', f.recipe.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input w-28" type="number" step="0.01" min="0" placeholder="Qty" value={r.qty} onChange={(e) => set('recipe', f.recipe.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                <button type="button" className="btn-ghost px-2" onClick={() => set('recipe', f.recipe.filter((_, j) => j !== i))} aria-label="Remove ingredient"><X size={16} /></button></div>
            ))}
          </div>
          <datalist id="ingredients">{ingredientNames.map((n) => <option key={n} value={n} />)}</datalist>
          <button type="button" className="btn-outline btn-sm mt-2" onClick={() => set('recipe', [...f.recipe, { name: '', qty: '' }])}><Plus size={14} />Add ingredient</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Menu() {
  const { user } = useAuth();
  const { branches, branch: ctxBranch } = useBranch();
  const lead = ['owner', 'manager'].includes(user.role);
  const [branch, setBranch] = useState(ctxBranch || '');
  const b = branch || ctxBranch || branches[0]?._id || '';
  const { data, loading, error, reload } = useLoad(async () => (b ? (await api.get('/manage/menu', { params: { branch: b } })).data : null), [b]);
  const { data: inv } = useLoad(async () => (await api.get('/manage/inventory')).data, []);
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cat, setCat] = useState(null);
  const [copy, setCopy] = useState(false);
  const [target, setTarget] = useState('');
  const ingredientNames = [...new Set((inv || []).map((i) => i.name))];

  const toggle = async (m) => { try { await api.patch(`/manage/menu/${m._id}/availability`, { available: !m.available }); reload(); toast.success(m.available ? `${m.name} hidden from the menu` : `${m.name} is back on the menu`); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (m) => { if (!confirmAction(`Delete ${m.name}?`)) return; try { await api.delete(`/manage/menu/${m._id}`); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const saveCat = async () => {
    try { cat._id ? await api.put(`/manage/categories/${cat._id}`, { name: cat.name }) : await api.post('/manage/categories', { name: cat.name, branch: b }); setCat(null); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const delCat = async (c) => { if (!confirmAction(`Delete the category ${c.name}?`)) return; try { await api.delete(`/manage/categories/${c._id}`); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const doCopy = async () => {
    try { const { data: r } = await api.post('/manage/menu/copy', { from: b, to: target }); toast.success(`${r.copied} dishes copied${r.skipped ? `, ${r.skipped} already existed` : ''}`); setCopy(false); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title="Menu" sub="Every branch has its own menu. Hide a dish the moment it runs out." actions={<>
        {branches.length > 1 && user.role !== 'staff' && <select className="input w-auto" value={b} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">{branches.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select>}
        {user.role === 'owner' && branches.length > 1 && <button className="btn-outline" onClick={() => { setCopy(true); setTarget(branches.find((x) => x._id !== b)?._id || ''); }}><Copy size={15} />Copy to another branch</button>}
        {lead && <button className="btn-outline" onClick={() => setCat({ name: '' })}><Plus size={15} />Category</button>}
        {lead && <button className="btn-primary" disabled={!data?.categories.length} onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={15} />Add dish</button>}
      </>} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.categories.length ? <Empty title="Start with a category" hint="Create categories like Starters or Mains, then add dishes to them." action={lead && <button className="btn-primary" onClick={() => setCat({ name: '' })}>Add a category</button>} /> : (
        <div className="space-y-8">
          {data.categories.map((c) => {
            const list = data.items.filter((i) => i.category === c._id);
            return (
              <section key={c._id}>
                <div className="mb-3 flex items-center gap-2"><h2 className="text-lg font-bold">{c.name}</h2><span className="text-sm text-ink/50">{list.length}</span>
                  {lead && <><button className="btn-ghost btn-sm" onClick={() => setCat(c)} aria-label="Rename category"><Pencil size={13} /></button><button className="btn-ghost btn-sm" onClick={() => delCat(c)} aria-label="Delete category"><Trash2 size={13} className="text-chili" /></button></>}</div>
                {!list.length ? <p className="rounded-lg border border-dashed border-ink/20 p-5 text-sm text-ink/50">No dishes in this category yet.</p> : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((m) => (
                      <article key={m._id} className={`card flex gap-3 p-3 ${m.available ? '' : 'opacity-60'}`}>
                        <Img src={m.image} alt="" className="h-24 w-24 shrink-0 rounded-md object-cover" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2"><h3 className="truncate font-display font-bold">{m.name}</h3>{m.promoLabel && <Badge className="bg-saffron text-ink">{m.promoLabel}</Badge>}</div>
                          <p className="text-sm"><b>{money(m.price)}</b>{m.price !== m.basePrice && <span className="ml-1.5 text-xs text-ink/40 line-through">{money(m.basePrice)}</span>}<span className="ml-2 text-xs text-ink/50">{m.prepMinutes} min</span></p>
                          <div className="mt-1 flex flex-wrap gap-1">{m.dietaryTags.map((t) => <Badge key={t} className={TAG_STYLE[t]}>{t === 'spicy' && <Flame size={10} className="mr-0.5" />}{TAG_LABEL[t]}</Badge>)}</div>
                          <div className="mt-auto flex items-center justify-between pt-2"><Toggle checked={m.available} onChange={() => toggle(m)} label={m.available ? 'On menu' : 'Out of stock'} />
                            {lead && <span className="flex"><button className="btn-ghost btn-sm" onClick={() => { setEdit(m); setFormOpen(true); }} aria-label={`Edit ${m.name}`}><Pencil size={14} /></button><button className="btn-ghost btn-sm" onClick={() => del(m)} aria-label={`Delete ${m.name}`}><Trash2 size={14} className="text-chili" /></button></span>}</div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <ItemForm open={formOpen} onClose={() => setFormOpen(false)} item={edit} categories={data?.categories || []} branch={b} onSaved={reload} ingredientNames={ingredientNames} />
      <Modal open={!!cat} onClose={() => setCat(null)} title={cat?._id ? 'Rename category' : 'New category'} footer={<><button className="btn-outline" onClick={() => setCat(null)}>Cancel</button><button className="btn-primary" disabled={!cat?.name?.trim()} onClick={saveCat}>Save</button></>}>
        <Field label="Category name"><input className="input" value={cat?.name || ''} onChange={(e) => setCat({ ...cat, name: e.target.value })} autoFocus /></Field>
      </Modal>
      <Modal open={copy} onClose={() => setCopy(false)} title="Copy this menu" footer={<><button className="btn-outline" onClick={() => setCopy(false)}>Cancel</button><button className="btn-primary" onClick={doCopy}>Copy menu</button></>}>
        <p className="mb-3 text-sm text-ink/70">Copies every category and dish from <b>{branches.find((x) => x._id === b)?.name}</b>. Dishes that already exist at the destination are skipped.</p>
        <Field label="Copy to"><select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>{branches.filter((x) => x._id !== b).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></Field>
      </Modal>
    </>
  );
}
