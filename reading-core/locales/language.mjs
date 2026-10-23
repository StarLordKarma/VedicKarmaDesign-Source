export const LANGUAGES=['en','ru','es','de'];
export function languageOf(value){const v=String(value||'').toLowerCase().split('-')[0];return LANGUAGES.includes(v)?v:null}
export function browserLanguage(header=''){const list=String(header).split(',').map((v,index)=>{const[tag,...params]=v.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return{tag,q:q?Number(q.trim().slice(2)):1,index}}).filter(v=>Number.isFinite(v.q)&&v.q>0).sort((a,b)=>b.q-a.q||a.index-b.index);return languageOf(list[0]?.tag)||'en'}
export function resolveLanguage(explicit,header){return languageOf(explicit)||browserLanguage(header)}
