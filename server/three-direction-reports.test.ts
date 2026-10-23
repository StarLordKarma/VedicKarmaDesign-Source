import {beforeEach,it,expect,vi}from'vitest';
const mocks=vi.hoisted(()=>({data:new Map<string,any>(),put:vi.fn(),pdf:vi.fn(async(_reading:any)=>Buffer.from('%PDF-test'))}));
vi.mock('./knowledge/store',()=>({knowledgeStore:()=>({get:async(key:string)=>structuredClone(mocks.data.get(key)||null),put:async(key:string,value:any)=>{mocks.data.set(key,structuredClone(value));mocks.put(key)}})}));
vi.mock('./storage',()=>({storagePut:async(key:string)=>({key,url:'/private/'+key})}));
vi.mock('./report-geocoding',()=>({resolveBirthLocation:async()=>({timezone:'Europe/Berlin',latitude:52.52,longitude:13.405})}));
vi.mock('./_core/notification',()=>({notifyOwner:vi.fn()}));
vi.mock('../reading-core/engine/pdf.mjs',()=>({reportPdf:mocks.pdf}));
vi.mock('./report-renderer',async()=>{const {buildReading}=await import('../reading-core/engine/readings.mjs');return{buildReadingOffThread:async(input:any)=>buildReading(input),renderReadingOffThread:mocks.pdf}});
import {processThreeDirectionReport,assertThreeDirectionQuality}from'./three-direction-reports';
const languages={en:'English',ru:'Русский',es:'Español',de:'Deutsch'};
beforeEach(()=>{mocks.data.clear();mocks.put.mockClear();mocks.pdf.mockClear()});
function database(){const rows:any[]=[];const db:any={rows,insert:()=>({values:(v:any)=>{rows.push(v);return{onDuplicateKeyUpdate:async()=>undefined,then:(resolve:any)=>resolve(undefined)}}}),update:()=>({set:()=>({where:async()=>undefined})}),select:()=>({from:()=>({innerJoin:()=>({innerJoin:()=>({where:()=>({orderBy:()=>({limit:async()=>[]})})})})})})};db.transaction=async(fn:any)=>fn(db);return db}
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

it('rolls back a partially published PDF and reuses the same saved reading on retry',async()=>{
 const db=database(),booking={id:99,name:'Test',email:'test@example.com',language:'English',priceSnapshotJson:JSON.stringify({reading:{product:'tarot',currentZone:'UTC',month:'2026-10',referenceDate:'2026-10-23T12:00:00Z'}})},job={id:99,language:'en'};
 db.transaction=async(fn:any)=>{const before=db.rows.length;try{return await fn({...db,update:()=>({set:()=>({where:async()=>{throw Error('DB interrupted before commit')}})})})}catch(e){db.rows.length=before;throw e}};
 await expect(processThreeDirectionReport(db,booking,job)).rejects.toThrow('interrupted');expect(db.rows.some((r:any)=>r.pdfStorageKey)).toBe(false);
 const saved=structuredClone(mocks.data.get('reading-state/order-99/report-99.json'));
 await processThreeDirectionReport(database(),booking,job);expect(mocks.data.get('reading-state/order-99/report-99.json')).toEqual(saved);
});

it('renders edited Vedic paragraphs instead of the stale original narrative',async()=>{
 const{reviseThreeDirectionReport}=await import('./three-direction-reports');const db=database();db.update=()=>({set:()=>({where:async()=>[{affectedRows:1}]})});
 const stateKey='reading-state/edited-vedic.json',sections=[{title:'Theme',body:'A calm conversation can clarify your priorities.',paragraphs:['A calm conversation can clarify your priorities.']}];
 mocks.data.set(stateKey,{kind:'vedic',locale:'en',content:{language:'en',sections},narrative:{sections},facts:{},needsWordingReview:true});
 await reviseThreeDirectionReport(db,{job:{id:1,status:'needs_review'},booking:{id:1,email:'test@example.com',language:'English',packageCode:'basic'},versions:[{id:1,versionNumber:1,status:'needs_review'}],calculation:{factsJson:JSON.stringify({stateKey})}},{actorId:'owner',baseVersionId:1,narrativeJson:JSON.stringify({locale:'en',sections:[{paragraphs:['Clarify your priorities through a calm conversation.']}]})});
 expect(mocks.pdf.mock.calls.at(-1)?.[0].narrative.sections[0].paragraphs[0]).toBe('Clarify your priorities through a calm conversation.');
});
