import {beforeEach,it,expect,vi}from'vitest';
const mocks=vi.hoisted(()=>({data:new Map<string,any>(),put:vi.fn(),pdf:vi.fn(async(_reading:any)=>Buffer.from('%PDF-test'))}));
vi.mock('./knowledge/store',()=>({knowledgeStore:()=>({get:async(key:string)=>structuredClone(mocks.data.get(key)||null),put:async(key:string,value:any)=>{mocks.data.set(key,structuredClone(value));mocks.put(key)}})}));
vi.mock('./storage',()=>({storagePut:async(key:string)=>({key,url:'/private/'+key})}));
vi.mock('./report-geocoding',()=>({resolveBirthLocation:async()=>({timezone:'Europe/Berlin',latitude:52.52,longitude:13.405})}));
vi.mock('./_core/notification',()=>({notifyOwner:vi.fn()}));
vi.mock('../reading-core/engine/pdf.mjs',()=>({reportPdf:mocks.pdf}));
import {processThreeDirectionReport,assertThreeDirectionQuality}from'./three-direction-reports';
const languages={en:'English',ru:'Русский',es:'Español',de:'Deutsch'};
beforeEach(()=>{mocks.data.clear();mocks.put.mockClear();mocks.pdf.mockClear()});
function database(){const rows:any[]=[];return{rows,insert:()=>({values:(v:any)=>{rows.push(v);return{onDuplicateKeyUpdate:async()=>undefined,then:(resolve:any)=>resolve(undefined)}}}),update:()=>({set:()=>({where:async()=>undefined})}),select:()=>({from:()=>({innerJoin:()=>({innerJoin:()=>({where:()=>({orderBy:()=>({limit:async()=>[]})})})})})})}}
for(const locale of ['en','ru','es','de'] as const)it(`paid ${locale} jobs preserve language in all directions and reuse stored calculations`,async()=>{
  for(const [index,product]of ['vedic_basic','vedic_plus','portrait','daily','monthly','tarot'].entries()){
    const db=database(),b={id:index+1,name:'Maya',email:'test@example.com',language:languages[locale],birthDate:'1990-04-12',birthTime:'08:30',birthCity:'Berlin',birthCountry:'Germany',priceSnapshotJson:JSON.stringify({reading:{product,currentZone:'Europe/Berlin',month:'2026-10',unknownTime:false,referenceDate:'2026-10-23T12:00:00Z'}})},job={id:index+1,language:locale};
    await processThreeDirectionReport(db,b,job);const meta=JSON.parse(db.rows.find(r=>r.factsJson).factsJson);
    expect((await assertThreeDirectionQuality(meta,locale)).content.language).toBe(locale);
    await expect(assertThreeDirectionQuality(meta,locale==='ru'?'en':'ru')).rejects.toThrow();
    const stored=structuredClone(mocks.data.get(meta.stateKey));await processThreeDirectionReport(database(),b,job);expect(mocks.data.get(meta.stateKey)).toEqual(stored);
    expect(mocks.pdf.mock.calls.at(-1)?.[0]?.locale).toBe(locale);
  }
});
