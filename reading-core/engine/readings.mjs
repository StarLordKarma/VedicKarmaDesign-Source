import {buildVedicReading} from './vedic-adapter.ts';
import {randomInt} from 'node:crypto';
import {natal,transits,periodBounds,dateInZone} from './western.mjs';
import {drawCards} from './tarot.mjs';
import {interpretWesternV3,interpretTarotV3} from './interpretation-v3.mjs';
import {languageOf} from '../locales/language.mjs';
export const PRICES={vedic_basic:999,vedic_plus:1499,portrait:999,daily:199,monthly:499,tarot:499};
export function automaticDesign(kind){const index=randomInt(11);return{version:'automatic-background/v1',kind,background:index===0?'main':String(index).padStart(2,'0')}}
export function buildReading(input){if(!Object.hasOwn(PRICES,input.product))throw Error('Unknown product');const locale=languageOf(input.locale)||'en';if(input.product.startsWith('vedic_')){const reading=buildVedicReading({...input,locale});return{...reading,design:automaticDesign('vedic')}}if(input.product==='tarot'){const ids=drawCards();return{kind:'tarot',locale,product:'tarot',priceCents:499,design:automaticDesign('tarot'),content:interpretTarotV3(ids,locale)}}
const chart=natal(input);const date=input.product==='monthly'?(input.month+'-01'):dateInZone(input.referenceDate?new Date(input.referenceDate):new Date(),input.currentZone);const raw=periodBounds(input.product,date,input.currentZone),bounds={...raw,start:raw.start.toISOString(),end:raw.end.toISOString()};const events=transits(chart,raw);return{kind:'western',locale,product:input.product,priceCents:PRICES[input.product],chart,bounds,events,design:automaticDesign('western'),content:interpretWesternV3(chart,events,raw,input.product,locale)}}
