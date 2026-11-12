import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, fmtDate } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, Stars, Badge, Empty, Tabs } from '../../components/ui';

const TONE = { positive: 'bg-forest-light text-forest', neutral: 'bg-mist text-ink/70', negative: 'bg-chili-light text-chili' };

export default function Reviews() {
  const { branch } = useBranch();
  const [filter, setFilter] = useState('');
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/reviews', { params: { branch, sentiment: filter || undefined } })).data, [branch, filter]);
  const [reply, setReply] = useState({});
  const [open, setOpen] = useState(null);
  const send = async (r) => {
    try { await api.patch(`/manage/reviews/${r._id}/reply`, { reply: reply[r._id] }); toast.success('Reply published'); setOpen(null); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title="Reviews" sub="Every review is tagged by mood and topic. Replies appear publicly on your website." />
      <Tabs value={filter} onChange={setFilter} tabs={[{ id: '', label: 'All' }, { id: 'negative', label: 'Negative' }, { id: 'neutral', label: 'Neutral' }, { id: 'positive', label: 'Positive' }]} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data.length ? <Empty title="No reviews here" /> : (
        <ul className="space-y-3">{data.map((r) => (
          <li key={r._id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3"><Stars value={r.rating} size={15} /><span className="text-sm font-semibold">{r.name}</span><span className="text-xs text-ink/50">{fmtDate(r.createdAt)} · {r.branch?.name}</span></div>
              <div className="flex flex-wrap gap-1"><Badge className={TONE[r.sentiment?.label]}>{r.sentiment?.label}</Badge>{r.sentiment?.topics?.map((t) => <Badge key={t}>{t}</Badge>)}</div>
            </div>
            {r.comment ? <p className="mt-3 text-sm leading-relaxed">{r.comment}</p> : <p className="mt-3 text-sm text-ink/40">Rating only</p>}
            {r.reply ? <div className="mt-3 rounded-md bg-paper p-3 text-sm"><p className="text-xs font-semibold text-ink/60">Your reply, {fmtDate(r.repliedAt)}</p><p className="mt-1">{r.reply}</p></div> : open === r._id ? (
              <div className="mt-3 space-y-2"><textarea className="input" rows={3} placeholder="Write a public reply" value={reply[r._id] || ''} onChange={(e) => setReply({ ...reply, [r._id]: e.target.value })} autoFocus /><div className="flex gap-2"><button className="btn-primary btn-sm" onClick={() => send(r)}>Publish reply</button><button className="btn-ghost btn-sm" onClick={() => setOpen(null)}>Cancel</button></div></div>
            ) : <button className="btn-outline btn-sm mt-3" onClick={() => setOpen(r._id)}><MessageSquare size={13} />Reply</button>}
          </li>))}</ul>
      )}
    </>
  );
}
