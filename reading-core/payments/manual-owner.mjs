const root = document.querySelector("#manual-root"),
  feedback = document.querySelector("#manual-feedback");
const el = (tag, text, cls) => {
  const x = document.createElement(tag);
  if (text !== undefined) x.textContent = String(text);
  if (cls) x.className = cls;
  return x;
};
const labels = {
  waiting: "Ожидает поступления",
  creating: "Создание оплаты",
  failed: "Ошибка создания оплаты",
  received_review: "Поступление — проверить",
  confirmed: "Принято в подготовку",
  refund_pending: "Запрошен возврат",
  needs_review: "PDF готов — проверить",
  queued: "В очереди подготовки",
  calculating: "Расчёт",
  narrative_draft: "Подготовка текста",
  rendering: "Создание PDF",
  sent: "Принято почтовым сервисом",
  delivery_failed: "Ошибка отправки",
  calculation_failed: "Ошибка расчёта",
  render_failed: "Ошибка PDF",
};
const state = s => labels[s] || s || "—";
const product = identity =>
  ({
    vedic_basic: "Натальная карта · базовое чтение",
    vedic_plus: "Натальная карта · расширенное чтение",
    portrait: "Западная натальная карта",
    daily: "Ежедневный прогноз",
    monthly: "Месячный прогноз",
    tarot: "Чтение Таро",
  })[identity.reading?.product || identity.packageCode] || identity.packageCode;
const units = v =>
  v
    ? `${BigInt(v) / 1000000n}.${(BigInt(v) % 1000000n).toString().padStart(6, "0")} USDC`
    : "—";
let selected = Number(new URL(location.href).searchParams.get("order")) || null,
  pending = false;
const list = el("aside", undefined, "manual-orders"),
  content = el("div");
const grid = el("div", undefined, "manual-grid");
grid.append(list, content);
root.append(
  el(
    "p",
    "Сначала проверьте поступление и запустите подготовку. Затем откройте PDF, проверьте получателя и отдельно подтвердите отправку. Данные клиента видны только владельцу."
  ),
  grid
);
async function api(path, body) {
  const r = await fetch("/api/riskpay-manual/" + path, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: body
      ? { "Content-Type": "application/json", "X-KLD-Owner": "1" }
      : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok)
    throw Error(
      r.status === 403
        ? "Требуется вход владельца. Откройте /owner-login."
        : data?.error || "Сервис временно недоступен"
    );
  return data;
}
function field(dl, label, value) {
  dl.append(el("dt", label), el("dd", value ?? "—"));
}
function input(form, label, type = "text") {
  const box = el("label", label),
    i = el("input");
  i.type = type;
  i.required = true;
  box.append(i);
  form.append(box);
  return i;
}
function check(form, label) {
  const checkbox = input(form, label, "checkbox");
  checkbox.parentNode.prepend(checkbox);
  return checkbox;
}
function button(text, fn) {
  const b = el("button", text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
async function mutate(id, body) {
  if (pending) return;
  pending = true;
  content.querySelectorAll("button").forEach(b => (b.disabled = true));
  feedback.textContent = "Сохраняю решение…";
  try {
    await api("orders/" + id, body);
    feedback.textContent =
      body.action === "prepare"
        ? "Поступление принято. Подготовка запускается; перед отправкой потребуется отдельная проверка PDF."
        : body.action === "send"
          ? "Действие отправки обработано. Проверьте результат ниже."
          : "Проверка выполнена. Обновлённые данные показаны ниже.";
    await load();
  } catch (e) {
    feedback.textContent = e.message;
    await show(id);
  } finally {
    pending = false;
  }
}
async function show(id) {
  selected = id;
  const url = new URL(location.href);
  url.searchParams.set("order", String(id));
  history.replaceState(null, "", url);
  content.replaceChildren();
  try {
    const d = await api("orders/" + id),
      i = d.identity;
    const panel = el("section", undefined, "manual-panel"),
      dl = el("dl");
    panel.append(el("h2", "Заказ #" + id));
    field(dl, "Покупатель / имя в отчёте", i.name);
    field(dl, "Кому отправится PDF", i.email);
    field(dl, "Услуга · язык", product(i) + " · " + i.language);
    field(
      dl,
      "Дата и местное время рождения",
      i.birthDate + " · " + i.birthTime
    );
    field(dl, "Место рождения", i.birthCity + ", " + i.birthCountry);
    if (i.reading) {
      field(dl, "Часовой пояс клиента", i.reading.currentZone);
      field(
        dl,
        "Время рождения неизвестно",
        i.reading.unknownTime ? "Да" : "Нет"
      );
      field(dl, "Уточнение места", i.reading.disambiguation || "—");
    }
    field(
      dl,
      "Цена заказа (USD)",
      Number(i.totalUsd).toFixed(2) + " " + i.currency
    );
    field(dl, "Статус оплаты", state(d.payment));
    field(dl, "Статус PDF", state(d.job?.status));
    if (d.job?.error) {
      panel.append(
        el(
          "p",
          "Подготовка или доставка остановлена: " +
            d.job.error +
            ". Новый платёж не нужен.",
          "manual-warning"
        )
      );
      const recovery = el("a", "Открыть Report Studio — задание #" + d.job.id);
      recovery.href = "/admin/report-studio";
      panel.append(recovery);
    }
    panel.append(dl);
    if (d.changed)
      panel.append(
        el(
          "p",
          "Данные заказа изменены после создания оплаты. Подготовка и отправка заблокированы. Нужна отдельная проверка; не используйте другой заказ для этой оплаты.",
          "manual-warning"
        )
      );
    const payment = el("section", undefined, "manual-panel"),
      pd = el("dl");
    payment.append(el("h3", "Поступление по этому заказу"));
    field(pd, "Платёж RiskPay", d.paymentReference);
    field(pd, "Адрес, выделенный этому заказу", d.assignedAddress);
    field(pd, "Кошелёк продавца", d.merchantWallet);
    if (d.receipt) {
      field(
        pd,
        "Поступило на адрес заказа",
        units(d.receipt.incomingMicroUsdc)
      );
      field(
        pd,
        "Фактически поступило продавцу",
        units(d.receipt.merchantMicroUsdc)
      );
      field(
        pd,
        "Разница переводов (не подтверждённая общая комиссия карты)",
        units(
          (
            BigInt(d.receipt.incomingMicroUsdc) -
            BigInt(d.receipt.merchantMicroUsdc)
          ).toString()
        )
      );
      field(pd, "Актив / сеть", "USDC · Polygon · " + d.receipt.token);
      field(
        pd,
        "Дата поступления",
        new Date(d.receipt.receivedAt).toLocaleString("ru-RU")
      );
      field(pd, "Уникальная привязка перевода", d.receipt.claim);
      for (const [label, hash] of [
        ["Перевод на адрес заказа", d.receipt.txidIn],
        ["Перевод продавцу", d.receipt.txidOut],
      ]) {
        const a = el("a", label + " ↗");
        a.href = "https://polygonscan.com/tx/" + hash;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        payment.append(a, el("br"));
      }
    }
    payment.append(
      pd,
      el(
        "p",
        "Полученная криптосумма не доказывает полную цену карточного списания. Решение принять её в оплату принимает владелец. Не считайте разницу между USD и USDC точной комиссией.",
        "manual-warning"
      )
    );
    if (d.reviewReason) payment.append(el("small", d.reviewReason));
    if (!d.receipt) {
      payment.append(
        button("Повторить независимую проверку", () =>
          mutate(id, { action: "verify" })
        )
      );
      const missing = el("details");
      missing.append(
        el(
          "summary",
          "Если уведомление не пришло: указать транзакции для проверки"
        )
      );
      const form = el("form");
      form.append(
        el(
          "p",
          "Нужны оба перевода именно выделенного адреса этого заказа. Эти данные не подтверждают оплату: сервер независимо проверит их в Polygon."
        )
      );
      const ti = input(form, "Хеш перевода на адрес заказа"),
        to = input(form, "Хеш перевода с адреса заказа продавцу"),
        amount = input(
          form,
          "Поступило на адрес заказа, USDC (до удержания RiskPay)"
        );
      ti.pattern = to.pattern = "0x[a-fA-F0-9]{64}";
      amount.pattern = "[0-9]+(\\.[0-9]{1,6})?";
      const submit = el("button", "Проверить указанные переводы");
      submit.type = "submit";
      form.append(submit);
      form.onsubmit = e => {
        e.preventDefault();
        if (form.reportValidity())
          void mutate(id, {
            action: "transactions",
            txid_in: ti.value,
            txid_out: to.value,
            value_coin: amount.value,
          });
      };
      missing.append(form);
      payment.append(missing);
    }
    panel.append(payment);
    if (d.preparation)
      panel.append(
        el(
          "p",
          "Принятие поступления: " + d.preparation.at + " · " + d.preparation.by
        ),
        el("p", "Основание: " + d.preparation.note)
      );
    if (d.refund)
      panel.append(
        el(
          "p",
          "Возврат: " +
            d.refund.reason +
            " · " +
            d.refund.at +
            ". Новая отправка приостановлена. Запрос не означает перевод средств.",
          "manual-warning"
        )
      );
    if (
      d.receipt &&
      !d.preparation &&
      !d.changed &&
      d.payment === "received_review" &&
      !d.refund
    ) {
      const form = el("form", undefined, "manual-panel");
      form.append(el("h3", "1. Принять поступление и подготовить PDF"));
      const typed = input(
        form,
        "Для подтверждения введите номер заказа #" + id,
        "number"
      );
      typed.min = "1";
      const note = el("textarea"),
        noteLabel = el(
          "label",
          "Основание принятия полученной суммы (не менее 10 символов)"
        );
      note.required = true;
      note.minLength = 10;
      note.maxLength = 1000;
      noteLabel.append(note);
      form.append(noteLabel);
      const checked = check(
        form,
        "Я проверил заказ #" +
          id +
          ", покупателя " +
          i.name +
          ", получателя " +
          i.email +
          " и принимаю " +
          units(d.receipt.merchantMicroUsdc) +
          " как достаточную оплату этого заказа ценой " +
          Number(i.totalUsd).toFixed(2) +
          " USD."
      );
      const b = el("button", "Принять оплату и запустить подготовку");
      b.type = "submit";
      form.append(b);
      form.onsubmit = e => {
        e.preventDefault();
        if (form.reportValidity())
          void mutate(id, {
            action: "prepare",
            reviewHash: d.reviewHash,
            typedId: Number(typed.value),
            note: note.value,
            checked: checked.checked,
          });
      };
      panel.append(form);
    }
    if (d.version) {
      const pdf = el("section", undefined, "manual-panel");
      pdf.append(
        el("h3", "2. Проверить PDF и отправить"),
        el(
          "p",
          "Заказ #" + id + " · PDF v" + d.version.number + " · " + i.email
        ),
        el("small", "SHA-256: " + d.version.pdfSha256)
      );
      if (d.version.previewUrl) {
        const a = el("a", "Открыть именно эту версию PDF ↗");
        a.href = d.version.previewUrl;
        a.target = "_blank";
        a.rel = "noopener";
        pdf.append(a);
        const iframe = el("iframe");
        iframe.title = "PDF заказа #" + id + " · версия " + d.version.number;
        iframe.src = d.version.previewUrl;
        const embedded = el("details");
        embedded.append(el("summary", "Встроенный просмотр PDF"), iframe);
        pdf.append(embedded);
      }
      if (
        !d.changed &&
        !d.refund &&
        ["needs_review", "delivery_failed"].includes(d.job?.status)
      ) {
        const form = el("form"),
          typed = input(form, "Введите номер заказа #" + id, "number"),
          email = input(
            form,
            "Повторите email получателя (вставьте из проверенного заказа)",
            "email"
          );
        typed.min = "1";
        const checked = check(
          form,
          "Я открыл и проверил все страницы PDF v" +
            d.version.number +
            " заказа #" +
            id +
            ", данные рождения и получателя " +
            i.email +
            ". Разрешаю отправку этой версии."
        );
        const b = el(
          "button",
          d.job.status === "delivery_failed"
            ? "Повторить неудачную отправку этой версии"
            : "Подтвердить отправку PDF v" + d.version.number
        );
        b.type = "submit";
        form.append(b);
        form.onsubmit = e => {
          e.preventDefault();
          if (form.reportValidity())
            void mutate(id, {
              action: "send",
              reviewHash: d.reviewHash,
              typedId: Number(typed.value),
              email: email.value,
              versionId: d.version.id,
              checked: checked.checked,
            });
        };
        pdf.append(form);
      }
      panel.append(pdf);
    }
    if (d.attempts.length) {
      panel.append(el("h3", "История отправки этой версии"));
      for (const a of d.attempts)
        panel.append(
          el(
            "p",
            "#" +
              a.id +
              " · " +
              a.recipient +
              " · " +
              state(a.status) +
              " · " +
              new Date(a.at).toLocaleString("ru-RU")
          ),
          el("small", "ID почтового сервиса: " + (a.providerMessageId || "—"))
        );
      panel.append(
        el(
          "small",
          "Статус «Принято почтовым сервисом» не гарантирует доставку во входящие. Повторные нажатия не создают новое письмо."
        )
      );
    }
    const details = el("details"),
      summary = el("summary", "Сохранённое согласие на оплату и возврат");
    details.append(
      summary,
      el("p", d.consent.text),
      el("small", d.consent.version + " · " + d.consent.at)
    );
    panel.append(
      details,
      button("Обновить заказ", () => show(id))
    );
    content.append(panel);
  } catch (e) {
    feedback.textContent = e.message;
  }
}
async function load() {
  try {
    const d = await api("orders");
    list.replaceChildren();
    const funds = el("section", undefined, "manual-panel");
    funds.append(
      el("h3", "Резерв из поступлений"),
      el("p", "Учтено: " + units(d.funds.receivedMicroUsdc)),
      el("p", "Удержано: " + units(d.funds.reservedMicroUsdc)),
      el(
        "small",
        "Весь остаток каждого заказа — 14 суток от поступления. Непринятые и спорные заказы удерживаются дольше. Это учёт, а не блокировка кошелька; исполненные вручную возвраты пока требуют отдельной сверки."
      )
    );
    list.append(
      funds,
      button("Обновить очередь", () => load()),
      el(
        "small",
        "Последние 200 заказов. Любой прежний заказ можно открыть по номеру."
      )
    );
    const search = el("form"),
      number = input(search, "Открыть заказ по номеру", "number"),
      open = el("button", "Открыть");
    number.min = "1";
    open.type = "submit";
    search.append(open);
    search.onsubmit = e => {
      e.preventDefault();
      if (search.reportValidity()) void show(Number(number.value));
    };
    list.append(search);
    for (const o of d.orders) {
      const b = button(
        "#" +
          o.id +
          " · " +
          o.name +
          "\n" +
          o.email +
          "\n" +
          o.product +
          " · $" +
          Number(o.totalUsd).toFixed(2) +
          "\n" +
          state(o.payment) +
          " · " +
          units(o.received),
        () => show(o.id)
      );
      b.style.whiteSpace = "pre-wrap";
      b.setAttribute("aria-current", String(o.id === selected));
      list.append(b);
    }
    if (!d.orders.length) list.append(el("p", "Заказов RiskPay пока нет."));
    if (selected) await show(selected);
  } catch (e) {
    feedback.textContent = e.message;
  }
}
void load();
