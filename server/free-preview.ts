import {resolve} from 'node:path';
import {searchSettlements,settlementById,settlementLabel,settlementCountries,nearbySettlements} from './settlement-directory';
import express, {type Express} from 'express';
import {z} from 'zod';
import {localToUtc, validDate, positions, natal, dateInZone} from '../reading-core/engine/western.mjs';
import {PREVIEW_COPY, PREVIEW_LANGUAGES} from '../reading-core/free-preview-copy.mjs';
// @ts-expect-error Existing shared editorial module has no declaration file.
import {KNOWLEDGE} from '../reading-core/locales/knowledge.mjs';
import {renderFreePreview} from './free-preview-page';

const locale=(s:unknown)=>typeof s==='string'&&PREVIEW_LANGUAGES.includes(s)?s:'en';
export function searchPreviewCities(query:string,lang='en',country=''){return searchSettlements(query,locale(lang),country);}
export const previewInput=z.object({locale:z.enum(['en','ru','es','de']),birthDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),birthTime:z.string().max(5).optional(),unknownTime:z.boolean(),cityId:z.number().int().positive(),disambiguation:z.enum(['reject','earlier','later']).default('reject'),consent:z.literal(true),nearby:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),country:z.string().regex(/^[A-Z]{2}$/),confirmed:z.literal(true)}).strict().optional()}).strict();
export class PreviewError extends Error{constructor(public code:string){super(code);}}
function instant(date:string,time:string,zone:string,occurrence:string){try{return localToUtc(date,time,zone,occurrence);}catch(e){const m=String(e);if(m.includes('повторялось'))throw new PreviewError('overlap');if(m.includes('не существует'))throw new PreviewError('gap');throw new PreviewError('invalid');}}
function dayEdge(date:string,zone:string,last=false){
 // Midnight can be skipped by a historical clock change. Find the first/last
 // real wall-clock minute; a whole skipped civil date is rejected.
 for(let i=0;i<24;i++){const minute=last?1439-i*60:i*60;const time=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;try{let edge=localToUtc(date,time,zone,last?'later':'earlier');if(i)for(let n=minute+(last?1:-1);n>=0&&n<1440&&Math.abs(n-minute)<60;n+=last?1:-1){try{edge=localToUtc(date,`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,zone,last?'later':'earlier');}catch{break;}}return edge;}catch{}}
 throw new PreviewError('gap');
}
export function calculatePreview(raw:unknown,now=new Date()){
 const parsed=previewInput.safeParse(raw);if(!parsed.success)throw new PreviewError('invalid');const input=parsed.data;
 try{validDate(input.birthDate);}catch{throw new PreviewError('invalid');}
 const city=settlementById(input.cityId);if(!city)throw new PreviewError('city');
 const approximation=input.nearby?nearbySettlements(input.nearby.latitude,input.nearby.longitude,input.nearby.country).find(c=>c.place.id===city.id):undefined;
 if(input.nearby&&!approximation)throw new PreviewError('nearby');
 if(input.birthDate>dateInZone(now,city.tz))throw new PreviewError('invalid');
 let signs:number[][],asc:number|null=null;
 if(input.unknownTime){
  const start=+dayEdge(input.birthDate,city.tz),end=Math.min(+dayEdge(input.birthDate,city.tz,true)+59999,+now);
  if(end<start)throw new PreviewError('invalid');
  const samples=[start,end];for(let t=start+3*3600000;t<end;t+=3*3600000)samples.push(t);
  const p=samples.map(t=>positions(new Date(t)));signs=[0,1].map(i=>Array.from(new Set(p.map(ps=>ps[i].sign))));
 }else{
  const utc=instant(input.birthDate,input.birthTime||'',city.tz,input.disambiguation);if(+utc>+now)throw new PreviewError('invalid');
  if(approximation){const p=positions(utc);signs=[[p[0].sign],[p[1].sign]];}else{const chart=natal({birthDate:input.birthDate,birthTime:input.birthTime!,birthZone:city.tz,latitude:city.lat,longitude:city.lon,disambiguation:input.disambiguation});
  signs=[[chart.planets[0].sign],[chart.planets[1].sign]];asc=chart.ascendant;}
 }
 const t=PREVIEW_COPY[input.locale],k=KNOWLEDGE[input.locale];
 const placements=[...signs,asc===null?[]:[Math.floor(asc/30)]].map((indexes,i)=>({role:t.roles[i],context:t.contexts[i],uncertain:indexes.length>1,signs:indexes.map(s=>({name:k.signs[s],title:k.styles[s][0],text:k.styles[s][1]})),note:i===2&&asc===null?(approximation?t.nearbyAsc:t.noAsc):input.unknownTime?(indexes.length>1?t.uncertain:t.stable):''}));
 return {version:'free-preview/v1',locale:input.locale,unknownTime:input.unknownTime,place:settlementLabel(city,input.locale),approximation:approximation?{distanceKm:Math.round(approximation.distanceKm*10)/10,note:t.nearbyResult}:null,system:t.system,placements,questions:t.prompts};
}

export function createPreviewLimiter(limit:number,windowMs=60000){const slots=new Map<string,{count:number;until:number}>();return (key:string,now=Date.now())=>{for(const[k,v]of Array.from(slots))if(v.until<=now)slots.delete(k);const old=slots.get(key);if(old){if(old.count>=limit)return false;old.count++;return true;}if(slots.size>=2000)return false;slots.set(key,{count:1,until:now+windowMs});return true;};}
export function registerFreePreviewRoutes(app:Express,options:{sandbox?:boolean}={}){
 const allowSearch=createPreviewLimiter(60),allowCalculate=createPreviewLimiter(10);
 app.use(['/free-reading','/api/free-preview'],(_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'});next();});
 app.get('/free-reading',(req,res)=>{const lang=locale(req.query.lang);res.set('Content-Language',lang).type('html').send(renderFreePreview(lang,options.sandbox));});
 for(const file of ['free-preview.mjs','free-preview-entry.mjs','free-preview.css','free-preview-copy.mjs'])app.get('/readings/'+file,(_req,res)=>res.sendFile(resolve('reading-core',file)));
 app.get('/api/free-preview/countries',(req,res)=>res.json({countries:settlementCountries(locale(req.query.lang))}));
 app.get('/api/free-preview/cities',(req,res)=>{if(!allowSearch(req.ip||'unknown'))return void res.status(429).set('Retry-After','60').json({error:'rate'});const country=String(req.query.country||'');if(country&&!/^[A-Z]{2}$/.test(country))return void res.status(422).json({error:'city'});res.json({cities:searchPreviewCities(String(req.query.query||''),locale(req.query.lang),country)});});
 app.post('/api/free-preview/nearby',express.json({limit:'2kb'}),(req,res)=>{if(req.headers['sec-fetch-site']==='cross-site')return void res.status(403).json({error:'invalid'});if(!allowSearch(req.ip||'unknown'))return void res.status(429).set('Retry-After','60').json({error:'rate'});const parsed=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),country:z.string().regex(/^[A-Z]{2}$/),locale:z.enum(['en','ru','es','de'])}).strict().safeParse(req.body);if(!parsed.success)return void res.status(422).json({error:'nearby'});const p=parsed.data;const t=PREVIEW_COPY[p.locale];res.json({cities:nearbySettlements(p.latitude,p.longitude,p.country).map(c=>({id:c.place.id,label:settlementLabel(c.place,p.locale)+' · '+new Intl.NumberFormat(p.locale,{maximumFractionDigits:1}).format(c.distanceKm)+' '+t.km,distanceKm:Math.round(c.distanceKm*10)/10,approximate:true}))});});
 app.post('/api/free-preview',express.json({limit:'2kb'}),(req,res)=>{
  if(req.headers['sec-fetch-site']==='cross-site')return void res.status(403).json({error:'invalid'});
  if(!allowCalculate(req.ip||'unknown'))return void res.status(429).set('Retry-After','60').json({error:'rate'});
  try{res.json(calculatePreview(req.body));}catch(e){const code=e instanceof PreviewError?e.code:'network';res.status(code==='network'?503:422).json({error:code});}
 });
}
