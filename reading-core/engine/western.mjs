import {calc_ut,constants,houses_ex2,julday} from 'sweph';
export const PLANETS=['Солнце','Луна','Меркурий','Венера','Марс','Юпитер','Сатурн','Уран','Нептун','Плутон'];
export const SIGNS=['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
export const ASPECTS=[{angle:0,name:'соединение',orb:7},{angle:60,name:'секстиль',orb:4},{angle:90,name:'квадрат',orb:6},{angle:120,name:'трин',orb:6},{angle:180,name:'оппозиция',orb:7}];
const wrap=x=>(x%360+360)%360,delta=x=>((x+540)%360)-180;
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Нужна дата ГГГГ-ММ-ДД');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s||+s.slice(0,4)<1800||+s.slice(0,4)>2399)throw Error('Некорректная дата; поддерживаются 1800–2399 годы');return d}
function parts(ms,tz){const a=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));const p=Object.fromEntries(a.map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`}
export function localToUtc(date,time,tz,disambiguation='reject'){
validDate(date);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Нужно местное время ЧЧ:ММ');
if(!['reject','earlier','later'].includes(disambiguation))throw Error('Некорректное правило повторяющегося времени');
const target=date+'T'+time+':00',naive=Date.parse(target+'Z'),offsets=new Set();
for(let h=-48;h<=48;h+=6){const probe=naive+h*3600000;offsets.add(Date.parse(parts(probe,tz)+'Z')-probe)}
const found=[...offsets].map(o=>naive-o).filter(ms=>parts(ms,tz)===target).sort((a,b)=>a-b);
if(!found.length)throw Error('Такого местного времени не существует из-за перевода часов');
if(found.length>1&&disambiguation==='reject')throw Error('Это время повторялось при переводе часов. Выберите раннее или позднее вхождение');
return new Date(disambiguation==='later'?found.at(-1):found[0]);}
export function dateInZone(instant,tz){return parts(+instant,tz).slice(0,10)}
function addDays(s,n){const d=validDate(s);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function periodBounds(type,date,tz){validDate(date);let startDate=date,endDate=addDays(date,1);if(type==='monthly'){startDate=date.slice(0,7)+'-01';const d=validDate(startDate);d.setUTCMonth(d.getUTCMonth()+1);endDate=d.toISOString().slice(0,10)}if(type==='portrait')endDate=addDays(date,30);return{start:localToUtc(startDate,'00:00',tz,'earlier'),end:localToUtc(endDate,'00:00',tz,'earlier'),startDate,endDate,timeZone:tz}}
function jd(date){return julday(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600,constants.SE_GREG_CAL)}
export function positions(instant){const t=instant instanceof Date?instant:new Date(instant);if(!Number.isFinite(+t))throw Error('Некорректный момент');const day=jd(t);return PLANETS.map((name,id)=>{const p=calc_ut(day,id,constants.SEFLG_MOSEPH|constants.SEFLG_SPEED);if(p.flag<0||!p.data||p.data.some(x=>!Number.isFinite(x)))throw Error('Ошибка эфемерид: '+p.error);if(p.flag&constants.SEFLG_SIDEREAL)throw Error('Недопустимый сидерический результат');return{id,name,longitude:wrap(p.data[0]),speed:p.data[3],retrograde:p.data[3]<0,sign:Math.floor(wrap(p.data[0])/30),degree:wrap(p.data[0])%30}})}
export function natal(input){validDate(input.birthDate);if(!Number.isFinite(input.latitude)||Math.abs(input.latitude)>90||!Number.isFinite(input.longitude)||Math.abs(input.longitude)>180)throw Error('Некорректные координаты');
const unknown=Boolean(input.unknownTime),utc=localToUtc(input.birthDate,unknown?'12:00':input.birthTime,input.birthZone,input.disambiguation||'reject');if(+utc>Date.now())throw Error('Дата рождения не может быть в будущем');
const planets=positions(utc);let houses=null,ascendant=null,houseMethod=null;const warnings=[];
if(!unknown){let h=houses_ex2(jd(utc),0,input.latitude,input.longitude,'P');houseMethod='Placidus';if(h.flag<0||!h.data){h=houses_ex2(jd(utc),0,input.latitude,input.longitude,'W');houseMethod='Whole Sign';warnings.push('Для этой широты Placidus недоступен. Использованы дома целых знаков.')}if(h.flag<0||!h.data)throw Error('Не удалось рассчитать дома');ascendant=wrap(h.data.points[0]);houses=h.data.houses.map(wrap);if(houses.length===13)houses=houses.slice(1);}
else{warnings.push('Время неизвестно: дома и асцендент исключены. Положения планет приближены к местному полудню; Луна исключена из точных толкований и транзитных целей.');const next=addDays(input.birthDate,1),a=positions(localToUtc(input.birthDate,'00:00',input.birthZone,'earlier'))[1],b=positions(localToUtc(next,'00:00',input.birthZone,'earlier'))[1];planets[1].uncertain=true;planets[1].possibleSigns=[...new Set([a.sign,b.sign])];}
const aspects=[];for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){if(unknown&&(i===1||j===1))continue;const separation=Math.abs(delta(planets[i].longitude-planets[j].longitude));for(const a of ASPECTS){const orb=Math.abs(separation-a.angle);if(orb<=a.orb)aspects.push({source:i,target:j,angle:a.angle,name:a.name,orb})}}
return{version:'western-sandbox/v1',engine:{name:'sweph',version:'2.10.3-5',zodiac:'tropical',ephemeris:'Moshier',houseMethod,interpretations:'curated-ru/v1'},utc:utc.toISOString(),unknownTime:unknown,planets,houses,ascendant,aspects,warnings};}
export function transits(chart,bounds){
const start=+bounds.start,end=+bounds.end;if(!(end>start)||end-start>32*86400000)throw Error('Период должен составлять до 32 суток');const step=2*3600000,times=[];for(let ms=start;ms<end;ms+=step)times.push(ms);times.push(end-1,end);const samples=times.map(ms=>positions(new Date(ms)));const events=[];
for(let source=0;source<10;source++)for(let target=0;target<10;target++){
if(chart.unknownTime&&target===1)continue;const natalLon=chart.planets[target].longitude;
for(const aspect of ASPECTS){const angles=aspect.angle===0||aspect.angle===180?[aspect.angle]:[aspect.angle,-aspect.angle];let exact=[];const threshold=source===1?1:1.5;let nearest=null;
for(const angle of angles){const residual=s=>delta(s[source].longitude-natalLon-angle);
for(let i=0;i<times.length;i++){const v=residual(samples[i]);if(times[i]<end&&(!nearest||Math.abs(v)<nearest.orb))nearest={ms:times[i],orb:Math.abs(v)};if(i===0)continue;const previous=residual(samples[i-1]);if(previous*v>0||Math.abs(previous-v)>90)continue;
let lo=times[i-1],hi=times[i],left=previous;for(let n=0;n<25&&hi-lo>1000;n++){const mid=(lo+hi)/2,m=delta(positions(new Date(mid))[source].longitude-natalLon-angle);if(left*m<=0)hi=mid;else{lo=mid;left=m}}
const ms=Math.round((lo+hi)/2);if(ms>=start&&ms<end&&!exact.some(x=>Math.abs(x-ms)<60000))exact.push(ms);}}
if(exact.length)for(const ms of exact)events.push({source,target,name:aspect.name,angle:aspect.angle,exact:true,at:new Date(ms).toISOString(),orb:0});else if(nearest&&nearest.orb<=threshold&&nearest.ms<end)events.push({source,target,name:aspect.name,angle:aspect.angle,exact:false,at:new Date(nearest.ms).toISOString(),orb:nearest.orb});}}
return events.sort((a,b)=>a.at.localeCompare(b.at));}
