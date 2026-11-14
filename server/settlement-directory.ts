import {createRequire} from 'node:module';
import type {DatabaseSync as SQLiteDatabase} from 'node:sqlite';
import {resolve} from 'node:path';
import {PREVIEW_COPY} from '../reading-core/free-preview-copy.mjs';
export type Settlement={id:number;name:string;ascii:string;aliases:string;country:string;region:string;district:string;lat:number;lon:number;tz:string;population:number;feature:string};
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let connection:SQLiteDatabase|undefined;
const db=()=>connection??=new DatabaseSync(resolve('server/data/geonames-settlements.sqlite'),{readOnly:true});
const marks=new RegExp('\\p{M}','gu'),wordPattern=new RegExp('[\\p{L}\\p{N}]+','gu'),queryPattern=new RegExp("^[\\p{L}\\p{N}\\s.,'’()/-]+$",'u');
const norm=(s:string)=>s.normalize('NFKD').replace(marks,'').toLowerCase().trim();
export function settlementById(id:number){return db().prepare('SELECT * FROM places WHERE id=?').get(id) as Settlement|undefined;}
export function settlementCountries(lang:string){return (db().prepare('SELECT code FROM countries ORDER BY code').all() as {code:string}[]).map(c=>({code:c.code,name:new Intl.DisplayNames([lang],{type:'region'}).of(c.code)||c.code})).sort((a,b)=>a.name.localeCompare(b.name,lang));}
export function settlementLabel(c:Settlement,lang:string){return [c.name,/^\d+$/.test(c.district)?'':c.district,/^\d+$/.test(c.region)?'':c.region,new Intl.DisplayNames([lang],{type:'region'}).of(c.country)].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ')+` · ${c.tz}`+(['PPLH','PPLQ','PPLW'].includes(c.feature)?' · '+PREVIEW_COPY[lang].historical:'');}
export function searchSettlements(query:string,lang='en',country=''){
 const q=norm(query);const words=q.match(wordPattern)||[];if(q.length<2||q.length>100||!words.length||words.length>8||!queryPattern.test(q))return [];
 const match=words.map(w=>'"'+w+'"*').join(' AND ');
 const exactRows=db().prepare(`SELECT p.* FROM place_names n JOIN places p ON p.id=n.id WHERE n.key=? ${country?'AND p.country=?':''} ORDER BY p.population DESC LIMIT 12`).all(...(country?[q,country]:[q])) as Settlement[];
 if(exactRows.length>=12)return exactRows.map(c=>({id:c.id,label:settlementLabel(c,lang)}));
 // FTS parameters are bound; punctuation can never become an FTS operator.
 const rows=db().prepare(`SELECT p.*, bm25(place_search) AS rank FROM place_search JOIN places p ON p.id=place_search.rowid WHERE place_search MATCH ? ${country?'AND p.country=?':''} ${words.some(w=>w.length>=3)?'ORDER BY place_search.rank':''} LIMIT 400`).all(...(country?[match,country]:[match])) as (Settlement&{rank:number})[];
 const exact=(c:Settlement)=>[c.name,c.ascii,...c.aliases.split(',')].some(n=>norm(n)===q);
 const seen=new Set(exactRows.map(c=>c.id));return [...exactRows,...rows.filter(c=>!seen.has(c.id)).sort((a,b)=>Number(exact(b))-Number(exact(a))||b.population-a.population||a.rank-b.rank||a.id-b.id)].slice(0,12).map(c=>({id:c.id,label:settlementLabel(c,lang)}));
}
export function distanceKm(lat:number,lon:number,c:Settlement){const rad=Math.PI/180;const x=Math.sin((c.lat-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(c.lat*rad)*Math.sin((c.lon-lon)*rad/2)**2;return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,x)));}
export function nearbySettlements(lat:number,lon:number,country:string){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!/^[A-Z]{2}$/.test(country))return [];
 const deltaLat=50/110.5,deltaLon=Math.min(180,50/(111.32*Math.max(.00001,Math.cos(lat*Math.PI/180))));
 const ranges=lon-deltaLon< -180?[[lon-deltaLon+360,180],[-180,lon+deltaLon]]:lon+deltaLon>180?[[lon-deltaLon,180],[-180,lon+deltaLon-360]]:[[lon-deltaLon,lon+deltaLon]];
 const found=new Map<number,Settlement>();
 for(const[west,east]of ranges){const rows=db().prepare("SELECT p.* FROM place_geo g JOIN places p ON p.id=g.id WHERE g.maxLat>=? AND g.minLat<=? AND g.maxLon>=? AND g.minLon<=? AND p.country=? AND p.feature NOT IN ('PPLH','PPLQ','PPLW','PPLX')").all(lat-deltaLat,lat+deltaLat,west,east,country) as Settlement[];for(const c of rows)found.set(c.id,c);}
 return Array.from(found.values()).map(c=>({place:c,distanceKm:distanceKm(lat,lon,c)})).filter(c=>c.distanceKm<=50).sort((a,b)=>a.distanceKm-b.distanceKm||b.place.population-a.place.population||a.place.id-b.place.id).slice(0,5);
}
