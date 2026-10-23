export const REPEAT_NOTICE = {
  en: {title: 'Why this report resembles your earlier report', body: 'This report is largely similar to your previous order: the input details and calculated indicators have not materially changed since that order. The main interpretations therefore remain relevant. This describes the calculation, not a claim that nothing in your life has changed.'},
  ru: {title: 'Почему этот отчёт похож на предыдущий', body: 'Этот отчёт во многом совпадает с предыдущим: исходные данные и расчётные показатели с момента прошлого заказа практически не изменились. Поэтому основные толкования сохраняются. Это относится к расчёту и не означает, что в вашей жизни ничего не изменилось.'},
  es: {title: 'Por qué este informe se parece al anterior', body: 'Este informe coincide en gran parte con tu pedido anterior: los datos de entrada y los indicadores calculados no han cambiado de forma significativa. Por eso se mantienen las interpretaciones principales. Esto se refiere al cálculo y no significa que nada haya cambiado en tu vida.'},
  de: {title: 'Warum dieser Bericht dem vorherigen ähnelt', body: 'Dieser Bericht stimmt weitgehend mit Ihrer vorherigen Bestellung überein: Eingaben und berechnete Merkmale haben sich seither nicht wesentlich verändert. Daher bleiben die wesentlichen Deutungen bestehen. Das betrifft die Berechnung und bedeutet nicht, dass sich in Ihrem Leben nichts verändert hat.'},
};

// History is ordered newest first. An older match cannot justify a claim about
// the customer's immediately preceding report.
export function canDiscloseUnchanged(prior: {calculationFingerprint?: string}[], fingerprint: string) {
  return Boolean(prior[0]?.calculationFingerprint && prior[0].calculationFingerprint === fingerprint);
}

export function discloseUnchanged(content: any, product: string) {
  const result = structuredClone(content);
  if (result.repeatDisclosure === 'unchanged-calculation') return result;
  const notice = REPEAT_NOTICE[content.language as keyof typeof REPEAT_NOTICE] || REPEAT_NOTICE.en;
  if (product === 'daily') {
    result.sections[0].body += ' ' + notice.body;
    result.sections[0].paragraphs = [result.sections[0].body];
  } else {
    result.sections.splice(1, 0, {title: notice.title, body: notice.body, paragraphs: [notice.body]});
  }
  result.repeatDisclosure = 'unchanged-calculation';
  return result;
}
