import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const paymentTone: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-900",
  creating: "bg-slate-100 text-slate-700",
  finished: "bg-emerald-100 text-emerald-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  partially_paid: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
};

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [requestFilter, setRequestFilter] = useState("all");
  const { data, isLoading, error } = trpc.admin.bookingList.useQuery(undefined, { retry: false, enabled: user?.role === "admin" });
  const rows = useMemo(() => (data ?? []).filter((row) => (paymentFilter === "all" || row.paymentStatus === paymentFilter) && (requestFilter === "all" || row.status === requestFilter)), [data, paymentFilter, requestFilter]);
  const confirmed = (data ?? []).filter((row) => ["finished", "confirmed", "partially_paid"].includes(row.paymentStatus ?? "")).length;

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-[#f8f5f0] text-[#635a52]">Loading secure workspace…</div>;
  if (!user || user.role !== "admin") return <div className="grid min-h-screen place-items-center bg-[#f8f5f0] px-6 text-center text-[#28231f]"><div><h1 className="font-serif text-4xl">Admin access required</h1><p className="mt-3 text-[#635a52]">This workspace is restricted to the account owner.</p><a href="/" className="mt-6 inline-block font-semibold text-[#b55b39] hover:underline">Return to website</a></div></div>;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#f8f5f0] px-4 py-8 text-[#28231f] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 border-b border-[#28231f]/10 pb-7 sm:flex-row sm:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">Jyotish · private workspace</p><h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Booking overview</h1><p className="mt-3 text-[#635a52]">Review birth details, checkout progress, and payment status in one place.</p></div>
            <a href="/" className="text-sm font-semibold text-[#b55b39] hover:underline">← Back to website</a>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="border-[#28231f]/10 bg-[#fffaf4]"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#8d7b6b]">All requests</p><p className="mt-2 font-serif text-4xl">{data?.length ?? 0}</p></CardContent></Card>
            <Card className="border-[#28231f]/10 bg-[#fffaf4]"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#8d7b6b]">Payment confirmed</p><p className="mt-2 font-serif text-4xl">{confirmed}</p></CardContent></Card>
            <Card className="border-[#28231f]/10 bg-[#28231f] text-[#fffaf4]"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#d9a441]">Current provider</p><p className="mt-2 font-serif text-2xl">NOWPayments</p></CardContent></Card>
          </div>
          <Card className="mt-8 border-[#28231f]/10 bg-[#fffaf4] shadow-sm"><CardHeader className="flex flex-col gap-4 border-b border-[#28231f]/10 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="font-serif text-2xl">Client requests</CardTitle><p className="mt-1 text-sm text-[#635a52]">Personal birth data is visible only inside this protected admin area.</p></div><div className="flex flex-wrap gap-2"><select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} className="rounded-full border border-[#28231f]/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-[#b55b39]"><option value="all">All request statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="rounded-full border border-[#28231f]/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-[#b55b39]"><option value="all">All payment statuses</option><option value="waiting">Waiting</option><option value="finished">Finished</option><option value="confirmed">Confirmed</option><option value="failed">Failed</option></select></div></CardHeader><CardContent className="p-0">
            {isLoading && <div className="flex items-center gap-3 p-8 text-[#635a52]"><Loader2 className="animate-spin" size={18} /> Loading requests…</div>}
            {error && <div className="flex items-center gap-3 p-8 text-red-700"><AlertCircle size={18} /> {error.message}</div>}
            {!isLoading && !error && rows.length === 0 && <div className="p-8 text-[#635a52]">No requests match this filter.</div>}
            {!isLoading && !error && rows.length > 0 && <div className="divide-y divide-[#28231f]/10">{rows.map((row) => <div key={row.id} className="grid gap-4 p-5 md:grid-cols-[1.25fr_1fr_0.9fr_0.8fr] md:items-center"><div><div className="flex items-center gap-2"><span className="font-semibold">{row.name}</span><span className="text-xs text-[#8d7b6b]">#{row.id}</span></div><p className="mt-1 text-sm text-[#635a52]">{row.email}</p><p className="mt-2 text-xs text-[#8d7b6b]">Born {row.birthDate}, {row.birthTime} · {row.birthCity}, {row.birthCountry}</p></div><div><p className="text-sm font-semibold">${row.totalUsd} · {row.language}</p><p className="mt-1 text-xs text-[#8d7b6b]">{row.addon ? "Numerology add-on" : "Basic reading"}</p></div><div><Badge className={`border-0 ${paymentTone[row.paymentStatus ?? "waiting"] ?? "bg-slate-100 text-slate-700"}`}>{row.paymentStatus ?? "waiting"}</Badge><p className="mt-2 flex items-center gap-1 text-xs text-[#8d7b6b]"><Clock3 size={12} /> {formatDate(row.createdAt)}</p></div><div className="md:text-right">{["finished", "confirmed"].includes(row.paymentStatus ?? "") ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Paid</span> : <span className="inline-flex items-center gap-1 text-sm text-[#8d7b6b]"><Sparkles size={16} /> Awaiting payment</span>}</div></div>)}</div>}
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
