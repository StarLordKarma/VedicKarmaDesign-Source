import React from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, CheckCircle2, Clock3, MailCheck } from "lucide-react";

const copy = {
  en: { eyebrow: "PRIVATE STATUS", title: "Your reading status", loading: "Checking your secure link…", expired: "This status link has expired.", revoked: "This status link has been revoked.", notFound: "This status link is not valid.", unavailable: "The status service is temporarily unavailable.", paid: "Payment", preparation: "Preparation", delivery: "Delivery", paidValue: "Paid", pending: "Pending", preparing: "In preparation", ready: "Ready for review", sent: "Sent", failed: "Needs attention", waiting_payment: "Waiting for payment", cancelled: "Cancelled", reference: "Reference", expires: "Link expires" },
  ru: { eyebrow: "ЧАСТНЫЙ СТАТУС", title: "Статус вашего заказа", loading: "Проверяем защищённую ссылку…", expired: "Срок действия ссылки истёк.", revoked: "Эта ссылка была отозвана.", notFound: "Ссылка статуса недействительна.", unavailable: "Сервис статуса временно недоступен.", paid: "Оплата", preparation: "Подготовка", delivery: "Доставка", paidValue: "Оплачено", pending: "Ожидает", preparing: "В подготовке", ready: "Готово к проверке", sent: "Отправлено", failed: "Требует внимания", waiting_payment: "Ожидает оплаты", cancelled: "Отменено", reference: "Номер", expires: "Ссылка действует до" },
  de: { eyebrow: "PRIVATER STATUS", title: "Status Ihrer Bestellung", loading: "Sicheren Link wird geprüft…", expired: "Dieser Status-Link ist abgelaufen.", revoked: "Dieser Status-Link wurde widerrufen.", notFound: "Dieser Status-Link ist ungültig.", unavailable: "Der Statusdienst ist vorübergehend nicht verfügbar.", paid: "Zahlung", preparation: "Vorbereitung", delivery: "Versand", paidValue: "Bezahlt", pending: "Ausstehend", preparing: "In Vorbereitung", ready: "Zur Prüfung bereit", sent: "Gesendet", failed: "Aufmerksamkeit erforderlich", waiting_payment: "Zahlung ausstehend", cancelled: "Storniert", reference: "Referenz", expires: "Link gültig bis" },
  es: { eyebrow: "ESTADO PRIVADO", title: "Estado de su pedido", loading: "Comprobando el enlace seguro…", expired: "Este enlace de estado ha caducado.", revoked: "Este enlace de estado ha sido revocado.", notFound: "Este enlace de estado no es válido.", unavailable: "El servicio de estado no está disponible temporalmente.", paid: "Pago", preparation: "Preparación", delivery: "Entrega", paidValue: "Pagado", pending: "Pendiente", preparing: "En preparación", ready: "Listo para revisar", sent: "Enviado", failed: "Requiere atención", waiting_payment: "Esperando pago", cancelled: "Cancelado", reference: "Referencia", expires: "Enlace válido hasta" },
} as const;

type Copy = { [K in keyof typeof copy.en]: string };
function language() { const saved = localStorage.getItem("site-language")?.toLowerCase(); return saved === "ru" || saved === "de" || saved === "es" ? saved : "en"; }
function statusText(value: string, t: Copy) { return t[value as keyof Copy] ?? value; }

export default function ClientStatus() {
  const [, params] = useRoute("/status/:token");
  const token = params?.token ?? "";
  const t = copy[language()];
  const query = trpc.status.get.useQuery({ token }, { enabled: token.length >= 32, retry: false, staleTime: 30_000 });
  if (query.isLoading) return <main className="min-h-screen bg-[#f8f5f0] grid place-items-center p-6"><Card className="w-full max-w-lg"><CardContent className="flex items-center justify-center gap-3 p-10 text-[#635a52]"><Loader2 className="animate-spin" size={20} />{t.loading}</CardContent></Card></main>;
  const data = query.data;
  if (query.isError || !data || data.kind === "unavailable") return <StatusMessage title={t.unavailable} detail={t.unavailable} />;
  if (data.kind !== "active") return <StatusMessage title={data.kind === "expired" ? t.expired : data.kind === "revoked" ? t.revoked : t.notFound} detail={data.kind === "expired" ? t.expired : data.kind === "revoked" ? t.revoked : t.notFound} />;
  const rows = [{ label: t.paid, value: data.paymentState === "paid" ? t.paidValue : t.pending, icon: CheckCircle2 }, { label: t.preparation, value: statusText(data.preparationState, t), icon: Clock3 }, { label: t.delivery, value: statusText(data.deliveryState, t), icon: MailCheck }];
  return <main className="min-h-screen bg-[#f8f5f0] p-6 md:p-12"><div className="mx-auto max-w-3xl"><p className="text-xs tracking-[0.25em] text-[#aa6245]">{t.eyebrow}</p><h1 className="mt-3 font-serif text-4xl text-[#2f2923] md:text-6xl">{t.title}</h1><div className="mt-8 grid gap-4 md:grid-cols-3">{rows.map(row => <Card key={row.label}><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-sm text-[#635a52]">{row.label}</CardTitle><row.icon size={18} className="text-[#aa6245]" /></CardHeader><CardContent><p className="text-xl font-medium text-[#2f2923]">{row.value}</p></CardContent></Card>)}</div><Card className="mt-6"><CardContent className="grid gap-3 p-6 text-sm text-[#635a52] md:grid-cols-2"><span>{t.reference}: <strong className="text-[#2f2923]">{data.reference}</strong></span><span>{t.expires}: {new Date(data.expiresAt).toLocaleString()}</span></CardContent></Card></div></main>;
}
function StatusMessage({ title, detail }: { title: string; detail: string }) { return <main className="min-h-screen bg-[#f8f5f0] grid place-items-center p-6"><Card className="w-full max-w-lg border-[#dfc9bb]"><CardHeader><ShieldAlert className="text-[#aa6245]" /><CardTitle className="font-serif text-3xl text-[#2f2923]">{title}</CardTitle></CardHeader><CardContent className="text-[#635a52]">{detail}</CardContent></Card></main>; }
