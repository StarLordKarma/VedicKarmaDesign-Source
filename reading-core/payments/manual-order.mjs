import { MANUAL_COPY } from "./manual-copy.mjs";
const root = document.querySelector("#manual-root"),
  feedback = document.querySelector("#manual-feedback");
const token = location.pathname.split("/").pop();
const el = (tag, text, cls) => {
  const x = document.createElement(tag);
  if (text !== undefined) x.textContent = text;
  if (cls) x.className = cls;
  return x;
};
let busy = false;
async function load() {
  if (busy) return;
  busy = true;
  try {
    const r = await fetch("/api/riskpay-order/" + encodeURIComponent(token), {
      cache: "no-store",
    });
    if (!r.ok) throw Error();
    const d = await r.json(),
      c = MANUAL_COPY[d.locale] || MANUAL_COPY.en;
    document.documentElement.lang = d.locale;
    root.replaceChildren();
    const panel = el("section", undefined, "manual-panel");
    panel.append(
      el("h2", c.title + " #" + d.id),
      el(
        "p",
        d.product + " · " + Number(d.totalUsd).toFixed(2) + " " + d.currency
      ),
      el("p", c.notice, "manual-warning"),
      el(
        "p",
        d.refundRequested
          ? c.refund
          : d.accepted
            ? c.preparing
            : d.received
              ? c.review
              : c.waiting,
        "manual-status"
      ),
      el("p", c.save)
    );
    if (d.orderFlow) {
      const messages = {
        en: "Acceptance email / earliest report delivery",
        ru: "Письмо о принятии / отправка отчёта не раньше",
        es: "Correo de aceptación / primer envío posible",
        de: "Annahmebestätigung / frühester Berichtversand",
      };
      panel.append(
        el(
          "p",
          `${messages[d.locale] || messages.en}: ${(["accepted", "delivered"].includes(d.orderFlow.acknowledgement) ? { en: "Accepted by email service", ru: "Принято почтовым сервисом", es: "Aceptado por el servicio de correo", de: "Vom E-Mail-Dienst angenommen" } : { en: "Awaiting acceptance email", ru: "Ожидается письмо о принятии", es: "Correo de aceptación pendiente", de: "Annahmebestätigung ausstehend" })[d.locale] || "—"} · ${d.orderFlow.scheduledAt ? new Date(d.orderFlow.scheduledAt).toLocaleString() : "—"}`
        )
      );
    }
    if (d.gatewayUrl) {
      const a = el("a", c.pay, "manual-link");
      a.href = d.gatewayUrl;
      a.rel = "noreferrer";
      panel.append(a, el("small", c.methods));
    }
    if (d.statusUrl) {
      const a = el("a", c.status, "manual-link");
      a.href = d.statusUrl;
      panel.append(a);
    }
    const refresh = el("button", c.refresh);
    refresh.type = "button";
    refresh.onclick = () => load();
    panel.append(refresh);
    if (d.received && !d.refundRequested) {
      const form = el("form"),
        label = el("label", c.reason),
        reason = el("textarea");
      reason.required = true;
      reason.minLength = 10;
      reason.maxLength = 1000;
      label.append(reason);
      const submit = el("button", c.submit);
      submit.type = "submit";
      form.append(el("h3", c.request), label, submit);
      form.onsubmit = async e => {
        e.preventDefault();
        submit.disabled = true;
        try {
          const r = await fetch(
            "/api/riskpay-order/" + encodeURIComponent(token) + "/refund",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: reason.value }),
            }
          );
          if (!r.ok) throw Error();
          await load();
        } catch {
          feedback.textContent = c.error;
        } finally {
          submit.disabled = false;
        }
      };
      panel.append(form);
    }
    root.append(panel);
    feedback.textContent = "";
  } catch {
    feedback.textContent = (
      MANUAL_COPY[document.documentElement.lang] || MANUAL_COPY.en
    ).error;
  } finally {
    busy = false;
  }
}
void load();
