import {createHmac} from 'node:crypto';
import type {Express} from 'express';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from './db';
import {audienceEvents} from '../drizzle/schema';
import {createRateLimit} from './observability';
import {adminProcedure,router} from './_core/trpc';
import {TRPCError} from '@trpc/server';

export const audienceEventSchema=z.object({consent:z.literal(true),eventId:z.string().uuid(),visitor:z.string().uuid(),session:z.string().uuid(),event:z.enum(['page_view','section_view','form_open','form_submit','checkout_open','form_error','sample_open','guide_open']),section:z.enum(['vedic','western','tarot']),product:z.enum(['none','vedic_basic','vedic_plus','portrait','daily','monthly','tarot']),locale:z.enum(['en','ru','es','de']),device:z.enum(['mobile','desktop']),source:z.string().max(64).regex(/^[a-z0-9_.-]*$/),medium:z.string().max(64).regex(/^[a-z0-9_.-]*$/),campaign:z.string().max(64).regex(/^[a-z0-9_.-]*$/)}).strict();
export function audienceHash(value:string){const key=process.env.ORDER_SIGNING_SECRET;if(!key&&process.env.NODE_ENV==='production')throw Error('Analytics key unavailable');return createHmac('sha256',key||'local-analytics').update(value).digest('hex')}
export function bookingAudience(input:{source:string;medium:string;campaign:string;visitor:string;session:string}|undefined){if(!input)return undefined;try{return{source:input.source,medium:input.medium,campaign:input.campaign,visitorKey:audienceHash(input.visitor),sessionKey:audienceHash(input.session)}}catch{return undefined}}
let collecting=0,nextCleanup=0;
export function registerAudienceCollection(app:Express){
 app.post('/api/audience',createRateLimit({name:'audience',windowMs:60000,max:60}),async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(/bot|crawler|spider|headless|lighthouse|playwright|monitor/i.test(req.headers['user-agent']||'')){res.status(204).end();return}
  const parsed=audienceEventSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'invalid_event'});return}
  if(collecting>=8){res.status(429).end();return}collecting++;
  try{const db=await getDb();if(!db)throw Error('Unavailable');const{consent,visitor,session,...data}=parsed.data;
   await db.insert(audienceEvents).values({...data,visitorKey:audienceHash(visitor),sessionKey:audienceHash(session)}).onDuplicateKeyUpdate({set:{eventId:data.eventId}});
   if(Date.now()>nextCleanup){nextCleanup=Date.now()+3600000;void db.execute(sql`DELETE FROM audience_events WHERE createdAt < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 90 DAY) LIMIT 10000`).catch(()=>{nextCleanup=0})}
   res.status(204).end();
  }catch{res.status(503).json({error:'analytics_unavailable'})}finally{collecting--}
 });
}

export const controlRoomFilters=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),section:z.enum(['all','vedic','western','tarot']).default('all'),locale:z.enum(['all','en','ru','es','de']).default('all')}).refine(v=>{const a=Date.parse(v.from+'T00:00:00Z'),b=Date.parse(v.to+'T00:00:00Z');return Number.isFinite(a)&&Number.isFinite(b)&&new Date(a).toISOString().slice(0,10)===v.from&&new Date(b).toISOString().slice(0,10)===v.to&&b>=a&&b-a<90*86400000},{message:'Choose a valid range of up to 90 days.'});
type Filters=z.infer<typeof controlRoomFilters>;
export async function controlRoomSummary(input:Filters){
 const db=await getDb();if(!db)throw new TRPCError({code:'SERVICE_UNAVAILABLE',message:'Database unavailable'});
 const from=input.from+' 00:00:00',until=new Date(Date.parse(input.to+'T00:00:00Z')+86400000).toISOString().slice(0,10)+' 00:00:00';
 const product=sql`CASE WHEN b.packageCode='tarot' THEN 'tarot' WHEN b.packageCode IN ('portrait','daily','monthly') THEN 'western' ELSE 'vedic' END`;
 const locale=sql`CASE b.language WHEN 'Русский' THEN 'ru' WHEN 'Deutsch' THEN 'de' WHEN 'Español' THEN 'es' ELSE 'en' END`;
 const bookingFilter=sql`(${input.section}='all' OR ${product}=${input.section}) AND (${input.locale}='all' OR ${locale}=${input.locale}) AND NOT EXISTS(SELECT 1 FROM report_jobs tj WHERE tj.bookingId=b.id AND tj.testJob=1) AND LOWER(b.email) NOT REGEXP '(@example[.](com|org|net)$|@sandbox[.]invalid$|@resend[.]dev$|@test[.]com$)'`;
 const eventFilter=sql`createdAt >= ${from} AND createdAt < ${until} AND (${input.section}='all' OR section=${input.section}) AND (${input.locale}='all' OR locale=${input.locale})`;
 const rows=async(q:ReturnType<typeof sql>)=>{const r=await db.execute(q);return r[0] as unknown as Record<string,any>[]};
 // Order cohorts and event-time operations are deliberately separate measures.
 const [orders,dailyOrders,products,archiveOrders,jobs,pdfs,mail,receipts,refunds,jobCounts,pdfCounts,mailCounts,backlog,legacy,currencies,campaignOrders,legacyPdfCount,legacySent,receiptArchive,legacySentCount]=await Promise.all([
  rows(sql`SELECT COUNT(*) AS orders,COALESCE(SUM(b.paymentStatus IN ('paid','confirmed','finished')),0) AS paid,COALESCE(SUM(CASE WHEN b.paymentStatus IN ('paid','confirmed','finished') AND b.currency='USD' THEN b.totalUsd ELSE 0 END),0) AS grossUsd,COALESCE(SUM(b.status='completed'),0) AS completed,COALESCE(SUM(b.paymentStatus IN ('failed','expired') OR b.status='cancelled'),0) AS failed,COALESCE(SUM(b.paymentStatus NOT IN ('paid','confirmed','finished','failed','expired') AND b.status!='cancelled'),0) AS waiting FROM booking_requests b WHERE b.createdAt>=${from} AND b.createdAt<${until} AND ${bookingFilter}`),
  rows(sql`SELECT DATE_FORMAT(b.createdAt,'%Y-%m-%d') AS day,COUNT(*) AS orders,SUM(b.paymentStatus IN ('paid','confirmed','finished')) AS paid FROM booking_requests b WHERE b.createdAt>=${from} AND b.createdAt<${until} AND ${bookingFilter} GROUP BY day ORDER BY day`),
  rows(sql`SELECT ${product} AS section,COUNT(*) AS orders,SUM(b.paymentStatus IN ('paid','confirmed','finished')) AS paid FROM booking_requests b WHERE b.createdAt>=${from} AND b.createdAt<${until} AND ${bookingFilter} GROUP BY section`),
  rows(sql`SELECT b.id,b.createdAt AS at,b.packageCode AS product,${locale} AS locale,b.paymentStatus AS payment,b.status,b.deliveryStatus AS delivery,b.totalUsd AS amount FROM booking_requests b WHERE b.createdAt>=${from} AND b.createdAt<${until} AND ${bookingFilter} ORDER BY b.id DESC LIMIT 50`),
  rows(sql`SELECT j.id,j.bookingId,j.createdAt AS at,j.status,j.lastErrorCode AS code,j.language AS locale FROM report_jobs j JOIN booking_requests b ON b.id=j.bookingId WHERE j.createdAt>=${from} AND j.createdAt<${until} AND j.testJob=0 AND ${bookingFilter} ORDER BY j.id DESC LIMIT 200`),
  rows(sql`SELECT v.id,j.bookingId,v.createdAt AS at,v.status,v.locale,v.versionNumber FROM report_versions v JOIN report_jobs j ON j.id=v.reportJobId JOIN booking_requests b ON b.id=j.bookingId WHERE v.createdAt>=${from} AND v.createdAt<${until} AND j.testJob=0 AND v.pdfStorageKey IS NOT NULL AND ${bookingFilter} ORDER BY v.id DESC LIMIT 200`),
  rows(sql`SELECT d.id,j.bookingId,d.requestedAt AS at,d.status,d.errorCode AS code FROM report_delivery_attempts d JOIN report_versions v ON v.id=d.reportVersionId JOIN report_jobs j ON j.id=v.reportJobId JOIN booking_requests b ON b.id=j.bookingId WHERE d.requestedAt>=${from} AND d.requestedAt<${until} AND j.testJob=0 AND ${bookingFilter} ORDER BY d.id DESC LIMIT 200`),
  rows(sql`SELECT status,COUNT(*) AS count FROM receipt_email_attempts WHERE requestedAt>=${from} AND requestedAt<${until} AND LOWER(recipientEmail) NOT REGEXP '(@example[.](com|org|net)$|@sandbox[.]invalid$|@resend[.]dev$|@test[.]com$)' GROUP BY status`),
  rows(sql`SELECT r.status,COUNT(*) AS count FROM payment_refunds r JOIN booking_requests b ON b.id=r.bookingId WHERE r.createdAt>=${from} AND r.createdAt<${until} AND ${bookingFilter} GROUP BY r.status`),
  rows(sql`SELECT j.status,COUNT(*) AS count FROM report_jobs j JOIN booking_requests b ON b.id=j.bookingId WHERE j.createdAt>=${from} AND j.createdAt<${until} AND j.testJob=0 AND ${bookingFilter} GROUP BY j.status`),
  rows(sql`SELECT v.status,COUNT(*) AS count FROM report_versions v JOIN report_jobs j ON j.id=v.reportJobId JOIN booking_requests b ON b.id=j.bookingId WHERE v.createdAt>=${from} AND v.createdAt<${until} AND j.testJob=0 AND v.pdfStorageKey IS NOT NULL AND ${bookingFilter} GROUP BY v.status`),
  rows(sql`SELECT d.status,COUNT(*) AS count FROM report_delivery_attempts d JOIN report_versions v ON v.id=d.reportVersionId JOIN report_jobs j ON j.id=v.reportJobId JOIN booking_requests b ON b.id=j.bookingId WHERE d.requestedAt>=${from} AND d.requestedAt<${until} AND j.testJob=0 AND ${bookingFilter} GROUP BY d.status`),
  rows(sql`SELECT j.status,COUNT(*) AS count,MIN(j.createdAt) AS oldest FROM report_jobs j JOIN booking_requests b ON b.id=j.bookingId WHERE j.testJob=0 AND j.status NOT IN ('sent','rejected','waiting_payment') AND ${bookingFilter} GROUP BY j.status`),
  rows(sql`SELECT b.id AS bookingId,b.natalPdfUploadedAt AS at,b.deliveryStatus AS status FROM booking_requests b WHERE b.natalPdfKey IS NOT NULL AND b.natalPdfUploadedAt>=${from} AND b.natalPdfUploadedAt<${until} AND NOT EXISTS(SELECT 1 FROM report_jobs j WHERE j.bookingId=b.id) AND ${bookingFilter} ORDER BY b.natalPdfUploadedAt DESC LIMIT 200`),
  rows(sql`SELECT b.currency,SUM(b.totalUsd) AS amount,COUNT(*) AS paid FROM booking_requests b WHERE b.createdAt>=${from} AND b.createdAt<${until} AND b.paymentStatus IN ('paid','confirmed','finished') AND ${bookingFilter} GROUP BY b.currency`),
  rows(sql`SELECT COALESCE(CASE WHEN JSON_VALID(b.priceSnapshotJson) THEN JSON_UNQUOTE(JSON_EXTRACT(b.priceSnapshotJson,'$.audience.source')) END,'unattributed') AS source,COALESCE(CASE WHEN JSON_VALID(b.priceSnapshotJson) THEN JSON_UNQUOTE(JSON_EXTRACT(b.priceSnapshotJson,'$.audience.medium')) END,'') AS medium,COALESCE(CASE WHEN JSON_VALID(b.priceSnapshotJson) THEN JSON_UNQUOTE(JSON_EXTRACT(b.priceSnapshotJson,'$.audience.campaign')) END,'') AS campaign,COUNT(*) AS orders,SUM(b.paymentStatus IN ('paid','confirmed','finished')) AS paid FROM booking_requests b WHERE b.createdAt>=${from} AND b.createdAt<${until} AND ${bookingFilter} GROUP BY source,medium,campaign ORDER BY orders DESC LIMIT 20`),
  rows(sql`SELECT COUNT(*) AS count FROM booking_requests b WHERE b.natalPdfKey IS NOT NULL AND b.natalPdfUploadedAt>=${from} AND b.natalPdfUploadedAt<${until} AND NOT EXISTS(SELECT 1 FROM report_jobs j WHERE j.bookingId=b.id) AND ${bookingFilter}`),
  rows(sql`SELECT b.id,b.id AS bookingId,b.deliveredAt AS at,b.deliveryStatus AS status FROM booking_requests b WHERE b.deliveredAt>=${from} AND b.deliveredAt<${until} AND b.deliveryStatus='sent' AND NOT EXISTS(SELECT 1 FROM report_jobs j WHERE j.bookingId=b.id) AND ${bookingFilter} ORDER BY b.deliveredAt DESC LIMIT 200`),
  rows(sql`SELECT id,requestedAt AS at,status FROM receipt_email_attempts WHERE requestedAt>=${from} AND requestedAt<${until} AND LOWER(recipientEmail) NOT REGEXP '(@example[.](com|org|net)$|@sandbox[.]invalid$|@resend[.]dev$|@test[.]com$)' ORDER BY id DESC LIMIT 200`),
  rows(sql`SELECT COUNT(*) AS count FROM booking_requests b WHERE b.deliveredAt>=${from} AND b.deliveredAt<${until} AND b.deliveryStatus='sent' AND NOT EXISTS(SELECT 1 FROM report_jobs j WHERE j.bookingId=b.id) AND ${bookingFilter}`),
 ]);
 let http:any={available:false,requests:0,errors:0,averageMs:0,categories:[],recordedAt:null};
 try{const h=await rows(sql`SELECT category,SUM(requests) AS requests,SUM(errors) AS errors,SUM(totalMs) AS totalMs,MAX(maxMs) AS maxMs,MAX(recordedAt) AS recordedAt FROM http_metric_batches WHERE day>=${from} AND day<${until} GROUP BY category`);const total=h.reduce((s,r)=>s+Number(r.requests),0);http={available:true,requests:total,errors:h.reduce((s,r)=>s+Number(r.errors),0),averageMs:total?Math.round(h.reduce((s,r)=>s+Number(r.totalMs),0)/total):0,categories:h,recordedAt:h.map(r=>r.recordedAt).sort().at(-1)||null}}catch{}
 let audience:any={available:false,firstCollectedAt:null,totals:{},daily:[],events:[],sources:[],languages:[],devices:[]};
 try{const [first,totals,daily,events,sources,languages,devices]=await Promise.all([
  rows(sql`SELECT MIN(createdAt) AS firstCollectedAt FROM audience_events`),
  rows(sql`SELECT COUNT(DISTINCT visitorKey) AS visitors,COUNT(DISTINCT sessionKey) AS sessions,SUM(event='page_view') AS views FROM audience_events WHERE ${eventFilter}`),
  rows(sql`SELECT DATE_FORMAT(createdAt,'%Y-%m-%d') AS day,COUNT(DISTINCT visitorKey) AS visitors,SUM(event='page_view') AS views FROM audience_events WHERE ${eventFilter} GROUP BY day ORDER BY day`),
  rows(sql`SELECT event,COUNT(*) AS events,COUNT(DISTINCT sessionKey) AS sessions FROM audience_events WHERE ${eventFilter} GROUP BY event`),
  rows(sql`SELECT source,medium,campaign,COUNT(DISTINCT sessionKey) AS sessions,SUM(event='form_submit') AS submits FROM audience_events WHERE ${eventFilter} GROUP BY source,medium,campaign ORDER BY sessions DESC LIMIT 20`),
  rows(sql`SELECT locale,COUNT(DISTINCT sessionKey) AS sessions FROM audience_events WHERE ${eventFilter} GROUP BY locale ORDER BY sessions DESC`),
  rows(sql`SELECT device,COUNT(DISTINCT sessionKey) AS sessions FROM audience_events WHERE ${eventFilter} GROUP BY device`),
 ]);audience={available:true,firstCollectedAt:first[0]?.firstCollectedAt,totals:totals[0]||{},daily,events,sources,languages,devices}}catch{/* Missing migration is shown as missing data, never as zero visitors. */}
 return{schemaVersion:'control-room.v1',generatedAt:new Date().toISOString(),range:input,timezone:'UTC',audience,http,currencies,campaignOrders,legacyPdfCount:Number(legacyPdfCount[0]?.count||0),legacySent,legacySentCount:Number(legacySentCount[0]?.count||0),receiptArchive:input.section==='all'&&input.locale==='all'?receiptArchive:[],orders:orders[0],dailyOrders,products,archiveOrders,jobs,pdfs,mail,jobCounts,pdfCounts,mailCounts,backlog,legacy,receipts:input.section==='all'&&input.locale==='all'?receipts:null,refunds,limits:{archiveOrders:50,operations:200},services:{database:true,storage:process.env.STORAGE_PROVIDER==='s3',mail:Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL),checkout:process.env.CHECKOUT_ENABLED==='true',automaticReports:process.env.DIRECT_AUTO_PROCESS==='true',automaticDelivery:process.env.REPORT_AUTO_DELIVERY==='true',mailInboxVerified:false,searchConsoleConnected:false}};
}
export const controlRoomRouter=router({summary:adminProcedure.input(controlRoomFilters).query(({input})=>controlRoomSummary(input))});
