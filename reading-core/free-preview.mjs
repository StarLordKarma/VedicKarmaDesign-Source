import {initAudience,trackAudience} from './audience.mjs';
import {PREVIEW_COPY} from './free-preview-copy.mjs';
const lang=document.documentElement.lang,t=PREVIEW_COPY[lang],$=s=>document.querySelector(s),form=$('#preview-form');
const trackPreview=event=>trackAudience(event,'portrait','western');
initAudience({pageEvent:'free_preview_view'});
for(const [id,event] of [['#preview-sample','free_sample_open'],['#preview-paid','free_product_open']])$(id).addEventListener('click',()=>trackPreview(event));
// Campaign tags may travel between pages. Birth details and results never do.
const campaign=new URL(location.href).searchParams;
for(const a of document.querySelectorAll('[data-locale], [data-back], #preview-paid')){const u=new URL(a.href);for(const k of ['utm_source','utm_medium','utm_campaign']){const v=campaign.get(k);if(v&&/^[a-z0-9_.-]{1,64}$/i.test(v))u.searchParams.set(k,v);}a.href=u.href;}
const local=new Date();$('#preview-date').max=`${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
let searchSerial=0,requestSerial=0,nearbyOrigin=null;
function status(message,error=false){const s=$('#preview-status');s.textContent=message;s.setAttribute('role',error?'alert':'status');}
form.addEventListener('input',()=>{requestSerial++;$('#preview-submit').disabled=false;status('');});
function resetOccurrence(){$('#preview-occurrence').value='reject';$('#preview-occurrence-group').hidden=true;}
function emptyCities(){searchSerial++;nearbyOrigin=null;$('#preview-nearby-confirmation').hidden=true;$('#preview-nearby-consent').required=false;$('#preview-nearby-consent').checked=false;$('#preview-city-choice').replaceChildren(new Option('—',''));$('#preview-city-status').textContent='';resetOccurrence();}
$('#preview-city').addEventListener('input',emptyCities);
$('#preview-country').addEventListener('change',emptyCities);
for(const id of ['#preview-latitude','#preview-longitude'])$(id).addEventListener('input',emptyCities);
$('#preview-city-choice').addEventListener('change',()=>{$('#preview-nearby-consent').checked=false;const s=$('#preview-city-choice');$('#preview-city-status').textContent=s.value?s.selectedOptions[0].textContent:'';});
$('#preview-unknown').onchange=()=>{const unknown=$('#preview-unknown').checked;$('#preview-time').disabled=unknown;$('#preview-time').required=!unknown;$('#preview-occurrence').disabled=unknown;resetOccurrence();};
for(const id of ['#preview-date','#preview-time','#preview-city-choice'])$(id).addEventListener('change',resetOccurrence);
$('#preview-city').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#preview-search').click();}};
$('#preview-search').onclick=async()=>{
 const query=$('#preview-city').value.trim();if(query.length<2){$('#preview-city').focus();return;}
 emptyCities();const token=searchSerial;$('#preview-search').disabled=true;
 try{const response=await fetch('/api/free-preview/cities?'+new URLSearchParams({query,lang,country:$('#preview-country').value}),{cache:'no-store'});const result=await response.json();if(token!==searchSerial)return;if(!response.ok)throw Error(result.error||'network');const select=$('#preview-city-choice');for(const city of result.cities)select.add(new Option(city.label,String(city.id)));$('#preview-city-status').textContent=result.cities.length?'':t.errors.empty;if(!result.cities.length)$('#preview-nearby').open=true;select.focus();}
 catch(e){if(token===searchSerial)$('#preview-city-status').textContent=t.errors[e.message]||t.errors.network;}
 finally{$('#preview-search').disabled=false;}
};
$('#preview-find-nearby').onclick=async()=>{
 const a=$('#preview-latitude'),b=$('#preview-longitude'),country=$('#preview-country').value;
 if(!a.value.trim()||!b.value.trim()||!a.checkValidity()||!b.checkValidity()||!country){status(t.errors.nearby,true);return;}
 const point={latitude:Number(a.value),longitude:Number(b.value),country};emptyCities();const token=searchSerial;$('#preview-find-nearby').disabled=true;
 try{const response=await fetch('/api/free-preview/nearby',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...point,locale:lang})});const result=await response.json();if(token!==searchSerial)return;if(!response.ok)throw Error(result.error||'network');const select=$('#preview-city-choice');for(const c of result.cities)select.add(new Option(c.label,String(c.id)));nearbyOrigin=result.cities.length?point:null;$('#preview-nearby-confirmation').hidden=!nearbyOrigin;$('#preview-nearby-consent').required=!!nearbyOrigin;$('#preview-city-status').textContent=nearbyOrigin?t.nearbyPending:t.nearbyEmpty;select.focus();status('');}
 catch(e){if(token===searchSerial)status(t.errors[e.message]||t.errors.network,true);}
 finally{$('#preview-find-nearby').disabled=false;}
};
function text(parent,tag,value,cls){const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;parent.append(node);return node;}
function show(result){const cards=$('#preview-placements');cards.replaceChildren();result.placements.forEach((p,i)=>{const card=document.createElement('article');card.className='preview-card';text(card,'span',['☉','☽','↑'][i],'preview-glyph').setAttribute('aria-hidden','true');text(card,'h3',p.role);text(card,'p',p.context);for(const sign of p.signs){text(card,'h4',sign.name);text(card,'p',sign.text);}if(p.note)text(card,'p',p.note,'preview-note');cards.append(card);});$('#preview-place-label').textContent=t.selected+': '+result.place;const approximation=$('#preview-approximation');approximation.hidden=!result.approximation;approximation.textContent=result.approximation?result.approximation.note+' '+t.distance+': '+new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(result.approximation.distanceKm)+' '+t.km:'';form.hidden=true;$('#preview-result').hidden=false;$('#preview-result-title').focus();$('#preview-result').scrollIntoView({block:'start'});}
form.onsubmit=async e=>{
 e.preventDefault();if(!form.reportValidity())return;const token=++requestSerial;const button=$('#preview-submit');button.disabled=true;status(t.working);trackPreview('free_preview_start');
 const payload={locale:lang,birthDate:$('#preview-date').value,birthTime:$('#preview-unknown').checked?undefined:$('#preview-time').value,unknownTime:$('#preview-unknown').checked,cityId:Number($('#preview-city-choice').value),disambiguation:$('#preview-occurrence').value,consent:$('#preview-consent').checked,...(nearbyOrigin?{nearby:{...nearbyOrigin,confirmed:$('#preview-nearby-consent').checked}}:{})};
 try{const response=await fetch('/api/free-preview',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(payload)});const result=await response.json();if(token!==requestSerial)return;if(!response.ok)throw Error(result.error||'network');status('');show(result);trackPreview('free_preview_complete');}
 catch(e){if(token===requestSerial){status(t.errors[e.message]||t.errors.network,true);if(e.message==='overlap'){$('#preview-occurrence-group').hidden=false;$('#preview-occurrence').focus();}}}
 finally{if(token===requestSerial)button.disabled=false;}
};
$('#preview-edit').onclick=()=>{requestSerial++;$('#preview-submit').disabled=false;$('#preview-result').hidden=true;$('#preview-placements').replaceChildren();$('#preview-place-label').textContent='';form.hidden=false;$('#preview-date').focus();};
$('#preview-clear').onclick=()=>{requestSerial++;emptyCities();form.reset();form.hidden=false;$('#preview-nearby').open=false;$('#preview-time').disabled=false;$('#preview-time').required=true;$('#preview-occurrence').disabled=false;$('#preview-submit').disabled=false;$('#preview-result').hidden=true;$('#preview-placements').replaceChildren();$('#preview-place-label').textContent='';$('#preview-approximation').textContent='';$('#preview-approximation').hidden=true;status('');$('#preview-date').focus();};
