import React, { useState } from "react";
export default function OwnerLogin() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function login() {
    setBusy(true); setError("");
    try {
      const provider = (window as any).ethereum; if (!provider) throw new Error("Откройте страницу в браузере с MetaMask.");
      const r = await fetch("/api/auth/wallet/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) throw new Error("Вход владельца ещё не включён.");
      const challenge = await r.json(), accounts = await provider.request({ method: "eth_requestAccounts" });
      if (accounts[0]?.toLowerCase() !== challenge.address?.toLowerCase()) throw new Error("Подключите исходный кошелёк владельца, указанный для приёма оплаты.");
      const bytes = new TextEncoder().encode(challenge.message), hex = "0x" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      const signature = await provider.request({ method: "personal_sign", params: [hex, accounts[0]] });
      const verified = await fetch("/api/auth/wallet/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature }) });
      if (!verified.ok) throw new Error("Подпись не подтверждена. Начните вход заново.");
      window.location.assign("/admin/refunds");
    } catch (e: any) { setError(e.code === 4001 ? "Подпись отменена. Деньги не переводились." : e.message); } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f8f5f0] p-5 text-[#302a25]"><section className="max-w-lg space-y-5 rounded-2xl border border-[#cbb9a6] bg-[#fffaf4] p-8"><h1 className="font-serif text-3xl">Кабинет владельца</h1><p>Вход подписью исходного кошелька MetaMask. Сообщение явно указывает доступ владельца на 8 часов и домен сайта. Подпись входа не переводит токены и не разрешает списание.</p><button disabled={busy} onClick={() => void login()} className="rounded-full bg-[#302a25] px-6 py-3 text-white disabled:opacity-50">{busy ? "Проверяем подпись…" : "Войти с MetaMask"}</button>{error && <p role="alert">{error}</p>}<a className="block text-sm underline" href="/">На главную</a></section></main>;
}
