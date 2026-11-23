'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, use, useState } from 'react';
import { BookingDialog } from '@/components/booking';
import { Elevation } from '@/components/elevation';
import { HandoverHistory } from '@/components/finance';
import { PhotoGrid } from '@/components/photos';
import {
  Badge,
  Button,
  cx,
  Dialog,
  Empty,
  ErrorState,
  Input,
  PageHeader,
  Panel,
  ProgressBar,
  Select,
  Spinner,
  Table,
  Tabs,
  Textarea,
  useErrorToast,
  useToast,
} from '@/components/ui';
import { del, get, patch, post, upload } from '@/lib/api';
import { date, inputDate, label, relative, taka } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { Page, ProjectDetail, Stage, Update, UserRow } from '@/lib/types';

type Tab = 'overview' | 'flats' | 'updates' | 'handover' | 'documents' | 'risk' | 'settings';

function useProject(id: string) {
  return useQuery({ queryKey: ['project', id], queryFn: () => get<ProjectDetail>(`/projects/${id}`) });
}

// ------------------------------------------------------------------ stages

function StagesTable({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const [edit, setEdit] = useState<Stage | null>(null);
  const [value, setValue] = useState(0);
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => patch(`/milestones/${edit!.id}/progress`, { progress: value, reason: reason || undefined }),
    onSuccess: () => {
      toast(value === 100 ? `${edit!.name} marked complete. Linked installments are now due.` : 'Progress saved');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['project', project.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError,
  });
  const total = project.milestones.reduce((s, m) => s + m.weight, 0);
  return (
    <>
      {total !== 100 && <p className="mb-3 rounded bg-brass-soft px-3 py-2 text-sm">Stage weights add up to {total}, not 100. Overall progress is still calculated correctly.</p>}
      <Table head={['Stage', 'Weight', 'Planned finish', 'Progress', '']}>
        {project.milestones.map((m) => (
          <tr key={m.id}>
            <td className="font-medium">{m.name}</td>
            <td className="figure text-rebar">{m.weight}</td>
            <td className="whitespace-nowrap text-rebar">
              {m.completedAt ? <span className="text-done">Done {date(m.completedAt)}</span> : date(m.plannedEnd)}
              {!m.completedAt && m.plannedEnd && new Date(m.plannedEnd) < new Date() && <span className="block text-[13px] text-overdue">Past planned date</span>}
            </td>
            <td className="w-48">
              <div className="flex items-center gap-2">
                <ProgressBar value={m.progress} tone={m.progress === 100 ? 'done' : 'brass'} labelText={`${m.name} progress`} />
                <span className="figure w-10 text-right text-sm">{m.progress}%</span>
              </div>
            </td>
            <td className="text-right">
              <button className="text-sm font-medium underline-offset-4 hover:underline" onClick={() => { setEdit(m); setValue(m.progress); setReason(''); }}>
                Update
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit ? `Progress: ${edit.name}` : ''}>
        {edit && (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-4">
            <div>
              <label htmlFor="pv" className="text-sm font-medium">Progress: <span className="figure">{value}%</span></label>
              <input id="pv" type="range" min={0} max={100} step={5} value={value} onChange={(e) => setValue(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand-accent)]" />
            </div>
            {value < edit.progress && <Textarea label="Why is progress going down?" hint="Required, at least 10 characters. This is recorded in the audit log." value={reason} onChange={(e) => setReason(e.target.value)} />}
            {value === 100 && edit.progress < 100 && <p className="rounded bg-brass-soft px-3 py-2 text-sm">Marking this stage complete makes every installment linked to it due, and buyers are notified.</p>}
            <Button type="submit" loading={save.isPending} disabled={value === edit.progress || (value < edit.progress && reason.trim().length < 10)}>Save progress</Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------------- flats

interface UnitRow {
  id: string;
  code: string;
  floor: number;
  sizeSqft: number;
  bedrooms: number | null;
  listPrice: string;
  status: string;
  purchase: { id: string; buyerName: string; status: string } | null;
}
interface PurchaseRow {
  id: string;
  status: string;
  unit: { code: string };
  buyer: { name: string };
  totalPrice: string;
  paid: string;
  balance: string;
  overdue: boolean;
  nextDue: { label: string; dueDate: string | null; amount: string; status: string } | null;
}

function Flats({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const units = useQuery({ queryKey: ['units', project.id], queryFn: () => get<Page<UnitRow>>(`/projects/${project.id}/units?pageSize=100`).then((p) => p.items) });
  const purchases = useQuery({ queryKey: ['purchases', project.id], queryFn: () => get<PurchaseRow[]>(`/projects/${project.id}/purchases`) });
  const [booking, setBooking] = useState<UnitRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [unit, setUnit] = useState({ code: '', floor: '1', sizeSqft: '1200', bedrooms: '3', listPrice: '' });
  const add = useMutation({
    mutationFn: () => post(`/projects/${project.id}/units`, { units: [{ code: unit.code, floor: Number(unit.floor), sizeSqft: Number(unit.sizeSqft), bedrooms: Number(unit.bedrooms), listPrice: unit.listPrice }] }),
    onSuccess: () => { toast('Flat added'); setAddOpen(false); qc.invalidateQueries({ queryKey: ['units', project.id] }); },
    onError,
  });
  const importCsv = useMutation({
    mutationFn: (file: File) => { const f = new FormData(); f.append('file', file); return upload<{ created: number }>(`/projects/${project.id}/units/import`, f); },
    onSuccess: (r) => { toast(`${r.created} flats imported`); qc.invalidateQueries({ queryKey: ['units', project.id] }); },
    onError,
  });
  const [filter, setFilter] = useState('');
  const [removing, setRemoving] = useState<UnitRow | null>(null);
  const removeUnit = useMutation({
    mutationFn: (u: UnitRow) => del(`/units/${u.id}`),
    onSuccess: (_r, u) => { toast(`Flat ${u.code} deleted`); setRemoving(null); qc.invalidateQueries({ queryKey: ['units', project.id] }); },
    onError: (e) => { setRemoving(null); onError(e); },
  });

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Bookings" flush>
        {purchases.isLoading ? <Spinner /> : purchases.data?.length ? (
          <Table head={['Flat', 'Buyer', 'Paid', 'Balance', 'Next due']}>
            {purchases.data.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/purchases/${p.id}`} className="font-medium hover:underline">{p.unit.code}</Link>{p.status !== 'ACTIVE' && <span className="ml-2"><Badge status={p.status} /></span>}</td>
                <td>{p.buyer.name}</td>
                <td className="figure whitespace-nowrap">{taka(p.paid, { compact: true })}</td>
                <td className="figure whitespace-nowrap">{taka(p.balance, { compact: true })}</td>
                <td>{p.nextDue ? <><Badge status={p.nextDue.status} /> <span className="text-sm text-rebar">{p.nextDue.dueDate ? date(p.nextDue.dueDate) : ''}</span></> : <span className="text-rebar">—</span>}</td>
              </tr>
            ))}
          </Table>
        ) : <p className="p-5 text-rebar">No bookings yet. Choose an available flat below to record a booking.</p>}
      </Panel>
      <Panel
        title="Flats"
        flush
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 rounded border border-line px-2 text-sm">
              <option value="">All</option><option value="AVAILABLE">Available</option><option value="BOOKED">Booked</option><option value="SOLD">Sold</option>
            </select>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-line px-3 text-sm hover:border-rebar">
              <Upload className="size-4" aria-hidden /> Import CSV
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ''; }} />
            </label>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>Add flat</Button>
          </div>
        }
      >
        {units.isLoading ? <Spinner /> : units.data?.length ? (
          <Table head={['Flat', 'Floor', 'Size', 'Price', 'Status', '']}>
            {units.data.filter((u) => !filter || u.status === filter).map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.code}</td>
                <td>{u.floor}</td>
                <td className="whitespace-nowrap">{u.sizeSqft} sqft{u.bedrooms ? `, ${u.bedrooms} bed` : ''}</td>
                <td className="figure whitespace-nowrap">{taka(u.listPrice, { compact: true })}</td>
                <td><Badge status={u.status} />{u.purchase && <span className="block text-[13px] text-rebar">{u.purchase.buyerName}</span>}</td>
                <td className="whitespace-nowrap text-right">
                  {u.status === 'AVAILABLE' && (
                    <span className="inline-flex items-center gap-3">
                      <button className="text-sm font-medium hover:underline" onClick={() => setBooking(u)}>Record booking</button>
                      <button className="rounded p-1 text-rebar hover:bg-overdue-soft hover:text-overdue" aria-label={`Delete flat ${u.code}`} title="Delete flat" onClick={() => setRemoving(u)}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : <p className="p-5 text-rebar">No flats yet. Add them one by one or import a CSV file with the columns code, floor, sizeSqft, bedrooms, listPrice.</p>}
      </Panel>
      <Dialog open={!!removing} onClose={() => setRemoving(null)} title={`Delete flat ${removing?.code ?? ''}?`}>
        <p className="text-rebar">The flat is removed from this project. Flats that were ever booked cannot be deleted, because their bookings and payments are kept on record.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Keep flat</Button>
          <Button variant="danger" loading={removeUnit.isPending} onClick={() => removing && removeUnit.mutate(removing)}>Delete flat</Button>
        </div>
      </Dialog>
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add a flat">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(); }} className="grid gap-4 sm:grid-cols-2">
          <Input label="Flat code" placeholder="A-5" value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })} />
          <Input label="Floor" type="number" value={unit.floor} onChange={(e) => setUnit({ ...unit, floor: e.target.value })} />
          <Input label="Size (sqft)" type="number" value={unit.sizeSqft} onChange={(e) => setUnit({ ...unit, sizeSqft: e.target.value })} />
          <Input label="Bedrooms" type="number" value={unit.bedrooms} onChange={(e) => setUnit({ ...unit, bedrooms: e.target.value })} />
          <Input label="Price (Tk)" inputMode="decimal" value={unit.listPrice} onChange={(e) => setUnit({ ...unit, listPrice: e.target.value.replace(/[^\d.]/g, '') })} />
          <div className="flex items-end"><Button type="submit" loading={add.isPending} disabled={!unit.code || !unit.listPrice}>Add flat</Button></div>
        </form>
      </Dialog>
      {booking && <BookingDialog project={project} unit={booking} onClose={() => setBooking(null)} />}
    </div>
  );
}

// ----------------------------------------------------------------- updates

function Updates({ project }: { project: ProjectDetail }) {
  const q = useQuery({ queryKey: ['updates', project.id, 'all'], queryFn: () => get<Update[]>(`/projects/${project.id}/updates`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <Empty title="No updates yet">Site engineers post updates from their phones. They appear here for review.</Empty>;
  return (
    <div className="flex flex-col gap-4">
      {q.data.map((u) => (
        <Panel key={u.id} title={u.title} action={<span className="flex items-center gap-2"><Badge status={u.status} /><span className="text-sm text-rebar">{relative(u.createdAt)}</span></span>}>
          {u.text && <p className="mb-3 max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed">{u.text}</p>}
          <PhotoGrid photos={u.photos} size="sm" />
          <p className="mt-2 text-sm text-rebar">
            By {u.authorName}{u.milestoneName ? ` · ${u.milestoneName} ${u.progressAfter ?? ''}%` : ''}
            {u.status === 'PENDING_REVIEW' && <> · <Link href="/admin/reviews" className="font-medium text-ink underline">Review now</Link></>}
          </p>
        </Panel>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- handover

function Handover({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const [newDate, setNewDate] = useState(inputDate(project.expectedHandoverDate));
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => post(`/projects/${project.id}/handover-date`, { newDate: new Date(newDate).toISOString(), reason }),
    onSuccess: () => { toast('Handover date changed. All buyers have been notified.'); setReason(''); qc.invalidateQueries({ queryKey: ['project', project.id] }); },
    onError,
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title="What buyers see">
        <HandoverHistory original={project.originalHandoverDate} expected={project.expectedHandoverDate} delayDays={project.delayDays} history={project.handoverHistory} />
      </Panel>
      <Panel title="Change the expected date">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-4">
          <Input label="New expected handover date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <Textarea label="Reason (shown to every buyer)" hint={`${reason.trim().length}/20 characters minimum. Be specific and honest.`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          <p className="text-sm text-rebar">Buyers get an in-app message, an email and an SMS. The change is permanent in the history.</p>
          <Button type="submit" loading={save.isPending} disabled={reason.trim().length < 20 || newDate === inputDate(project.expectedHandoverDate)}>Change date and notify buyers</Button>
        </form>
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------- documents

interface DocRow { id: string; title: string; type: string; visibility: string; indexStatus: string; indexError: string | null; createdAt: string; purchaseId: string | null }

function Documents({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const me = useMe();
  const q = useQuery({ queryKey: ['docs', project.id], queryFn: () => get<DocRow[]>(`/documents?projectId=${project.id}`), refetchInterval: (query) => (query.state.data?.some((d) => d.indexStatus === 'NOT_INDEXED') ? 3000 : false) });
  const purchases = useQuery({ queryKey: ['purchases', project.id], queryFn: () => get<PurchaseRow[]>(`/projects/${project.id}/purchases`) });
  const [form, setForm] = useState({ title: '', type: 'OTHER', visibility: 'PROJECT_BUYERS', purchaseId: '' });
  const [file, setFile] = useState<File | null>(null);
  const send = useMutation({
    mutationFn: () => {
      const f = new FormData();
      f.append('title', form.title); f.append('type', form.type); f.append('visibility', form.visibility);
      if (form.visibility === 'PURCHASE_BUYER') f.append('purchaseId', form.purchaseId); else f.append('projectId', project.id);
      f.append('file', file!);
      return upload('/documents', f);
    },
    onSuccess: () => { toast('Document uploaded. The assistant can use it in a moment.'); setForm({ ...form, title: '' }); setFile(null); qc.invalidateQueries({ queryKey: ['docs', project.id] }); },
    onError,
  });
  const open = useMutation({ mutationFn: (id: string) => get<{ url: string }>(`/documents/${id}/url`), onSuccess: (r) => window.open(r.url, '_blank', 'noopener'), onError });
  const reindex = useMutation({ mutationFn: (id: string) => post(`/documents/${id}/reindex`), onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', project.id] }), onError });
  const remove = useMutation({ mutationFn: (id: string) => del(`/documents/${id}`), onSuccess: () => { toast('Document deleted'); qc.invalidateQueries({ queryKey: ['docs', project.id] }); }, onError });
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Documents" flush>
        {q.isLoading ? <Spinner /> : q.data?.length ? (
          <Table head={['Document', 'Who can see it', 'AI assistant', '']}>
            {q.data.map((d) => (
              <tr key={d.id}>
                <td><button onClick={() => open.mutate(d.id)} className="text-left font-medium hover:underline">{d.title}</button><span className="block text-[13px] text-rebar">{label(d.type)} · {date(d.createdAt)}</span></td>
                <td className="text-sm">{label(d.visibility)}</td>
                <td><Badge status={d.indexStatus} />{d.indexError && <span className="block text-[13px] text-rebar">{d.indexError}</span>}</td>
                <td className="whitespace-nowrap text-right">
                  <button aria-label="Re-read for the assistant" title="Re-read for the assistant" className="rounded p-1.5 text-rebar hover:bg-concrete hover:text-ink" onClick={() => reindex.mutate(d.id)}><RefreshCw className="size-4" /></button>
                  {me.data?.role === 'ORG_ADMIN' && <button aria-label="Delete document" title="Delete" className="rounded p-1.5 text-rebar hover:bg-overdue-soft hover:text-overdue" onClick={() => confirm(`Delete "${d.title}"?`) && remove.mutate(d.id)}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <p className="p-5 text-rebar">No documents yet.</p>}
      </Panel>
      <Panel title="Upload a document">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); send.mutate(); }} className="flex flex-col gap-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['ALLOTMENT_LETTER', 'AGREEMENT', 'RECEIPT', 'APPROVAL', 'FLOOR_PLAN', 'OTHER'].map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </Select>
          <Select label="Who can see it" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
            <option value="PROJECT_BUYERS">All buyers of this project</option>
            <option value="PURCHASE_BUYER">One buyer</option>
            <option value="INTERNAL">Staff only</option>
          </Select>
          {form.visibility === 'PURCHASE_BUYER' && (
            <Select label="Buyer" value={form.purchaseId} onChange={(e) => setForm({ ...form, purchaseId: e.target.value })}>
              <option value="">Choose a booking</option>
              {purchases.data?.map((p) => <option key={p.id} value={p.id}>{p.unit.code}, {p.buyer.name}</option>)}
            </Select>
          )}
          <div>
            <label className="text-sm font-medium" htmlFor="docfile">File (PDF, JPG or PNG, up to 20 MB)</label>
            <input id="docfile" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-sm" />
          </div>
          <p className="text-[13px] text-rebar">Text in the document is read so the AI assistant can answer buyer questions from it. Staff-only documents are never shown to buyers.</p>
          <Button type="submit" loading={send.isPending} disabled={!file || form.title.trim().length < 2 || (form.visibility === 'PURCHASE_BUYER' && !form.purchaseId)}>Upload</Button>
        </form>
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------------- risk

interface RiskData {
  latest: { score: number; level: string; factors: Array<{ label: string; detail: string; points: number }>; explanation: string | null; computedAt: string } | null;
  history: Array<{ score: number; level: string; computedAt: string }>;
}

function Risk({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const onError = useErrorToast();
  const q = useQuery({ queryKey: ['risk', project.id], queryFn: () => get<RiskData>(`/projects/${project.id}/risk`) });
  const run = useMutation({ mutationFn: () => post(`/projects/${project.id}/risk/recompute`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk', project.id] }); qc.invalidateQueries({ queryKey: ['project', project.id] }); }, onError });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data!.latest;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Delay risk" action={<Button size="sm" variant="secondary" loading={run.isPending} onClick={() => run.mutate()}><Sparkles className="size-4" aria-hidden /> Check again now</Button>}>
        {!r ? <p className="text-rebar">Not calculated yet. It runs every morning, or press &ldquo;Check again now&rdquo;.</p> : (
          <>
            <div className="flex items-center gap-4">
              <p className="figure text-5xl font-semibold">{r.score}</p>
              <div><Badge status={r.level}>{label(r.level)} risk</Badge><p className="mt-1 text-sm text-rebar">Out of 100 · checked {relative(r.computedAt)}</p></div>
            </div>
            {r.explanation && <p className="mt-5 max-w-[70ch] whitespace-pre-line leading-relaxed">{r.explanation}</p>}
            {r.factors.length > 0 && (
              <ul className="mt-5 divide-y divide-line border-t border-line">
                {r.factors.map((f) => (
                  <li key={f.label} className="flex items-start justify-between gap-4 py-3">
                    <span><span className="font-medium">{f.label}</span><span className="block text-sm text-rebar">{f.detail}</span></span>
                    <span className="figure whitespace-nowrap font-semibold text-overdue">+{f.points}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[13px] text-rebar">The score comes from fixed, visible rules (schedule gap, overdue stage, missing updates, handover changes, pace). The AI only writes the explanation.</p>
          </>
        )}
      </Panel>
      <Panel title="Last 30 checks">
        {q.data!.history.length > 1 ? (
          <>
            <div className="flex h-32 items-end gap-1 border-b border-line" aria-label="Risk score history, oldest to newest">
              {q.data!.history.map((h, i) => (
                <div key={i} title={`${date(h.computedAt)}: ${h.score}`} className={cx('max-w-6 rounded-t-sm', h.level === 'HIGH' ? 'bg-overdue' : h.level === 'MEDIUM' ? 'bg-[var(--brand-accent)]' : 'bg-done')} style={{ height: `${Math.max(4, h.score)}%`, flex: 1 }} />
              ))}
            </div>
            <p className="mt-2 flex justify-between text-[13px] text-rebar"><span>{date(q.data!.history[0].computedAt)}</span><span>Today</span></p>
          </>
        ) : (
          <p className="text-rebar">The score is checked every morning at 8:00. A trend appears here after a few days of checks.</p>
        )}
      </Panel>
    </div>
  );
}

// ----------------------------------------------------------------- settings

function Settings({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const [form, setForm] = useState({ name: project.name, location: project.location, description: project.description ?? '', isPublic: project.isPublic, status: project.status });
  const engineers = useQuery({ queryKey: ['engineers'], queryFn: () => get<Page<UserRow>>('/engineers?pageSize=100') });
  const [eng, setEng] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['project', project.id] });
  const save = useMutation({ mutationFn: () => patch(`/projects/${project.id}`, form), onSuccess: () => { toast('Project saved'); refresh(); }, onError });
  const assign = useMutation({ mutationFn: () => post(`/projects/${project.id}/assignments`, { userId: eng }), onSuccess: () => { setEng(''); refresh(); }, onError });
  const unassign = useMutation({ mutationFn: (id: string) => del(`/projects/${project.id}/assignments/${id}`), onSuccess: refresh, onError });
  const cover = useMutation({ mutationFn: (file: File) => { const f = new FormData(); f.append('file', file); return upload(`/projects/${project.id}/cover`, f); }, onSuccess: () => { toast('Cover photo updated'); refresh(); }, onError });
  const me = useMe();
  const router = useRouter();
  const [confirmName, setConfirmName] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => del(`/projects/${project.id}`),
    onSuccess: () => { toast(`${project.name} deleted`); qc.invalidateQueries({ queryKey: ['projects'] }); router.push('/admin/projects'); },
    onError: (e) => { setDeleteOpen(false); onError(e); },
  });
  const booked = (project.unitCounts ?? []).some((c) => (c.status === 'BOOKED' || c.status === 'SOLD') && c.count > 0);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title="Project details">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {['PLANNING', 'UNDER_CONSTRUCTION', 'COMPLETED', 'HANDED_OVER'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="size-4 accent-[var(--brand-ink)]" /> Show on the public website</label>
          <div><Button type="submit" loading={save.isPending}>Save details</Button></div>
        </form>
      </Panel>
      <div className="flex flex-col gap-6">
        <Panel title="Site engineers">
          <ul className="mb-4 divide-y divide-line">
            {project.engineers?.length ? project.engineers.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2"><span>{e.name} <span className="text-sm text-rebar">{e.email}</span></span><button className="text-sm text-overdue hover:underline" onClick={() => unassign.mutate(e.id)}>Remove</button></li>
            )) : <li className="py-2 text-rebar">No engineers assigned. Engineers can only post updates for projects they are assigned to.</li>}
          </ul>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Select label="Add an engineer" value={eng} onChange={(e) => setEng(e.target.value)}><option value="">Choose</option>{engineers.data?.items.filter((u) => !project.engineers?.some((x) => x.id === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></div>
            <Button variant="secondary" disabled={!eng} loading={assign.isPending} onClick={() => assign.mutate()}>Assign</Button>
          </div>
        </Panel>
        <Panel title="Cover photo">
          {project.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.coverImageUrl} loading="lazy" decoding="async" alt={`${project.name} cover`} className="mb-3 aspect-video w-full rounded object-cover" />
          )}
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line bg-slab px-3 text-[15px] font-medium hover:border-rebar focus-within:ring-2 focus-within:ring-[var(--brand-accent)]">
            {cover.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {project.coverImageUrl ? 'Replace cover photo' : 'Upload a cover photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) cover.mutate(f); e.target.value = ''; }} />
          </label>
          <p className="mt-2 text-[13px] text-rebar">JPG, PNG or WebP, up to 10 MB. Shown on the public website and to buyers.</p>
        </Panel>
        {me.data?.role === 'ORG_ADMIN' && (
          <Panel title="Delete project">
            {booked ? (
              <p className="text-rebar">This project has bookings, so it cannot be deleted: bookings and payments are kept as financial records. When the work is done, set its status to Completed or Handed over.</p>
            ) : (
              <>
                <p className="text-rebar">Removes the project with its stages, flats and site updates. This is only possible while no flat has been booked.</p>
                <div className="mt-4"><Button variant="danger" onClick={() => { setConfirmName(''); setDeleteOpen(true); }}>Delete project</Button></div>
              </>
            )}
          </Panel>
        )}
      </div>
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={`Delete ${project.name}?`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); remove.mutate(); }} className="flex flex-col gap-4">
          <p className="text-rebar">This cannot be undone. Type the project name to confirm.</p>
          <Input label="Project name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={remove.isPending} disabled={confirmName.trim() !== project.name}>Delete project</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// --------------------------------------------------------------------- page

function ProjectPage({ id }: { id: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const q = useProject(id);
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data!;
  const counts = Object.fromEntries((p.unitCounts ?? []).map((c) => [c.status, c.count]));
  return (
    <div>
      <PageHeader
        back={{ href: '/admin/projects', label: 'Projects' }}
        title={p.name}
        subtitle={`${p.location} · ${p.totalFloors} floors · ${label(p.status)}`}
        action={p.isPublic ? <Link href={`/projects/${p.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-ink)] px-5 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-accent)]">View public page <ExternalLink className="size-4" /></Link> : undefined}
      />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => router.replace(`/admin/projects/${id}?tab=${t}`, { scroll: false })}
        tabs={[
          { id: 'overview', label: 'Construction' },
          { id: 'flats', label: 'Flats and bookings' },
          { id: 'updates', label: <>Site updates{p.pendingUpdates ? <span className="figure ml-1.5 rounded-full bg-[var(--brand-accent)] px-1.5 text-[12px]">{p.pendingUpdates}</span> : null}</> },
          { id: 'handover', label: 'Handover date' },
          { id: 'documents', label: 'Documents' },
          { id: 'risk', label: 'Delay risk' },
          { id: 'settings', label: 'Settings' },
        ]}
      />
      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-[var(--radius-panel)] border border-line bg-slab px-4 py-3"><p className="text-sm text-rebar">Built</p><p className="figure text-2xl font-semibold">{p.overallProgress}%</p></div>
              <div className="rounded-[var(--radius-panel)] border border-line bg-slab px-4 py-3"><p className="text-sm text-rebar">Stages done</p><p className="figure text-2xl font-semibold">{p.completedStages}/{p.stageCount}</p></div>
              <div className="rounded-[var(--radius-panel)] border border-line bg-slab px-4 py-3"><p className="text-sm text-rebar">Flats sold or booked</p><p className="figure text-2xl font-semibold">{(counts.SOLD ?? 0) + (counts.BOOKED ?? 0)}/{Object.values(counts).reduce((a, b) => a + b, 0)}</p></div>
              <div className="rounded-[var(--radius-panel)] border border-line bg-slab px-4 py-3"><p className="text-sm text-rebar">Handover</p><p className="font-semibold">{date(p.expectedHandoverDate)}</p>{p.delayDays > 0 && <p className="text-[13px] text-overdue">{p.delayDays} days late</p>}</div>
            </div>
            <Panel title="Construction stages" flush><StagesTable project={p} /></Panel>
          </div>
          <Panel><Elevation stages={p.milestones} height={420} /></Panel>
        </div>
      )}
      {tab === 'flats' && <Flats project={p} />}
      {tab === 'updates' && <Updates project={p} />}
      {tab === 'handover' && <Handover project={p} />}
      {tab === 'documents' && <Documents project={p} />}
      {tab === 'risk' && <Risk project={p} />}
      {tab === 'settings' && <Settings project={p} />}
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Spinner />}>
      <ProjectPage id={id} />
    </Suspense>
  );
}
