import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  Wallet,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { walletPaymentCopy } from "@/lib/wallet-payment-copy";
import {
  PAYMENT_NETWORKS,
  isPaymentNetwork,
  recommendPaymentNetwork,
  type CheckoutNetworkId,
  type NetworkEstimate,
} from "@shared/payment-networks";
import { TRON_PAYMENT } from "@shared/tron-payment";

type Network = {
  id: CheckoutNetworkId;
  chainId: string;
  name: string;
  nativeSymbol: string;
  tokenSymbol: string;
  token: string;
  data: string;
  recipient: string;
  explorer: string;
  protocol: string;
  walletRpc?: string;
};
type Quote = {
  binding?: { network: CheckoutNetworkId; payer: string } | null;
  statusUrl?: string | null;
  amount: string;
  recipient: string;
  deadline: number;
  paid: boolean;
  manualReview?: boolean;
  refundState?: "refund_pending" | "refunded" | null;
  language: string;
  networks: Network[];
};
type Provider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<any>;
  isMetaMask?: boolean;
  on?: (name: string, listener: (...args: any[]) => void) => void;
  removeListener?: (name: string, listener: (...args: any[]) => void) => void;
};
type SavedPayment = { network: CheckoutNetworkId; hash: string };
const extra = {
  ru: {
    choose: "Выберите сеть оплаты",
    connect: "Подключить кошелёк и сравнить комиссии",
    refresh: "Обновить комиссии",
    fee: "Оценка комиссии сети",
    balance: "Доступно",
    recommend: "Наименьшая оценённая комиссия",
    insufficient_usdt: "Не хватает токенов для оплаты",
    insufficient_gas: "Не хватает монет для комиссии",
    unavailable: "Не удалось получить оценку",
    before: "Подключите кошелёк для проверки баланса и комиссии.",
    note: "Цена прогноза не включает комиссию сети. Она оплачивается отдельно. Оценка меняется; итоговую комиссию покажет кошелёк. Переводить токены между сетями для этой оплаты не требуется.",
    budget: "Запас на комиссию",
    caution:
      "Комиссия заметна относительно цены заказа. Проверьте другие сети, где у вас уже есть средства.",
    tokenNote:
      "Polygon: USDT0. BNB Chain: Binance-Peg USDT (BSC-USD). Это другие версии токена; выберите ту сеть, где находятся ваши средства.",
    ready: "Баланс проверен",
    stale: "Оценка устарела — обновите перед оплатой.",
    switched: "Кошелёк изменился. Подключите его снова и обновите оценку.",
    high: "Проверить другие сети",
    manual: "Платёж передан владельцу на проверку. Повторно платить не нужно.",
    noPrices:
      "Долларовый эквивалент недоступен; сравнение стоимости не выполнено.",
    checkOnly:
      "Проверяем уже отправленный перевод. Смена сети и повторная оплата отключены.",
    tronNote:
      "TRON: комиссия зависит от Energy и Bandwidth. Показана консервативная оценка с учётом доступной Energy; окончательные расходы определяет сеть.",
    wallet: "Кошелёк",
    total: "Цена прогноза",
  },
  en: {
    choose: "Choose payment network",
    connect: "Connect wallet and compare fees",
    refresh: "Refresh fees",
    fee: "Estimated network fee",
    balance: "Available",
    recommend: "Lowest estimated fee",
    insufficient_usdt: "Insufficient payment tokens",
    insufficient_gas: "Insufficient funds for network fees",
    unavailable: "Estimate unavailable",
    before: "Connect your wallet to check balances and fees.",
    note: "The forecast price excludes the network fee, paid separately. Estimates change; your wallet shows the final fee. No bridging is required for this checkout.",
    budget: "Fee balance buffer",
    caution:
      "The fee is significant compared with the order price. Consider other networks where you already hold funds.",
    tokenNote:
      "Polygon uses USDT0. BNB Chain uses Binance-Peg USDT (BSC-USD). Select the network where you already hold the correct token.",
    ready: "Balance checked",
    stale: "Estimate expired. Refresh before paying.",
    switched: "Wallet changed. Reconnect and refresh the estimate.",
    high: "Compare other networks",
    manual: "Your payment needs owner review. Do not pay again.",
    noPrices: "USD conversion is unavailable; costs have not been ranked.",
    checkOnly:
      "Checking a transfer already sent. Network changes and repeat payment are disabled.",
    tronNote:
      "TRON fees depend on Energy and Bandwidth. This conservative estimate accounts for available Energy; the network determines actual costs.",
    wallet: "Wallet",
    total: "Forecast price",
  },
  de: {
    choose: "Zahlungsnetzwerk wählen",
    connect: "Wallet verbinden und Gebühren vergleichen",
    refresh: "Gebühren aktualisieren",
    fee: "Geschätzte Netzwerkgebühr",
    balance: "Verfügbar",
    recommend: "Niedrigste geschätzte Gebühr",
    insufficient_usdt: "Nicht genügend Zahlungstoken",
    insufficient_gas: "Nicht genügend Mittel für Gebühren",
    unavailable: "Schätzung nicht verfügbar",
    before: "Wallet verbinden, um Guthaben und Gebühren zu prüfen.",
    note: "Die Netzwerkgebühr wird zusätzlich berechnet. Schätzungen ändern sich; das Wallet zeigt die endgültige Gebühr. Für diesen Checkout ist keine Bridge erforderlich.",
    budget: "Gebührenreserve",
    caution:
      "Die Gebühr ist im Verhältnis zum Auftrag hoch. Prüfen Sie Netzwerke, in denen Sie bereits Guthaben haben.",
    tokenNote:
      "Polygon: USDT0. BNB Chain: Binance-Peg USDT (BSC-USD). Wählen Sie das Netzwerk mit dem passenden Token.",
    ready: "Guthaben geprüft",
    stale: "Schätzung abgelaufen. Vor der Zahlung aktualisieren.",
    switched: "Wallet geändert. Bitte neu verbinden und aktualisieren.",
    high: "Andere Netzwerke vergleichen",
    manual: "Die Zahlung muss geprüft werden. Nicht erneut bezahlen.",
    noPrices: "USD-Umrechnung nicht verfügbar; kein Kostenvergleich möglich.",
    checkOnly:
      "Überweisung gesendet. Netzwerkwechsel und erneute Zahlung sind gesperrt.",
    tronNote:
      "TRON-Gebühren hängen von Energy und Bandwidth ab. Die vorsichtige Schätzung berücksichtigt verfügbare Energy; das Netzwerk bestimmt die tatsächlichen Kosten.",
    wallet: "Wallet",
    total: "Preis der Prognose",
  },
  es: {
    choose: "Elige la red de pago",
    connect: "Conectar wallet y comparar comisiones",
    refresh: "Actualizar comisiones",
    fee: "Comisión de red estimada",
    balance: "Disponible",
    recommend: "Menor comisión estimada",
    insufficient_usdt: "Tokens insuficientes para pagar",
    insufficient_gas: "Saldo insuficiente para comisiones",
    unavailable: "Estimación no disponible",
    before: "Conecta tu wallet para comprobar saldos y comisiones.",
    note: "La comisión de red se paga aparte del pronóstico. La estimación cambia; tu wallet mostrará la comisión final. Este pago no requiere usar un puente.",
    budget: "Reserva para comisión",
    caution:
      "La comisión es alta respecto al pedido. Compara redes donde ya tengas saldo.",
    tokenNote:
      "Polygon: USDT0. BNB Chain: Binance-Peg USDT (BSC-USD). Elige la red donde tienes el token correcto.",
    ready: "Saldo comprobado",
    stale: "La estimación caducó. Actualízala antes de pagar.",
    switched: "La wallet cambió. Reconecta y actualiza la estimación.",
    high: "Comparar otras redes",
    manual: "El pago requiere revisión. No vuelvas a pagar.",
    noPrices: "Conversión a USD no disponible; no se compararon los costes.",
    checkOnly:
      "Transferencia enviada. Se deshabilitan el cambio de red y el pago repetido.",
    tronNote:
      "Las comisiones de TRON dependen de Energy y Bandwidth. La estimación conservadora considera la Energy disponible; la red determina el coste real.",
    wallet: "Wallet",
    total: "Precio del pronóstico",
  },
};
function loadSaved(token: string): SavedPayment | undefined {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`wallet-payment:${token}`) || "null"
    );
    if (
      saved &&
      (isPaymentNetwork(saved.network) || saved.network === "tron") &&
      (saved.network === "tron" ? /^[a-f0-9]{64}$/i : /^0x[a-f0-9]{64}$/i).test(
        saved.hash
      )
    )
      return saved;
    const old = localStorage.getItem(`wallet-tx:${token}`);
    if (old && /^0x[a-f0-9]{64}$/i.test(old))
      return { network: "avalanche", hash: old };
  } catch {
    /* Server recovery does not depend on browser storage. */
  }
}
export default function WalletPayment() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token || "",
    endpoint = `/api/direct-payment/${encodeURIComponent(token)}`;
  const [quote, setQuote] = useState<Quote>();
  const [saved, setSaved] = useState<SavedPayment | undefined>(() =>
    loadSaved(token)
  );
  const [selected, setSelected] = useState<CheckoutNetworkId>(
    saved?.network || "avalanche"
  );
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [message, setMessage] = useState("");
  const [account, setAccount] = useState(""),
    [tronAccount, setTronAccount] = useState("");
  const [estimates, setEstimates] = useState<NetworkEstimate[]>([]);
  const [now, setNow] = useState(Date.now());
  const recommended = recommendPaymentNetwork(
    estimates.filter(e => now - e.quotedAt <= 60000)
  );
  const userChose = useRef(false);
  const providerRef = useRef<Provider | undefined>(undefined);
  const languageMap: Record<string, keyof typeof walletPaymentCopy> = {
    Русский: "ru",
    Deutsch: "de",
    Español: "es",
    English: "en",
  };
  const locale = quote
    ? languageMap[quote.language] || "en"
    : navigator.language.slice(0, 2) in walletPaymentCopy
      ? (navigator.language.slice(0, 2) as keyof typeof walletPaymentCopy)
      : "en";
  const c = walletPaymentCopy[locale],
    t = extra[locale];
  const network = quote?.networks.find(n => n.id === selected);
  const estimate = estimates.find(e => e.network === selected);
  const address = selected === "tron" ? tronAccount : account;
  const expired = quote && now / 1000 >= quote.deadline;
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("public-locale", locale);
      window.dispatchEvent(new Event("public-locale-changed"));
    } catch {
      /* Optional browser storage. */
    }
  }, [locale]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const r = await fetch(endpoint);
        if (!r.ok) throw new Error();
        const q = await r.json();
        if (!Array.isArray(q.networks)) throw new Error();
        if (active) {
          setQuote(q);
          setFailed(false);
          setSelected(
            n =>
              q.binding?.network ||
              (q.networks.some((v: Network) => v.id === n)
                ? n
                : q.networks[0]?.id)
          );
        }
      } catch {
        if (active) setFailed(true);
      }
    };
    void refresh();
    const poll = setInterval(() => void refresh(), 12000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [endpoint]);
  useEffect(() => {
    const provider = (window as Window & { ethereum?: Provider }).ethereum;
    providerRef.current = provider;
    const reset = () => {
      setAccount("");
      setEstimates(e => e.filter(v => v.network === "tron"));
      setMessage(t.switched);
    };
    provider?.on?.("accountsChanged", reset);
    return () => {
      provider?.removeListener?.("accountsChanged", reset);
    };
  }, [t.switched]);
  async function api(path: string, body: unknown) {
    const r = await fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Request failed");
    return result;
  }
  async function refreshEstimates(walletAddress: string, onlySelected = false) {
    const result = await api("/estimate", {
      address: walletAddress,
      network: selected,
      onlySelected,
    });
    setEstimates(previous => [
      ...previous.filter(
        e =>
          !result.estimates.some(
            (v: NetworkEstimate) => v.network === e.network
          )
      ),
      ...result.estimates,
    ]);
    if (selected !== "tron" && !onlySelected) {
      if (result.recommended && !userChose.current && !quote?.binding)
        setSelected(result.recommended);
    }
    return result.estimates as NetworkEstimate[];
  }
  async function connect() {
    if (busy || saved || expired) return;
    setBusy(true);
    setMessage("");
    try {
      if (selected === "tron") {
        const { address: a, adapter } = await (
          await import("@/lib/tron-wallet")
        ).connectTronWallet();
        adapter.on("accountsChanged", () => {
          setTronAccount("");
          setEstimates(e => e.filter(v => v.network !== "tron"));
        });
        setTronAccount(a);
        await refreshEstimates(a);
      } else {
        const provider = providerRef.current;
        if (!provider?.isMetaMask) {
          setMessage(c.missing);
          return;
        }
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        });
        if (!accounts[0]) throw new Error();
        setAccount(accounts[0]);
        await refreshEstimates(accounts[0]);
      }
    } catch (e: any) {
      setMessage(e.code === 4001 ? c.rejected : c.error);
    } finally {
      setBusy(false);
    }
  }
  function savePayment(payment: SavedPayment) {
    setSaved(payment);
    try {
      localStorage.setItem(`wallet-payment:${token}`, JSON.stringify(payment));
    } catch {
      /* Background worker finds signed order transfers. */
    }
  }
  async function check(payment = saved) {
    if (!payment) return;
    setBusy(true);
    try {
      const result = await api("", payment);
      if (result.paid) setQuote(q => q && { ...q, paid: true });
      setMessage(result.paid ? "" : c.pending);
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  async function ensureWalletBinding() {
    if (!quote || !network) throw new Error("Invoice unavailable");
    if (quote.binding) {
      if (
        quote.binding.network !== selected ||
        (selected === "tron"
          ? quote.binding.payer !== address
          : quote.binding.payer.toLowerCase() !== address.toLowerCase())
      )
        throw new Error("Wallet does not match the confirmed payer");
      return;
    }
    const challenge = await api("/challenge", { network: selected, address });
    const signature =
      selected === "tron"
        ? await (
            await import("@/lib/tron-wallet")
          ).signTronMessage(challenge.message, address)
        : await providerRef.current!.request({
            method: "personal_sign",
            params: [
              "0x" +
                Array.from(new TextEncoder().encode(challenge.message), b =>
                  b.toString(16).padStart(2, "0")
                ).join(""),
              address,
            ],
          });
    const binding = await api("/bind", {
      challengeToken: challenge.challengeToken,
      signature,
    });
    setQuote(
      q =>
        q && {
          ...q,
          binding: { network: binding.network, payer: binding.payer },
          statusUrl: binding.statusUrl,
        }
    );
  }
  async function pay() {
    if (!quote || !network || busy || saved || expired || !address) return;
    setBusy(true);
    setMessage(c.busy);
    try {
      // Recheck balances and simulation immediately before requesting the wallet signature.
      const fresh = (await refreshEstimates(address, true)).find(
        e => e.network === selected
      );
      if (fresh?.status !== "ready") {
        setMessage(fresh ? t[fresh.status] : c.error);
        return;
      }
      await ensureWalletBinding();
      if (selected === "tron") {
        const built = await api("/tron-transaction", { address });
        if (Date.now() / 1000 >= quote.deadline) {
          setMessage(c.expired);
          return;
        }
        const signed = await (
          await import("@/lib/tron-wallet")
        ).signTronPayment(built.transaction, address);
        // Preserve the transaction ID before broadcast: a timeout must never offer a second payment.
        const payment = { network: "tron" as const, hash: signed.txID };
        savePayment(payment);
        await api("/tron-broadcast", { transaction: signed });
        setMessage(c.pending);
        await check(payment);
      } else {
        const provider = providerRef.current!;
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: network.chainId }],
          });
        } catch (e: any) {
          if (e.code !== 4902) throw e;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: network.chainId,
                chainName: network.name,
                nativeCurrency: {
                  name: network.nativeSymbol,
                  symbol: network.nativeSymbol,
                  decimals: 18,
                },
                rpcUrls: [network.walletRpc],
                blockExplorerUrls: [network.explorer],
              },
            ],
          });
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: network.chainId }],
          });
        }
        const accounts = await provider.request({ method: "eth_accounts" });
        if (
          (await provider.request({ method: "eth_chainId" }))?.toLowerCase() !==
            network.chainId ||
          accounts[0]?.toLowerCase() !== address.toLowerCase()
        )
          throw new Error("Wallet changed");
        if (Date.now() / 1000 >= quote.deadline) {
          setMessage(c.expired);
          return;
        }
        const hash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: network.token,
              value: "0x0",
              data: network.data,
              gas: fresh.gasLimit,
            },
          ],
        });
        const payment = { network: selected, hash };
        savePayment(payment);
        setMessage(c.pending);
        await check(payment);
      }
    } catch (e: any) {
      setMessage(e.code === 4001 ? c.rejected : c.error);
    } finally {
      setBusy(false);
    }
  }
  const fmt = (v: string) =>
    Number(v).toLocaleString(locale, { maximumSignificantDigits: 8 });
  const feeUsd = (value: number) =>
    (value > 0 && value < 0.0001 ? "< " : "") +
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: value < 0.01 ? 4 : 2,
      maximumFractionDigits: value < 0.01 ? 4 : 2,
    }).format(value > 0 && value < 0.0001 ? 0.0001 : value);
  return (
    <main className="min-h-screen bg-[#f7f2e8] text-[#28231f] px-4 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-[#c7b48b] bg-[#fffdf7] p-6 sm:p-10 shadow-xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm underline"
        >
          <ArrowLeft size={16} />
          {c.back}
        </a>
        <div className="my-6 text-[#967239]">
          {quote?.paid ? <CheckCircle2 size={36} /> : <Wallet size={36} />}
        </div>
        <h1 className="text-3xl font-serif">
          {quote?.paid ? c.paid : c.title}
        </h1>
        {!quote ? (
          <p className="mt-5" role="status">
            {failed ? c.unavailable : c.loading}
          </p>
        ) : quote.paid || quote.manualReview ? (
          <div className="mt-5 leading-relaxed" role="status">
            <p>{quote.refundState ? (locale === "ru" ? (quote.refundState === "refunded" ? "Возврат подтверждён. Повторно платить не нужно." : "Возврат одобрен. Следите за статусом заказа; повторно не платите.") : locale === "de" ? "Diese Bestellung wird erstattet. Nicht erneut bezahlen; prüfen Sie den Bestellstatus." : locale === "es" ? "Este pedido está en proceso de reembolso. No vuelvas a pagar; consulta su estado." : "This order is in the refund process. Do not pay again; check the order status.") : quote.manualReview ? t.manual : c.next}</p>
            {quote.statusUrl && (
              <a className="inline-block mt-4 underline" href={quote.statusUrl}>
                {locale === "ru"
                  ? "Статус заказа и PDF"
                  : "Order status and PDF"}
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm text-[#706353]">{t.total}</p>
            <p className="mb-6 text-4xl font-semibold">
              {quote.amount}{" "}
              <span className="text-2xl">{network?.tokenSymbol || "USDT"}</span>
            </p>
            <fieldset
              disabled={
                busy ||
                Boolean(saved) ||
                Boolean(expired) ||
                Boolean(quote.binding)
              }
            >
              <legend className="mb-3 font-semibold">{t.choose}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {quote.networks.map(n => {
                  const e = estimates.find(v => v.network === n.id);
                  return (
                    <label
                      key={n.id}
                      className={`block cursor-pointer rounded-2xl border p-4 ${selected === n.id ? "border-[#967239] bg-[#f3ebdb] ring-1 ring-[#967239]" : "border-[#ded5c4]"}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          className="mt-1 accent-[#967239]"
                          type="radio"
                          name="payment-network"
                          value={n.id}
                          checked={selected === n.id}
                          onChange={() => {
                            userChose.current = true;
                            setSelected(n.id);
                            setMessage("");
                          }}
                        />
                        <div className="min-w-0">
                          <strong>{n.name}</strong>
                          <p className="text-xs mt-1">
                            {n.tokenSymbol} · {n.nativeSymbol}
                          </p>
                          {recommended === n.id && (
                            <p className="text-xs mt-2 font-semibold text-[#446645]">
                              {t.recommend}
                            </p>
                          )}
                          {e && (
                            <>
                              <p className="mt-2 text-sm">
                                {e.estimatedNative
                                  ? `${fmt(e.estimatedNative)} ${n.nativeSymbol}${e.estimatedUsd !== undefined ? ` ≈ ${feeUsd(e.estimatedUsd)}` : ""}`
                                  : t[
                                      e.status === "ready" ? "ready" : e.status
                                    ]}
                              </p>
                              {e.status !== "ready" && e.estimatedNative && (
                                <p className="text-xs text-amber-900 mt-1">
                                  {t[e.status]}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="my-4 text-xs leading-relaxed text-[#706353]">
              {t.tokenNote}
            </p>
            {!saved && (
              <button
                disabled={busy || Boolean(expired)}
                onClick={() => void connect()}
                className="w-full rounded-xl border border-[#967239] px-4 py-3 flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}{" "}
                {address ? t.refresh : t.connect}
              </button>
            )}
            {address && (
              <p className="mt-3 text-xs break-all">
                {t.wallet}: {address}
              </p>
            )}
            {estimate && network && (
              <div
                className="my-5 rounded-2xl bg-[#f3ebdb] p-4 space-y-2 text-sm"
                aria-live="polite"
              >
                <p className="font-semibold">{t.fee}</p>
                {estimate.estimatedNative && (
                  <p>
                    {fmt(estimate.estimatedNative)} {network.nativeSymbol}{" "}
                    {estimate.estimatedUsd !== undefined
                      ? `≈ ${feeUsd(estimate.estimatedUsd)}`
                      : ""}
                  </p>
                )}
                {estimate.tokenBalance && (
                  <p>
                    {t.balance}: {fmt(estimate.tokenBalance)}{" "}
                    {network.tokenSymbol} · {fmt(estimate.nativeBalance || "0")}{" "}
                    {network.nativeSymbol}
                  </p>
                )}
                {estimate.budgetNative && (
                  <p className="text-xs">
                    {t.budget}: {fmt(estimate.budgetNative)}{" "}
                    {network.nativeSymbol}
                  </p>
                )}
                <p
                  className={
                    estimate.status === "ready"
                      ? "text-[#446645]"
                      : "text-amber-900"
                  }
                >
                  {t[estimate.status]}
                </p>
                {now - estimate.quotedAt > 60000 && <p>{t.stale}</p>}
                {estimate.estimatedUsd === undefined && (
                  <p className="text-xs">{t.noPrices}</p>
                )}
                {estimate.estimatedUsd !== undefined &&
                  estimate.estimatedUsd >
                    Math.max(1, Number(quote.amount) * 0.05) && (
                    <p className="text-amber-900">{t.caution}</p>
                  )}
              </div>
            )}
            <dl className="my-5 space-y-3 text-sm">
              <div>
                <dt>
                  {c.recipient} · {network?.name}
                </dt>
                <dd className="break-all font-mono mt-1">
                  {network?.recipient}
                </dd>
              </div>
              <div>
                <dt>{c.until}</dt>
                <dd>
                  {new Date(quote.deadline * 1000).toLocaleString(locale)}
                </dd>
              </div>
            </dl>
            <p className="my-4 text-xs leading-relaxed">
              {selected === "tron" ? t.tronNote : t.note}
            </p>
            {expired && (
              <p className="mb-4 text-amber-900" role="status">
                {c.expired}
              </p>
            )}
            {saved && <p className="my-4 text-sm">{t.checkOnly}</p>}
            <button
              className="w-full rounded-xl bg-[#36312b] text-white px-5 py-4 disabled:opacity-50 flex justify-center items-center gap-2"
              disabled={
                busy ||
                (!saved &&
                  (Boolean(expired) ||
                    estimate?.status !== "ready" ||
                    !address ||
                    now - estimate.quotedAt > 60000))
              }
              onClick={() => void (saved ? check() : pay())}
            >
              {busy && <Loader2 className="animate-spin" size={18} />}{" "}
              {saved ? c.check : c.pay}
            </button>
            {saved && network && (
              <a
                className="block mt-4 text-xs underline break-all"
                href={`${network.explorer}${selected === "tron" ? "/transaction/" : "/tx/"}${saved.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                {saved.hash}
              </a>
            )}
            {quote.binding && !saved && (
              <p className="mt-3 text-xs">
                {locale === "ru"
                  ? "Сеть и кошелёк закреплены вашей подписью. Эта подпись не даёт разрешения на списание токенов."
                  : "Your signature fixes this wallet and network for this order. It does not authorize token spending."}
              </p>
            )}
            {quote.statusUrl && (
              <a
                className="inline-block mt-4 text-sm underline"
                href={quote.statusUrl}
              >
                {locale === "ru"
                  ? "Статус заказа и PDF"
                  : "Order status and PDF"}
              </a>
            )}
            {message && (
              <p className="mt-5 text-sm leading-relaxed" role="status">
                {message}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
