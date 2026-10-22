import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { PAYMENT_NETWORKS, isPaymentNetwork } from "@shared/payment-networks";
import { toast } from "sonner";

export default function Refunds() {
  const query = trpc.refunds.list.useQuery(undefined, { refetchInterval: 15000 });
  const readiness = trpc.reportStudio.readiness.useQuery();
  const [bookingId, setBookingId] = useState(""), [reason, setReason] = useState("");
  const [fees, setFees] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false), [note, setNote] = useState<Record<number, string>>({}), [hashes, setHashes] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();
  const approve = trpc.refunds.approve.useMutation(), decline = trpc.refunds.decline.useMutation(), prepare = trpc.refunds.prepare.useMutation(), record = trpc.refunds.record.useMutation(), check = trpc.refunds.check.useMutation(), broadcast = trpc.refunds.broadcast.useMutation(), create = trpc.refunds.create.useMutation(), renew = trpc.refunds.renewTron.useMutation();
  const refresh = () => utils.refunds.list.invalidate();
  async function action(work: () => Promise<unknown>) { setBusy(true); try { await work(); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Операция не завершена. Проверьте статус перед повторением."); } finally { setBusy(false); } }
  const readSaved = (id: number) => { try { return JSON.parse(localStorage.getItem(`merchant-refund:${id}`) || "null"); } catch { return null; } };
  async function recover(id: number) { const saved = readSaved(id); const hash = hashes[id]?.trim() || saved?.hash; if (!hash) throw new Error("Укажите hash уже отправленного перевода"); await record.mutateAsync({ id, hash }); if (saved?.transaction && saved.hash === hash) await broadcast.mutateAsync({ id, transaction: saved.transaction }); await check.mutateAsync({ id }); }
  async function send(item: NonNullable<typeof query.data>["items"][number]) {
    if (readSaved(item.id)?.hash) return recover(item.id);
    let provider: any, address: string;
    if (item.network === "tron") {
      address = (await (await import("@/lib/tron-wallet")).connectTronWallet()).address;
      if (address !== item.merchant) throw new Error("Подключите исходный кошелёк продавца в TRON");
    } else {
      if (!isPaymentNetwork(item.network)) throw new Error("Неизвестная сеть возврата");
      provider = (window as any).ethereum;
      if (!provider) throw new Error("Откройте страницу в браузере с MetaMask");
      const accounts = await provider.request({ method: "eth_requestAccounts" }); address = accounts[0];
      if (address?.toLowerCase() !== item.merchant?.toLowerCase()) throw new Error("Выбран другой кошелёк. Используйте адрес продавца из карточки возврата");
      const network = PAYMENT_NETWORKS[item.network];
      try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: network.chainId }] }); }
      catch (error: any) { if (error.code !== 4902) throw error; await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: network.chainId, chainName: network.name, nativeCurrency: { name: network.nativeSymbol, symbol: network.nativeSymbol, decimals: 18 }, rpcUrls: [network.walletRpc], blockExplorerUrls: [network.explorer] }] }); await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: network.chainId }] }); }
    }
    const prepared = await prepare.mutateAsync({ id: item.id });
    if (item.network === "tron") {
      const transaction = await (await import("@/lib/tron-wallet")).signTronPayment(prepared.transaction, address);
      try { localStorage.setItem(`merchant-refund:${item.id}`, JSON.stringify({ hash: transaction.txID, transaction })); } catch { /* Server tracking still runs when browser storage is unavailable. */ }
      await record.mutateAsync({ id: item.id, hash: transaction.txID });
      await broadcast.mutateAsync({ id: item.id, transaction });
    } else {
      if ((await provider.request({ method: "eth_chainId" }))?.toLowerCase() !== prepared.chainId || (await provider.request({ method: "eth_accounts" }))[0]?.toLowerCase() !== address.toLowerCase()) throw new Error("Сеть или аккаунт изменились; отправка остановлена");
      const hash = await provider.request({ method: "eth_sendTransaction", params: [prepared.transaction] });
      try { localStorage.setItem(`merchant-refund:${item.id}`, JSON.stringify({ hash })); } catch { /* Always record the wallet hash on the server. */ }
      await record.mutateAsync({ id: item.id, hash });
    }
    await check.mutateAsync({ id: item.id });
    toast.success("Перевод отслеживается. Не отправляйте средства повторно.");
  }
  const states: Record<string, string> = { requested: "Новый запрос", approved: "Одобрено", signing: "Подготовлена подпись", submitted: "Проверяем перевод", confirmed: "Возвращено", declined: "Отклонено" };
  const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-40";
  return <DashboardLayout><main className="mx-auto max-w-5xl space-y-6 p-5 text-foreground">
    <h1 className="text-3xl font-semibold">Возвраты</h1><p>Возврат исходных токенов за вычетом заранее указанной комиссии перевода, на исходный адрес. Gas списывается сетью с вашего кошелька; удержание комиссии уменьшает сумму токенов клиенту. Деньги переводятся только после вашего подтверждения в MetaMask.</p>
    {readiness.data && <div className="rounded-lg border p-4 text-sm"><p>Email: {readiness.data.emailConfigured ? "настроен" : "требует настройки"} · PDF: {readiness.data.storageConfigured ? "настроен" : "требует настройки"} · Генератор: {readiness.data.aiConfigured ? "настроен" : "требует настройки"}</p><p>Уведомления владельцу: {readiness.data.ownerAlertsConfigured ? "настроены" : "укажите OWNER_ALERT_EMAIL или войдите с подтверждённым email владельца"}</p></div>}
    {query.isError && <p role="alert">Не удалось загрузить журнал возвратов.</p>}
    {query.data && !query.data.enabled && <p role="alert">Механизм возвратов ещё не включён. Требуются миграция базы и REFUNDS_ENABLED=true.</p>}
    <form className="flex flex-wrap gap-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void action(() => create.mutateAsync({ bookingId: Number(bookingId), reason })); }}>
      <label>Заказ № <input type="number" min={1} required value={bookingId} onChange={e => setBookingId(e.target.value)} className="w-24 rounded border p-2" /></label><input aria-label="Причина возврата" required minLength={10} maxLength={1000} placeholder="Причина / описание проблемы" value={reason} onChange={e => setReason(e.target.value)} className="min-w-52 flex-1 rounded border p-2" /><button disabled={busy || !query.data?.enabled} className={button}>Создать запрос</button>
    </form>
    {query.data?.items.map(item => <article key={item.id} className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Заказ #{item.bookingId} · {states[item.status] || item.status}</h2><p>{item.reason}</p>
      {item.amount && <dl className="grid gap-2 text-sm"><dt>Сумма / сеть</dt><dd>{item.amount} · {item.network}</dd><dt>Кошелёк продавца</dt><dd className="break-all">{item.merchant}</dd><dt>Получатель (исходный плательщик)</dt><dd className="break-all">{item.recipient}</dd></dl>}
      {item.transactionHash && <p className="break-all text-sm">Tx: {item.transactionHash}</p>}{item.lastCheckError && <p role="alert" className="text-sm text-amber-700">{item.lastCheckError} · Повторно не платите. Проверьте этот перевод.</p>}
      {item.status === "requested" && <div className="flex flex-wrap gap-3"><label className="text-sm">Комиссия возврата в токене платежа <input aria-label={`Комиссия возврата ${item.id}`} className="w-28 rounded border p-2" inputMode="decimal" placeholder="0" value={fees[item.id] || ""} onChange={e => setFees({ ...fees, [item.id]: e.target.value })} /></label><button className={button} disabled={busy} onClick={() => void action(() => approve.mutateAsync({ id: item.id, transferFee: fees[item.id] || "0" }))}>Проверить и одобрить сумму за вычетом комиссии</button><input className="flex-1 rounded border p-2" aria-label={`Объяснение решения ${item.id}`} placeholder="Объяснение для клиента" value={note[item.id] || ""} onChange={e => setNote({ ...note, [item.id]: e.target.value })} /><button className={button} disabled={busy || (note[item.id]?.trim().length || 0) < 10} onClick={() => void action(() => decline.mutateAsync({ id: item.id, note: note[item.id] }))}>Отклонить с объяснением</button></div>}
      {["approved", "signing"].includes(item.status) && <button className={button} disabled={busy} onClick={() => void action(() => send(item))}>{item.status === "signing" ? "Продолжить тот же перевод в MetaMask" : "Отправить возврат через MetaMask"}</button>}
      {["signing", "submitted"].includes(item.status) && <div className="space-y-3"><p className="text-sm">Если hash уже получен, проверяйте его. При повторном открытии используется тот же nonce / txID. Не создавайте перевод вручную в другом окне.</p><input className="w-full rounded border p-2" aria-label={`Hash возврата ${item.id}`} placeholder="Hash существующего перевода (если ответ браузера потерян)" value={hashes[item.id] || ""} onChange={e => setHashes({ ...hashes, [item.id]: e.target.value })} /><button className={button} disabled={busy} onClick={() => void action(() => recover(item.id))}>Сохранить / проверить существующий перевод</button>{item.network === "tron" && <button className={`${button} ml-3`} disabled={busy} onClick={() => void action(async () => { await renew.mutateAsync({ id: item.id }); localStorage.removeItem(`merchant-refund:${item.id}`); })}>Проверить и обновить истёкший TRON-перевод</button>}</div>}
      {item.status === "submitted" && <button className={button} disabled={busy} onClick={() => void action(() => check.mutateAsync({ id: item.id }))}>Проверить подтверждения сети</button>}
      {item.decisionNote && <p>{item.decisionNote}</p>}
    </article>)}
  </main></DashboardLayout>;
}
