import { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, Modal, Field, Toggle, Badge, confirmAction } from '../../components/ui';

export const MapPreview = ({ geo, className = 'h-44' }) => geo?.lat && geo?.lng ? (
  <iframe title="Map preview" loading="lazy" className={`w-full rounded-md border border-ink/10 ${className}`}
    src={`https://www.openstreetmap.org/export/embed.html?bbox=${+geo.lng - 0.008},${+geo.lat - 0.005},${+geo.lng + 0.008},${+geo.lat + 0.005}&layer=mapnik&marker=${geo.lat},${geo.lng}`} />
) : <div className={`flex w-full items-center justify-center rounded-md border border-dashed border-ink/20 bg-mist text-sm text-ink/50 ${className}`}>Set the coordinates to preview the map</div>;

export default function Branches() {
  const { user } = useAuth();
  const { setBranch } = useBranch();
  const owner = user.role === 'owner';
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/branches')).data, []);
  const [m, setM] = useState(null);
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });
  const setGeo = (k) => (e) => setM({ ...m, geo: { ...(m.geo || {}), [k]: e.target.value } });
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setM({ ...m, geo: { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) } }), () => toast.error('Could not read your location. Enter the coordinates instead.'));
  const save = async () => {
    try { m._id ? await api.put(`/manage/branches/${m._id}`, m) : await api.post('/manage/branches', m); toast.success('Branch saved'); setM(null); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (b) => { if (!confirmAction(`Delete ${b.name}? Its menu and stock are removed too.`)) return; try { await api.delete(`/manage/branches/${b._id}`); reload(); } catch (e) { toast.error(errMsg(e)); } };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return (
    <>
      <PageHeader title="Branches" sub="Each branch has its own menu, stock, staff and opening hours, all under one account." actions={owner && <button className="btn-primary" onClick={() => setM({ name: '', address: '', city: '', phone: '', operatingHours: '11:00 AM - 11:00 PM', isActive: true, geo: {} })}><Plus size={15} />Add branch</button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((b) => (
          <article key={b._id} className="card overflow-hidden">
            <MapPreview geo={b.geo} className="h-36 rounded-none border-0" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2"><div><h2 className="font-display text-lg font-bold">{b.name}</h2><p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink/60"><MapPin size={14} className="mt-0.5 shrink-0" />{b.address}{b.city ? `, ${b.city}` : ''}</p></div>{!b.isActive && <Badge>Closed</Badge>}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-ink/50">Revenue, 30 days</p><p className="font-bold">{money(b.revenue)}</p></div><div><p className="text-xs text-ink/50">Orders</p><p className="font-bold">{b.orders}</p></div></div>
              <p className="mt-3 text-xs text-ink/50">{b.operatingHours}{b.phone ? ` · ${b.phone}` : ''}</p>
              <div className="mt-4 flex gap-2"><button className="btn-outline btn-sm" onClick={() => setBranch(b._id)}>Filter dashboard</button><button className="btn-ghost btn-sm" onClick={() => setM({ ...b })}><Pencil size={14} />Edit</button>{owner && data.length > 1 && <button className="btn-ghost btn-sm text-chili" onClick={() => del(b)}><Trash2 size={14} />Delete</button>}</div>
            </div>
          </article>))}
      </div>
      <Modal open={!!m} onClose={() => setM(null)} wide title={m?._id ? `Edit ${m.name}` : 'Add a branch'} footer={<><button className="btn-outline" onClick={() => setM(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save branch</button></>}>
        {m && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Branch name" hint="For example: Gulberg or F-7 Markaz"><input className="input" value={m.name} onChange={set('name')} /></Field><Field label="City"><input className="input" value={m.city || ''} onChange={set('city')} /></Field>
          <Field label="Address" className="sm:col-span-2"><input className="input" value={m.address} onChange={set('address')} /></Field>
          <Field label="Phone"><input className="input" value={m.phone || ''} onChange={set('phone')} /></Field><Field label="Operating hours"><input className="input" value={m.operatingHours || ''} onChange={set('operatingHours')} /></Field>
          <div className="sm:col-span-2"><span className="label">Location on the map</span>
            <div className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2"><input className="input" placeholder="Latitude" value={m.geo?.lat ?? ''} onChange={setGeo('lat')} /><input className="input" placeholder="Longitude" value={m.geo?.lng ?? ''} onChange={setGeo('lng')} /><button type="button" className="btn-outline" onClick={locate}><LocateFixed size={15} />Use my location</button></div>
            <MapPreview geo={m.geo} />
            <p className="mt-1 text-xs text-ink/50">Tip: right-click your place in any map app and copy the coordinates.</p></div>
          <div className="sm:col-span-2"><Toggle checked={m.isActive !== false} onChange={(v) => setM({ ...m, isActive: v })} label="Branch is open for online orders" /></div>
        </div>}
      </Modal>
    </>
  );
}
