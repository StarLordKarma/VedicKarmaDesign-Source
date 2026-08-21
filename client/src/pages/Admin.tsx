import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Save, Sparkles } from "lucide-react";

const paymentTone: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-900",
  creating: "bg-slate-100 text-slate-700",
  finished: "bg-emerald-100 text-emerald-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  partially_paid: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
};

const requestStatuses = ["new", "in_progress", "completed", "cancelled"] as const;
type RequestStatus = (typeof requestStatuses)[number];

type Draft = { status: RequestStatus; adminNote: string };

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [requestFilter, setRequestFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.admin.bookingList.useQuery(undefined, { retry: false, enabled: user?.role === "admin" });
  const updateBooking = trpc.admin.updateBooking.useMutation({
    onSuccess: () => utils.admin.bookingList.invalidate(),
  });

  useEffect(() => {
    if (!data) return;
    setDrafts((current) => {
      const next = { ...current };
      data.forEach((row) => {
        if (!next[row.id]) next[row.id] = { status: row.status, adminNote: row.adminNote ?? "" };
      });
      return next;
    });
  }, [data]);

  const rows = useMemo(() => (data ?? []).filter((row) => (paymentFilter === "all" || row.paymentStatus === paymentFilter) && (requestFilter === "all" || row.status === requestFilter)), [data, paymentFilter, requestFilter]);
  const confirmed = (data ?? []).filter((row) => ["finished", "confirmed", "partially_paid"].includes(row.paymentStatus ?? "")).length;

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-[#f8f5f0] text-[#635a52]">Loading secure workspace…</div>;
  if (!user || user.role !== "admin") return <div className="grid min-h-screen place-items-center bg-[#f8f5f0] px-6 text-center text-[#28231f]"><div><h1 className="font-serif text-4xl">Admin access required</h1><p className="mt-3 text-[#635a52]">This workspace is restricted to the account owner.</p><a href="/" className="mt-6 inline-block font-semibold text-[#b55b39] hover:underline">Return to website</a></div></div>;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#f8f5f0] px-4 py-8 text-[#28231f] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 border-b border-[#28231f]/10 pb-7 sm:flex-row sm:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">Jyotish · private workspace</p><h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Booking overview</h1><p className="mt-3 text-[#635a52]">Review birth details, payment status, and private client notes in one place.</p></div>
            <a href="/" className="text-sm font-semibold text-[#b55b39] hover:underline">← Back to website</a>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="border-[#28231f]/10 bg-[#fffaf4]"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#8d7b6b]">All requests</p><p className="mt-2 font-serif text-4xl">{data?.length ?? 0}</p></CardContent></Card>
            <Card className="border-[#28231f]/10 bg-[#fffaf4]"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#8d7b6b]">Payment confirmed</p><p className="mt-2 font-serif text-4xl">{confirmed}</p></CardContent></Card>
            <Card className="border-[#28231f]/10 bg-[#28231f] text-[#fffaf4]"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#d9a441]">Current provider</p><p className="mt-2 font-serif text-2xl">NOWPayments</p></CardContent></Card>
          </div>
          <Card className="mt-8 border-[#28231f]/10 bg-[#fffaf4] shadow-sm"><CardHeader className="flex flex-col gap-4 border-b border-[#28231f]/10 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="font-serif text-2xl">Client requests</CardTitle><p className="mt-1 text-sm text-[#635a52]">Birth data and private notes are visible only inside this protected admin area.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Request status filter" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} className="rounded-full border border-[#28231f]/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-[#b55b39]"><option value="all">All request statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><select aria-label="Payment status filter" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="rounded-full border border-[#28231f]/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-[#b55b39]"><option value="all">All payment statuses</option><option value="waiting">Waiting</option><option value="finished">Finished</option><option value="confirmed">Confirmed</option><option value="failed">Failed</option></select></div></CardHeader><CardContent className="p-0">
            {isLoading && <div className="flex items-center gap-3 p-8 text-[#635a52]"><Loader2 className="animate-spin" size={18} /> Loading requests…</div>}
            {error && <div className="flex items-center gap-3 p-8 text-red-700"><AlertCircle size={18} /> {error.message}</div>}
            {!isLoading && !error && rows.length === 0 && <div className="p-8 text-[#635a52]">No requests match this filter.</div>}
            {!isLoading && !error && rows.length > 0 && <div className="divide-y divide-[#28231f]/10">{rows.map((row) => { const draft = drafts[row.id] ?? { status: row.status, adminNote: row.adminNote ?? "" }; return <div key={row.id} className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.75fr_0.7fr_1.25fr] lg:items-start"><div><div className="flex items-center gap-2"><span className="font-semibold">{row.name}</span><span className="text-xs text-[#8d7b6b]">#{row.id}</span></div><p className="mt-1 text-sm text-[#635a52]">{row.email}</p><p className="mt-2 text-xs text-[#8d7b6b]">Born {row.birthDate}, {row.birthTime} · {row.birthCity}, {row.birthCountry}</p></div><div><p className="text-sm font-semibold">${row.totalUsd} · {row.language}</p><p className="mt-1 text-xs text-[#8d7b6b]">{row.addon ? "Numerology add-on" : "Basic reading"}</p></div><div><Badge className={`border-0 ${paymentTone[row.paymentStatus ?? "waiting"] ?? "bg-slate-100 text-slate-700"}`}>{row.paymentStatus ?? "waiting"}</Badge><p className="mt-2 flex items-center gap-1 text-xs text-[#8d7b6b]"><Clock3 size={12} /> {formatDate(row.createdAt)}</p>{["finished", "confirmed"].includes(row.paymentStatus ?? "") ? <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Paid</span> : <span className="mt-2 inline-flex items-center gap-1 text-xs text-[#8d7b6b]"><Sparkles size={14} /> Awaiting payment</span>}</div><div className="rounded-2xl border border-[#28231f]/10 bg-[#f8f5f0] p-4"><div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]"><label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8d7b6b]">Request status<select value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, status: event.target.value as RequestStatus } }))} className="mt-2 w-full rounded-xl border border-[#28231f]/15 bg-[#fffaf4] px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#b55b39]"><option value="new">New</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8d7b6b]">Private note<textarea value={draft.adminNote} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, adminNote: event.target.value } }))} rows={3} maxLength={5000} placeholder="Add a note for your workflow…" className="mt-2 w-full resize-y rounded-xl border border-[#28231f]/15 bg-[#fffaf4] px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#b55b39]" /></label></div><button type="button" disabled={updateBooking.isPending} onClick={() => updateBooking.mutate({ id: row.id, status: draft.status, adminNote: draft.adminNote || null })} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#28231f] px-4 py-2 text-xs font-semibold text-[#fffaf4] disabled:opacity-60"><Save size={14} /> {updateBooking.isPending ? "Saving…" : "Save changes"}</button>{updateBooking.isSuccess && <span className="ml-3 text-xs font-semibold text-emerald-700">Saved</span>}</div></div>; })}</div>}
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
