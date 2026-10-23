export const READING_PRODUCTS = ['vedic_basic','vedic_plus','portrait','daily','monthly','tarot'] as const;
export type ReadingProduct = typeof READING_PRODUCTS[number];
export const PRODUCT_CENTS: Record<ReadingProduct,number> = {vedic_basic:999,vedic_plus:1499,portrait:999,daily:199,monthly:499,tarot:499};
export function readingProduct(code?:string|null):ReadingProduct { return code==='basic_plus'?'vedic_plus':READING_PRODUCTS.includes(code as ReadingProduct)?code as ReadingProduct:'vedic_basic'; }
export function specialistArea(code?:string|null){const p=readingProduct(code);return p.startsWith('vedic_')?'Vedic astrology':p==='tarot'?'Tarot':'Western astrology';}
export function readingOptions(booking:{priceSnapshotJson?:string|null}){try{return JSON.parse(booking.priceSnapshotJson||'{}').reading as {product:ReadingProduct;currentZone:string;month:string;unknownTime:boolean;disambiguation:string;referenceDate:string;automaticDelivery:true}|undefined}catch{return undefined}}
