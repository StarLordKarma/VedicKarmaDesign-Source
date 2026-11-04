import { MANUAL_COPY } from './manual-copy.mjs';
import { CARD_COPY } from "./copy.mjs";
const esc = s =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function cardMethodMarkup(locale, { live = false, manual = false } = {}) {
  const c = CARD_COPY[locale] || CARD_COPY.en;
  return `<fieldset id="card-payment-options" class="payment-picker"><legend>${esc(c.method)}</legend><div class="payment-choice-grid"><label class="payment-choice"><input type="radio" name="payment-method" value="crypto" checked><span><strong>${esc(c.crypto)}</strong><small>USDT</small></span></label><label class="payment-choice"><input type="radio" name="payment-method" value="card"><span><strong>${esc(c.card)}</strong><small>Visa / Mastercard</small></span></label><label class="payment-choice"><input type="radio" name="payment-method" value="apple_pay"><span><strong>${esc(c.applePay)}</strong><small>${esc(c.walletHint)}</small></span></label><label class="payment-choice"><input type="radio" name="payment-method" value="google_pay"><span><strong>${esc(c.googlePay)}</strong><small>${esc(c.walletHint)}</small></span></label></div><div id="card-payment-details" hidden><p class="payment-preview">${esc(live ? c.liveCheckout : c.sandbox)}</p><p class="fine">${esc(manual ? (MANUAL_COPY[locale] || MANUAL_COPY.en).notice : live ? c.liveNote : c.notice)}</p><p class="fine">${esc(c.walletAvailability)}</p><label class="card-brand-label">Visa / Mastercard<select id="card-brand"><option value="visa">Visa</option><option value="mastercard">Mastercard</option></select></label><details class="payment-terms"><summary>${esc(c.terms)}</summary><p>${esc(manual ? (MANUAL_COPY[locale] || MANUAL_COPY.en).methods : c.manual)}</p><p>${esc(c.legal)}</p></details><label class="check card-consent"><input type="checkbox" id="card-refund-consent"><span>${esc(c.consent + (manual ? " " + (MANUAL_COPY[locale] || MANUAL_COPY.en).notice : ""))}</span></label></div></fieldset>`;
}
