import {it,expect}from'vitest';
import {PDFDocument}from'pdf-lib';
import {buildReading}from'../reading-core/engine/readings.mjs';
import {reportPdf}from'../reading-core/engine/pdf.mjs';
import {frozenBookingInput}from'./three-direction-reports';
const names={en:'English',ru:'Русский',es:'Español',de:'Deutsch'};
for(const language of ['en','ru','es','de'])for(const product of ['vedic_basic','vedic_plus','portrait','daily','monthly','tarot'])it(`${product}: chosen ${language} remains in order, text and PDF`,async()=>{
  const frozen=frozenBookingInput({id:1,language:names[language as keyof typeof names],priceSnapshotJson:JSON.stringify({reading:{product}})});
  const r=buildReading({product,locale:frozen.language,birthDate:'1990-04-12',birthTime:'08:30',birthZone:'Europe/Berlin',latitude:52.52,longitude:13.405,currentZone:'Europe/Berlin',month:'2026-10',referenceDate:'2026-10-23T12:00:00Z',asOf:'2026-10-23T12:00:00Z'});
  r.clientName='Maya';expect(r.locale).toBe(language);expect(r.content.language).toBe(language);
  expect(r.content.sections.every((s:any)=>s.title&&s.body)).toBe(true);
  const pdf=await PDFDocument.load(await reportPdf(r));
  expect(pdf.getPageCount()).toBeGreaterThan(0);if(product==='daily')expect(pdf.getPageCount()).toBe(1);
  if(r.kind!=='vedic')expect(pdf.getTitle()).toBe(r.content.sections[0].title);
},20000);
