import {calculateVedicSnapshot} from '../../server/vedic-astrology-calculator';
import {buildCuratedNarrative} from '../../server/report-narrative-curated';
import {buildFullNatalReportPdf} from '../../server/export';
import {localToUtc} from './western.mjs';
import {EDITORIAL} from '../locales/editorial.mjs';
import {VEDIC_EDITORIAL} from '../locales/vedic-editorial.mjs';
import {KNOWLEDGE} from '../locales/knowledge.mjs';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
type Locale='en'|'ru'|'es'|'de';
export function buildVedicReading(input:any){const locale:Locale=['en','ru','es','de'].includes(input.locale)?input.locale:'en';if(input.unknownTime)throw Error('Vedic reading requires the birth time');const utc=localToUtc(input.birthDate,input.birthTime,input.birthZone,input.disambiguation||'reject');const naive=Date.parse(input.birthDate+'T'+input.birthTime+':00Z');const offset=(naive-+utc)/60000;const facts=calculateVedicSnapshot({localDate:input.birthDate,localTime:input.birthTime,timeZoneOffsetMinutes:offset,latitude:input.latitude,longitude:input.longitude});const narrative=buildCuratedNarrative(facts,locale);const k=KNOWLEDGE[locale];
const ed=EDITORIAL[locale],v=VEDIC_EDITORIAL[locale],names=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
const paragraph=(name:string)=>{const p=facts.planets.find(p=>p.planet===name),id=names.indexOf(name);return `${k.planets[id]}: ${k.signs[p.sign]}. ${k.styles[p.sign][1]} ${ed.planet[id][1]}`};
const asc=facts.ascendant.sign,moon=facts.planets.find(p=>p.planet==='Moon')!;
const at=input.asOf?new Date(input.asOf):new Date(),periods=facts.vimshottari.periods,currentIndex=periods.findIndex(p=>+new Date(p.startUtc)<=+at&&+at<+new Date(p.endUtc));
const periodText=(p:any)=>{const id=names.indexOf(p.lord),label=id>=0?k.planets[id]:p.lord==='Rahu'?({en:'Rahu',ru:'Раху',es:'Rahu',de:'Rahu'})[locale]:({en:'Ketu',ru:'Кету',es:'Ketu',de:'Ketu'})[locale];const fmt=(x:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(x));return `${label}: ${fmt(p.startUtc)} — ${fmt(p.endUtc)}. `+(id>=0?ed.planet[id][1]+' '+k.actions[id]:v.node[p.lord==='Rahu'?0:1])};
const selections=[
[v.plain[0],`${k.labels.asc}: ${k.signs[asc]}. ${k.styles[asc][1]}`,ed.sign[asc][0],paragraph('Sun'),ed.sign[asc][2]],
[paragraph('Mercury'),ed.planet[2][2],k.actions[2],ed.sign[facts.planets.find(p=>p.planet==='Mercury')!.sign][0]],
[paragraph('Venus'),paragraph('Moon'),ed.labels[4]+': '+ed.house[6][0],ed.planet[3][2],k.actions[3]],
[v.plain[1],v.nakshatra[moon.nakshatra],ed.planet[1][1],ed.planet[1][2]],
[v.plain[2],v.plain[3],currentIndex>=0?periodText(periods[currentIndex]):v.plain[4],...(currentIndex>=0&&periods[currentIndex+1]?[periodText(periods[currentIndex+1])]:[])],
[ed.labels[3]+': '+ed.house[1][0],ed.labels[4]+': '+ed.house[3][0],ed.labels[5]+': '+ed.house[5][0],k.labels.dayAction]
];
const seen=new Set<string>();for(let i=0;i<narrative.sections.length;i++){narrative.sections[i].title=v.titles[i];narrative.sections[i].paragraphs=selections[i].filter(p=>{if(seen.has(p))return false;seen.add(p);return true})}
if(currentIndex>=0)narrative.sections[4].factRefs=[`vimshottari.periods[${currentIndex}].startUtc`];
return{kind:'vedic',locale,product:input.product,priceCents:input.product==='vedic_plus'?1499:999,facts,narrative,content:{version:'vedic-local-expanded/v4',language:locale,sections:narrative.sections.map(s=>({title:s.title,body:s.paragraphs.join('\n\n'),paragraphs:s.paragraphs})),disclaimer:k.labels.disclaimer}}}
export function buildVedicPdf(reading:any){const root=resolve('reading-core'),id=reading.design?.background||'main',path=id==='main'?resolve(root,'assets/vedic-main.jpg'):resolve(root,'assets/pdf/vedic-'+id+'.jpg');if(!/^(main|0[1-9]|10)$/.test(id))throw Error('Invalid design');const locale=reading.locale as Locale;return buildFullNatalReportPdf({background:readFileSync(path),locale,clientName:reading.clientName||'Alex Morgan',birthPlace:reading.birthPlace||({en:'Invented birth details',ru:'Вымышленные данные рождения',es:'Datos de nacimiento inventados',de:'Erfundene Geburtsdaten'})[locale],sampleLabel:reading.sample?KNOWLEDGE[locale].labels.fictional:undefined,packageType:reading.product==='vedic_plus'?'basic_plus':'basic',facts:reading.facts,narrative:reading.narrative})}
