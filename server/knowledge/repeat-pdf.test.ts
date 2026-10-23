import {describe,it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {buildReading} from '../../reading-core/engine/readings.mjs';
import {reportPdf} from '../../reading-core/engine/pdf.mjs';
import {discloseUnchanged} from './repeat-disclosure';

describe('daily PDF with unchanged-calculation disclosure',()=>{
  it.each(['en','ru','es','de'])('retains one page in %s',async locale=>{
    const reading=buildReading({product:'daily',locale,birthDate:'1990-04-12',birthTime:'08:30',birthZone:'Europe/Berlin',latitude:52.52,longitude:13.405,currentZone:'Europe/Berlin',referenceDate:'2026-10-23T12:00:00Z'});
    reading.content=discloseUnchanged(reading.content,'daily');
    const document=await PDFDocument.load(await reportPdf(reading));
    expect(document.getPageCount()).toBe(1);
    expect(reading.content.repeatDisclosure).toBe('unchanged-calculation');
  },20000);
});
