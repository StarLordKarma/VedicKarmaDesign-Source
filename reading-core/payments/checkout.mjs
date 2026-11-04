import { CARD_COPY } from "./copy.mjs";
const root = document.getElementById("card-checkout"),
  token = location.pathname.split("/").at(-1),
  endpoint = "/api/card-sandbox/" + encodeURIComponent(token);
let data,
  busy = false,
  last = "",
  message = "",
  displayedQuoteId;
const draft = {
  reason: "",
  address: "",
  basis: "voluntary",
  network: "0.01",
  accepted: false,
};
const element = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const money = units =>
  (Number(units) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") +
  " USDC";
function button(parent, label, action, secondary = false) {
  const b = element("button", label, "cta" + (secondary ? " secondary" : ""));
  b.type = "button";
  b.disabled = busy;
  b.onclick = action;
  parent.append(b);
  return b;
}
function para(parent, text, cls) {
  parent.append(element("p", text, cls));
}
function input(parent, labelText, key, type = "text") {
  const label = element("label", labelText),
    field = element(type === "textarea" ? "textarea" : "input");
  if (type !== "textarea") field.type = type;
  field.value = draft[key];
  field.oninput = () => (draft[key] = field.value);
  if (key === "reason") {
    field.maxLength = 1000;
    field.rows = 3;
  }
  if (key === "address") {
    field.maxLength = 42;
    field.autocomplete = "off";
    field.placeholder = "0x…";
  }
  if (key === "network") {
    field.min = "0";
    field.step = "0.000001";
  }
  label.append(field);
  parent.append(label);
  return field;
}
async function act(payload) {
  if (busy) return;
  busy = true;
  message = "";
  render();
  try {
    const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      value = await r.json();
    if (!r.ok) throw Error(value.error);
    data = value;
    last = JSON.stringify(value);
  } catch {
    message = (CARD_COPY[data?.locale] || CARD_COPY.en).error;
  } finally {
    busy = false;
    render();
  }
}
function render() {
  // An updated quote needs a new deliberate acceptance, even when polling
  // refreshes the page while the buyer is reading the previous amount.
  const quoteId = data.refund?.quoteId;
  if (quoteId !== displayedQuoteId) {
    draft.accepted = false;
    displayedQuoteId = quoteId;
  }
  const c = CARD_COPY[data.locale] || CARD_COPY.en;
  root.replaceChildren();
  const back = element("a", "← " + c.back);
  back.href = "/?lang=" + data.locale;
  root.append(back);
  para(root, data.sandbox ? c.sandbox : c.liveCheckout, "payment-preview");
  root.append(element("h1", c.title));
  const grid = element("div", undefined, "checkout-layout"),
    main = element("section", undefined, "checkout-panel"),
    side = element("aside", undefined, "checkout-panel");
  grid.append(main, side);
  root.append(grid);
  main.append(element("h2", c.summary));
  para(main, "Karma Life Design · #" + data.bookingId);
  para(
    main,
    (c["product_" + data.product] || c.title) +
      " · " +
      (data.brand === "apple_pay"
        ? c.applePay
        : data.brand === "google_pay"
          ? c.googlePay
          : data.brand.toUpperCase())
  );
  main.append(
    element(
      "div",
      new Intl.NumberFormat(data.locale, {
        style: "currency",
        currency: "USD",
      }).format(data.totalCents / 100),
      "checkout-total"
    )
  );
  para(main, c.status);
  main.append(element("span", c[data.status] || data.status, "checkout-badge"));
  if (data.provider?.id === "riskpay") {
    para(main, data.sandbox ? c.riskpay : c.liveCheckout);
    para(main, c.walletAvailability, "fine");
  }
  para(main, c.delivery);
  if (data.report)
    para(
      main,
      data.report.status === "sent"
        ? c.reportSent
        : ["needs_review", "approved"].includes(data.report.status)
          ? c.reportReview
          : ["calculation_failed", "render_failed", "delivery_failed"].includes(
                data.report.status
              )
            ? c.reportFailed
            : c.reportQueued
    );
  if (data.statusUrl) {
    const a = element("a", c.private, "cta secondary checkout-private");
    a.href = data.statusUrl;
    main.append(a);
  }
  para(main, c.save, "fine");
  side.append(element("h2", data.sandbox ? c.test : c.continueRiskPay));
  para(side, data.sandbox ? c.testNote : c.liveNote);
  const actions = element("div", undefined, "checkout-actions");
  side.append(actions);
  if (
    data.gatewayUrl &&
    ["pending", "processing"].includes(data.status) &&
    Date.now() < data.expiresAt
  ) {
    const pay = element("a", c.continueRiskPay, "cta");
    const url = new URL(data.gatewayUrl);
    if (url.origin === "https://pay.riskpay.biz") {
      pay.href = url.href;
      pay.rel = "noreferrer";
      actions.append(pay);
    }
  }
  if (
    data.sandbox &&
    ["pending", "processing", "review", "failed", "expired"].includes(
      data.status
    )
  ) {
    button(actions, c.settle, () =>
      act({ action: "simulate", outcome: "settled" })
    );
    button(
      actions,
      c.authorize,
      () => act({ action: "simulate", outcome: "authorized" }),
      true
    );
    button(
      actions,
      c.decline,
      () => act({ action: "simulate", outcome: "declined" }),
      true
    );
    button(
      actions,
      c.expire,
      () => act({ action: "simulate", outcome: "expired" }),
      true
    );
  }
  if (data.sandbox && data.status === "paid")
    button(
      actions,
      c.duplicate,
      () => act({ action: "simulate", outcome: "duplicate" }),
      true
    );
  para(side, c.manual);
  if (data.owner) {
    const a = element("a", c.owner, "checkout-private");
    a.href = "/admin/report-studio";
    side.append(a);
    const refunds = element("a", c.refund, "checkout-private");
    refunds.href = "/sandbox/card-owner?lang=" + data.locale;
    side.append(refunds);
  }
  if (["paid", "refund_pending", "refunded"].includes(data.status)) {
    const panel = element(
      "section",
      undefined,
      "checkout-panel checkout-owner"
    );
    root.append(panel);
    panel.append(element("h2", c.refund));
    const r = data.refund;
    if (!r) {
      input(panel, c.reason, "reason", "textarea");
      button(
        panel,
        c.send,
        () => act({ action: "request_refund", reason: draft.reason }),
        true
      );
    } else {
      para(panel, c.requested);
      para(panel, r.reason);
      if (r.quote) {
        const table = element("div", undefined, "refund-breakdown");
        for (const [label, key] of [
          [c.gross, "grossMicroUsdc"],
          [c.siteFee, "siteMicroUsdc"],
          [c.networkFee, "networkMicroUsdc"],
          [c.receive, "netMicroUsdc"],
        ]) {
          const row = element("div");
          row.append(
            element("span", label),
            element("span", money(r.quote[key]))
          );
          table.append(row);
        }
        panel.append(table);
        para(panel, c.currency);
        para(panel, c.rate, "fine");
        if (r.status === "quoted") {
          input(panel, c.address, "address");
          const label = element("label"),
            check = element("input");
          check.type = "checkbox";
          check.checked = draft.accepted;
          check.onchange = () => (draft.accepted = check.checked);
          label.append(check, document.createTextNode(" " + c.accept));
          panel.append(label);
          button(panel, c.acceptQuote, () =>
            act({
              action: "accept_refund",
              quoteId: r.quoteId,
              recipient: draft.address,
              accepted: draft.accepted,
            })
          );
        }
        if (r.recipient) para(panel, r.recipient);
        if (r.reference) para(panel, r.reference);
      }
      if (data.owner && ["requested", "quoted"].includes(r.status)) {
        const label = element("label", c.basis),
          select = element("select");
        for (const [value, text] of [
          ["voluntary", c.voluntary],
          ["mandatory", c.mandatory],
        ]) {
          const option = element("option", text);
          option.value = value;
          option.selected = draft.basis === value;
          select.append(option);
        }
        select.onchange = () => {
          draft.basis = select.value;
        };
        label.append(select);
        panel.append(label);
        input(panel, c.network, "network", "number");
        button(
          panel,
          c.quote,
          () => {
            const amount = draft.network;
            if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
              message = c.error;
              render();
              return;
            }
            const [a, b = ""] = amount.split(".");
            act({
              action: "quote_refund",
              basis: draft.basis,
              networkMicroUsdc: (
                BigInt(a) * 1000000n +
                BigInt(b.padEnd(6, "0"))
              ).toString(),
            });
          },
          true
        );
      }
      if (data.owner && r.status === "accepted")
        button(panel, c.confirm, () => act({ action: "confirm_refund" }), true);
    }
  }
  const terms = element("details", undefined, "payment-terms");
  terms.append(element("summary", c.terms));
  para(terms, data.consent.text);
  para(
    terms,
    data.consent.version +
      " · " +
      new Date(data.consent.at).toLocaleString(data.locale)
  );
  root.append(terms);
  para(root, c.legal, "checkout-note");
  para(root, message, "checkout-error");
}
async function load() {
  try {
    const r = await fetch(endpoint, { cache: "no-store" });
    if (!r.ok) throw Error();
    const v = await r.json(),
      serialized = JSON.stringify(v);
    if (!busy && serialized !== last) {
      data = v;
      last = serialized;
      render();
    }
  } catch {
    if (!data) root.textContent = "Private sandbox checkout unavailable.";
  }
}
await load();
setInterval(() => {
  if (!document.hidden && !busy) void load();
}, 5000);
