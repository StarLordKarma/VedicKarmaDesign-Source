const root = document.querySelector("#orders"),
  feedback = document.querySelector("#feedback");
const names = {
  pending: "В очереди",
  sending: "Отправляется",
  accepted: "Принято почтовым сервисом",
  delivered: "Доставка подтверждена",
  retry: "Повтор после временной ошибки",
  failed: "Ошибка — нужно исправить",
  reconcile: "Нужна сверка",
  confirmed: "Оплата подтверждена",
  paid:"Оплата подтверждена",paid_over:"Оплата подтверждена (с превышением)",payment_done:"Оплата подтверждена",finished:"Оплата завершена",
  received_review: "Средства получены — проверить",
  waiting: "Ожидает оплаты",
  creating: "Создание оплаты",
  refund_pending: "Возврат — выдача остановлена",
  queued: "В очереди подготовки",
  calculating: "Расчёт",
  narrative_draft: "Подготовка текста",
  rendering: "Создание PDF",
  needs_review: "PDF готов — проверка владельцем",
  approved: "PDF одобрен",
  sent: "Итоговое письмо принято сервисом",
  delivery_failed: "Ошибка итогового письма",
  calculation_failed: "Ошибка расчёта",
  render_failed: "Ошибка PDF",
};
const display = v => names[v] || v || "—",
  time = v => (v ? new Date(v).toLocaleString("ru-RU") : "—");
function line(parent, title, value) {
  const p = document.createElement("p");
  const b = document.createElement("strong");
  b.textContent = title + ": ";
  p.append(b, document.createTextNode(String(value ?? "—")));
  parent.append(p);
}
async function refresh() {
  try {
    const r = await fetch("/api/owner/order-flow", { cache: "no-store" });
    if (!r.ok)
      throw Error(
        r.status === 403
          ? "Войдите как владелец сайта."
          : "Не удалось обновить этапы"
      );
    const data = await r.json();
    const fragment = document.createDocumentFragment();
    for (const o of data.orders) {
      const card = document.createElement("article");
      card.className = "section";
      line(card, "Заказ", `#${o.id} · ${o.name} · ${o.email}`);
      line(
        card,
        "Сейчас",
        o.held
          ? "Обработка приостановлена — проверьте причину ниже"
          : o.preparation === "sent"
            ? "Итоговое письмо принято почтовым сервисом"
            : !o.accepted
              ? o.received
                ? "Средства получены — ожидается принятие"
                : "Ожидается оплата"
              : o.flow && !["accepted", "delivered"].includes(o.flow.ackState)
                ? "Отправка письма о принятии"
                : o.preparation === "needs_review"
                  ? "PDF готов — ожидается проверка владельца"
                  : o.preparation === "approved"
                    ? o.flow?.dueAt && Date.now() < Date.parse(o.flow.dueAt)
                      ? "Ожидание назначенного времени"
                      : "PDF одобрен — ожидается отправка"
                    : "Подготовка отчёта"
      );
      line(card, "Оплата", display(o.payment));
      line(
        card,
        "Средства получены",
        o.received ? "Да" : "Нет / ожидается проверка"
      );
      line(card, "Принят в работу", o.accepted ? "Да" : "Нет");
      line(card, "Выдача приостановлена", o.held ? "Да" : "Нет");
      const f = o.flow;
      if (f) {
        line(card, "Адресат первого письма", f.capturedRecipient);
        line(card, "Язык / продукт", `${f.locale} / ${f.product}`);
        line(card, "Первое письмо", display(f.ackState));
        line(card, "Заказ принят", time(f.acceptedAt));
        line(card, "Первое письмо принято сервисом", time(f.ackAcceptedAt));
        line(card, "ID первого письма", f.providerMessageId);
        line(
          card,
          "Попытки / следующий повтор",
          `${f.attempts} / ${time(f.nextAttemptAt)}`
        );
        line(card, "Ошибка первого письма", f.error);
        line(
          card,
          "Интервал",
          `${Math.floor(f.delaySeconds / 60)} мин ${f.delaySeconds % 60} с`
        );
        line(card, "Отправка не раньше", time(f.dueAt));
        line(
          card,
          "Срок наступил",
          f.dueAt && Date.now() >= Date.parse(f.dueAt)
            ? "Да; отправка требует готового и одобренного PDF"
            : "Нет"
        );
      } else line(card, "Цепочка писем", "Ожидает принятия или прежний заказ");
      line(
        card,
        "Подготовка PDF",
        ["approved", "sent"].includes(o.preparation)
          ? "Завершена"
          : display(o.preparation)
      );
      line(card, "Ошибка подготовки", o.preparationError);
      if (o.version) {
        line(
          card,
          "PDF",
          `v${o.version.number} · ID ${o.version.id} · ${display(o.version.status)}`
        );
        line(card, "SHA-256", o.version.hash);
      }
      for (const a of o.delivery)
        line(
          card,
          "Итоговое письмо",
          `${display(a.status)} → ${a.recipient} · ${time(a.completedAt)} · ID ${a.providerMessageId || "—"} · ${a.error || ""}`
        );
      const a = document.createElement("a");
      a.href = o.manual
        ? "/owner/riskpay?order=" + o.id
        : "/admin/report-studio";
      a.textContent = o.manual ? "Проверка RiskPay →" : "Проверка PDF →";
      card.append(a);
      fragment.append(card);
    }
    root.replaceChildren(fragment);
    feedback.textContent =
      "Обновлено " + new Date().toLocaleTimeString("ru-RU");
  } catch (e) {
    feedback.textContent = e.message;
  }
}
await refresh();
setInterval(refresh, 15000);
