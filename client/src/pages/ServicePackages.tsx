import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PackageCheck, PackageX, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

type ServicePackage = { id: number; code: "basic" | "basic_plus"; version: number; nameEn: string; nameRu: string; nameDe: string; nameEs: string; active: boolean };

function isRussianAdmin() { return typeof window !== "undefined" && window.localStorage.getItem("admin-locale") === "ru"; }

export default function ServicePackages() {
  const { user, loading } = useAuth();
  const russian = isRussianAdmin();
  const copy = russian
    ? { eyebrow: "Только для владельца", title: "Активные пакеты услуг", body: "Отключённые пакеты не принимают новые заказы. Исторические заявки и их неизменяемые снимки стоимости не меняются.", back: "Назад в админ-панель", active: "Активен", inactive: "Неактивен", deactivate: "Отключить", activate: "Включить", confirmTitle: "Подтвердить изменение пакета", confirmBody: "Новые клиенты больше не смогут выбрать отключённый пакет. Как минимум один пакет всегда останется активным.", cancel: "Отмена", confirm: "Подтвердить", restricted: "Этот экран доступен только владельцу.", signIn: "Войти как владелец", loading: "Загрузка пакетов…", packageVersion: "Версия", updated: "Состояние пакета обновлено.", updateFailed: "Не удалось изменить состояние пакета." }
    : { eyebrow: "Owner only", title: "Active service packages", body: "Inactive packages cannot accept new orders. Existing bookings and their immutable price snapshots remain unchanged.", back: "Back to admin", active: "Active", inactive: "Inactive", deactivate: "Deactivate", activate: "Activate", confirmTitle: "Confirm package change", confirmBody: "New customers will no longer be able to select a deactivated package. At least one package always remains active.", cancel: "Cancel", confirm: "Confirm", restricted: "This screen is restricted to the account owner.", signIn: "Sign in as owner", loading: "Loading packages…", packageVersion: "Version", updated: "Package state updated.", updateFailed: "Could not update the package state." };
  const [pending, setPending] = useState<ServicePackage | null>(null);
  const packages = trpc.admin.servicePackages.useQuery(undefined, { enabled: user?.role === "admin", retry: false });
  const utils = trpc.useUtils();
  const update = trpc.admin.updateServicePackageActive.useMutation({
    onSuccess: () => { setPending(null); void utils.admin.servicePackages.invalidate(); void utils.pricing.packages.invalidate(); toast.success(copy.updated); },
    onError: (error) => { setPending(null); toast.error(error.message || copy.updateFailed); },
  });
  const activeCount = (packages.data ?? []).filter((entry) => entry.active).length;

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f8f5f0] text-[#635a52]"><Loader2 className="animate-spin" /></div>;
  if (!user || user.role !== "admin") return <div className="grid min-h-screen place-items-center bg-[#f8f5f0] px-6 text-center text-[#28231f]"><div><h1 className="font-serif text-4xl">{copy.restricted}</h1><button type="button" onClick={() => startLogin()} className="mt-6 rounded-full bg-[#28231f] px-5 py-3 font-semibold text-[#fffaf4]">{copy.signIn}</button></div></div>;

  return <DashboardLayout><main className="min-h-screen bg-[#f8f5f0] px-4 py-6 text-[#28231f] sm:px-8"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#28231f]/10 pb-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b55b39]">{copy.eyebrow}</p><h1 className="mt-2 font-serif text-4xl tracking-[-0.03em]">{copy.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#635a52]">{copy.body}</p></div><Link href="/admin"><Button variant="outline">{copy.back}</Button></Link></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{packages.isLoading ? <div className="col-span-full flex items-center gap-2 text-sm text-[#635a52]"><Loader2 size={16} className="animate-spin" />{copy.loading}</div> : packages.error ? <Card className="col-span-full border-red-200 bg-red-50"><CardContent className="p-5 text-sm text-red-800">{packages.error.message}</CardContent></Card> : packages.data?.map((entry) => { const row = entry as ServicePackage; const localizedName = russian ? row.nameRu : row.nameEn; const disablingLastPackage = row.active && activeCount <= 1; return <Card key={`${row.code}-${row.version}`} className={row.active ? "border-emerald-200 bg-[#fffaf4]" : "border-[#28231f]/10 bg-[#f2eee8] opacity-85"}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-serif text-2xl">{localizedName}</CardTitle><p className="mt-1 text-xs text-[#635a52]">{row.code} · {copy.packageVersion} {row.version}</p></div><Badge className={row.active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>{row.active ? <PackageCheck size={13} className="mr-1" /> : <PackageX size={13} className="mr-1" />}{row.active ? copy.active : copy.inactive}</Badge></div></CardHeader><CardContent><p className="flex items-start gap-2 text-xs leading-5 text-[#635a52]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#b55b39]" />{row.active ? copy.body : copy.inactive}</p><Button type="button" variant={row.active ? "outline" : "default"} className="mt-5 w-full" disabled={update.isPending || disablingLastPackage} onClick={() => setPending(row)}>{row.active ? copy.deactivate : copy.activate}</Button>{disablingLastPackage && <p className="mt-2 text-center text-[11px] text-[#8d6d1f]">{copy.confirmBody}</p>}</CardContent></Card>; })}</div></div></main><AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) setPending(null); }}><AlertDialogContent className="bg-[#fffaf4]"><AlertDialogHeader><AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle><AlertDialogDescription>{copy.confirmBody}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => pending && update.mutate({ code: pending.code, version: pending.version, active: !pending.active })}>{copy.confirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></DashboardLayout>;
}
