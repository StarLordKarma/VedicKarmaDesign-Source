import {beforeAll,afterAll,it,expect} from 'vitest';
import {eq,inArray,sql} from 'drizzle-orm';
import {getDb} from './db';
import {bookingRequests,reportJobs,reportVersions,reportDeliveryAttempts,audienceEvents,httpMetricBatches} from '../drizzle/schema';
import {controlRoomSummary,audienceHash} from './control-room';
const enabled=process.env.RUN_PIPELINE_MYSQL_TESTS==='true',check=enabled?it:it.skip;let db:any;const ids:number[]=[],jobs:number[]=[],versions:number[]=[];const events:string[]=[];
const at=new Date('2030-01-01T12:00:00Z'),range={from:'2030-01-01',to:'2030-01-02',section:'all',locale:'all'} as const;
beforeAll(async()=>{if(!enabled)return;const url=new URL(process.env.DATABASE_URL||'');if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Requires a disposable local test database');db=await getDb()});
afterAll(async()=>{if(!enabled)return;if(versions.length){await db.delete(reportDeliveryAttempts).where(inArray(reportDeliveryAttempts.reportVersionId,versions));await db.delete(reportVersions).where(inArray(reportVersions.id,versions))}if(jobs.length)await db.delete(reportJobs).where(inArray(reportJobs.id,jobs));if(ids.length)await db.delete(bookingRequests).where(inArray(bookingRequests.id,ids));if(events.length)await db.delete(audienceEvents).where(inArray(audienceEvents.eventId,events));});
check('aggregates real SQL correctly, separates currencies and filters section/language without leaking customers',async()=>{
 for(const[product,language,currency,status,amount,email]of [['portrait','Русский','USD','confirmed',9.99,'synthetic@audit.invalid'],['tarot','Deutsch','EUR','waiting',4.99,'synthetic@audit.invalid'],['daily','Русский','USD','confirmed',1.99,'synthetic@sandbox.invalid']]){const result=await db.insert(bookingRequests).values({name:'Synthetic analytics test',email,birthDate:'1990-01-01',birthTime:'12:00',birthCity:'Berlin',birthCountry:'Germany',packageCode:product,language,currency,paymentStatus:status,totalUsd:amount,createdAt:at});ids.push(Number(result[0].insertId))}
 const result=await db.insert(reportJobs).values({bookingId:ids[0],packageType:'basic',language:'ru',status:'sent',testJob:false,idempotencyKey:'control-'+crypto.randomUUID(),inputHash:'test-hash',createdAt:at});const job=Number(result[0].insertId);jobs.push(job);
 const version=await db.insert(reportVersions).values({reportJobId:job,versionNumber:1,templateVersion:'test',locale:'ru',pdfStorageKey:'private-test.pdf',status:'sent',createdAt:at});versions.push(Number(version[0].insertId));
 await db.insert(reportDeliveryAttempts).values({reportVersionId:versions[0],recipientEmail:'synthetic@audit.invalid',status:'sent',idempotencyKey:'test-'+crypto.randomUUID(),requestedBy:'test',requestedAt:at});
 const summary=await controlRoomSummary(range);expect(Number(summary.orders.orders)).toBe(2);expect(Number(summary.orders.paid)).toBe(1);expect(Number(summary.orders.grossUsd)).toBeCloseTo(9.99);expect(Number(summary.pdfCounts[0].count)).toBe(1);expect(Number(summary.mailCounts[0].count)).toBe(1);
 const ru=await controlRoomSummary({...range,locale:'ru'});expect(Number(ru.orders.orders)).toBe(1);
 const tarot=await controlRoomSummary({...range,section:'tarot'});expect(Number(tarot.orders.orders)).toBe(1);expect(Number(tarot.orders.paid)).toBe(0);
 expect(JSON.stringify(summary)).not.toMatch(/synthetic@|Synthetic analytics|1990-01-01|private-test.pdf/);
});
check('deduplicates collection and counts distinct sessions instead of claiming each click is a visitor',async()=>{
 const visitor=crypto.randomUUID(),session=crypto.randomUUID();
 for(const event of ['page_view','form_open','form_open']){const eventId=crypto.randomUUID();events.push(eventId);const value={eventId,visitorKey:audienceHash(visitor),sessionKey:audienceHash(session),event,section:'western',product:'portrait',locale:'ru',device:'desktop',source:'test_campaign',medium:'social',campaign:'synthetic',createdAt:at};await db.insert(audienceEvents).values(value).onDuplicateKeyUpdate({set:{eventId}});await db.insert(audienceEvents).values(value).onDuplicateKeyUpdate({set:{eventId}})}
 const summary=await controlRoomSummary(range);expect(Number(summary.audience.totals.visitors)).toBe(1);expect(Number(summary.audience.totals.sessions)).toBe(1);expect(Number(summary.audience.events.find((e:any)=>e.event==='form_open').events)).toBe(2);expect(Number(summary.audience.events.find((e:any)=>e.event==='form_open').sessions)).toBe(1);
});
