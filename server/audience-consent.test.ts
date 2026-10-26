import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {it,expect,vi} from 'vitest';
it('collects nothing before consent and stops after withdrawal, without sending form contents',async()=>{
 const dom=new JSDOM('<html lang="ru"><body data-mode="western"><footer></footer><form id="order-form" data-product="daily"><input name="email" value="private@example.org"><button type="button" data-product="daily">Open</button></form></body></html>',{url:'https://karmalifedesign.com/?utm_source=instagram&utm_medium=social&utm_campaign=october',runScripts:'outside-only'});
 const w=dom.window as any;w.Blob=globalThis.Blob;const beacon=vi.fn((_url:string,_body:Blob)=>true);w.navigator.sendBeacon=beacon;
 const script=readFileSync('reading-core/audience.mjs','utf8').replace(/^export /gm,'');w.eval(script+'\ninitAudience();');
 expect(beacon).not.toHaveBeenCalled();expect(w.localStorage.getItem('audience-ids-v1')).toBeNull();
 w.document.querySelector('[data-decline]').click();w.document.querySelector('[data-product]').click();expect(beacon).not.toHaveBeenCalled();
 w.document.querySelector('footer button').click();w.document.querySelector('[data-allow]').click();expect(beacon).toHaveBeenCalledTimes(2);expect(w.localStorage.getItem('audience-ids-v1')).not.toBeNull();
 w.document.querySelector('[data-product]').click();expect(beacon).toHaveBeenCalledTimes(3);
 const payload=JSON.parse(await beacon.mock.calls[2][1].text());expect(payload).toMatchObject({consent:true,event:'form_open',product:'daily',source:'instagram',campaign:'october'});expect(JSON.stringify(payload)).not.toContain('private@example.org');
 w.document.querySelector('footer button').click();w.document.querySelector('[data-decline]').click();expect(w.localStorage.getItem('audience-ids-v1')).toBeNull();w.document.querySelector('[data-product]').click();expect(beacon).toHaveBeenCalledTimes(3);dom.window.close();
});
