import{beforeAll,afterAll,it,expect,vi}from'vitest';import{eq,inArray}from'drizzle-orm';
const mail=vi.hoisted(()=>vi.fn(async()=>{await new Promise(r=>setTimeout(r,20));return{id:'sandbox-provider-id'}}));
vi.mock('./client-delivery',()=>({sendClientReportPdf:mail}));
import{getDb,updateBookingPaymentStatus}from'./db';import{deliverApprovedReport}from'./report-studio-db';import{bookingRequests,reportJobs,reportVersions,reportDeliveryAttempts,reportAuditEvents,verifiedPaymentClaims}from'../drizzle/schema';import{withPaidBookingLock}from'./fulfillment-claims';
const enabled=process.env.RUN_PIPELINE_MYSQL_TESTS==='true';const audit=enabled?it:it.skip;let db:any;const ids:number[]=[],jobs:number[]=[],versions:number[]=[];
beforeAll(async()=>{if(!enabled)return;const url=new URL(process.env.DATABASE_URL||'');if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Audit requires a local disposable test database');db=await getDb()});
afterAll(async()=>{if(!enabled)return;if(jobs.length){await db.delete(reportAuditEvents).where(inArray(reportAuditEvents.reportJobId,jobs));await db.delete(reportJobs).where(inArray(reportJobs.id,jobs))}if(versions.length){await db.delete(reportDeliveryAttempts).where(inArray(reportDeliveryAttempts.reportVersionId,versions));await db.delete(reportVersions).where(inArray(reportVersions.id,versions))}if(ids.length)await db.delete(verifiedPaymentClaims).where(inArray(verifiedPaymentClaims.bookingId,ids));if(ids.length)await db.delete(bookingRequests).where(inArray(bookingRequests.id,ids))});
async function booking(){const r=await db.insert(bookingRequests).values({name:'Synthetic audit',email:'audit@sandbox.invalid',birthDate:'1990-01-01',birthTime:'12:00',birthCity:'Berlin',birthCountry:'Germany',language:'Русский',totalUsd:1.99,paymentStatus:'waiting'});const id=Number(r[0].insertId);ids.push(id);return id}
audit('200 reordered concurrent payment events retain a confirmed payment identity',async()=>{
 const id=await booking();const results=await Promise.all(Array.from({length:200},(_,i)=>updateBookingPaymentStatus({id,paymentId:i%2?'confirmed-hash':'late-invoice',paymentStatus:i%2?'confirmed':'waiting'})));
 const row=(await db.select().from(bookingRequests).where(eq(bookingRequests.id,id)))[0];expect(row.paymentStatus).toBe('confirmed');expect(row.paymentId).toBe('confirmed-hash');expect(results.some(r=>r.isConfirmed)).toBe(true);
 await db.update(bookingRequests).set({status:'completed'}).where(eq(bookingRequests.id,id));await updateBookingPaymentStatus({id,paymentId:'late-invoice',paymentStatus:'failed'});
 expect((await db.select().from(bookingRequests).where(eq(bookingRequests.id,id)))[0]).toMatchObject({status:'completed',paymentStatus:'confirmed',paymentId:'confirmed-hash'});
},60000);
audit('50 concurrent delivery requests create one provider send and one durable attempt',async()=>{
 const id=await booking();await updateBookingPaymentStatus({id,paymentId:'verified-hash',paymentStatus:'confirmed'});
 const j=await db.insert(reportJobs).values({bookingId:id,packageType:'basic',language:'ru',status:'approved',idempotencyKey:crypto.randomUUID(),inputHash:'test'});const jobId=Number(j[0].insertId);jobs.push(jobId);
 const v=await db.insert(reportVersions).values({reportJobId:jobId,versionNumber:1,templateVersion:'audit',locale:'ru',pdfStorageKey:'synthetic.pdf',pdfSha256:'a'.repeat(64),status:'approved'});const versionId=Number(v[0].insertId);versions.push(versionId);
 await Promise.allSettled(Array.from({length:50},()=>deliverApprovedReport({reportJobId:jobId,versionId,actorId:'sandbox'})));
 expect(mail).toHaveBeenCalledTimes(1);expect(mail).toHaveBeenCalledWith(expect.objectContaining({language:'Русский',email:'audit@sandbox.invalid'}));
 const attempts=await db.select().from(reportDeliveryAttempts).where(eq(reportDeliveryAttempts.reportVersionId,versionId));expect(attempts).toHaveLength(1);expect(attempts[0].status).toBe('sent');
 expect((await db.select().from(reportJobs).where(eq(reportJobs.id,jobId)))[0].status).toBe('sent');
},60000);
audit('refund approval and fulfillment share the booking lock in either order',async()=>{
 const id=await booking();await updateBookingPaymentStatus({id,paymentStatus:'confirmed'});let entered!:()=>void,release!:()=>void;const locked=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const first=withPaidBookingLock(db,id,async tx=>{entered();await gate;await tx.update(bookingRequests).set({paymentStatus:'refund_pending'}).where(eq(bookingRequests.id,id))});await locked;
 const second=withPaidBookingLock(db,id,async()=> 'must not fulfill');release();await first;await expect(second).rejects.toThrow('Refunded');
 await updateBookingPaymentStatus({id,paymentStatus:'confirmed',paymentId:'replayed'});expect((await db.select().from(bookingRequests).where(eq(bookingRequests.id,id)))[0].paymentStatus).toBe('refund_pending');
},60000);

audit('a burst cannot reuse one verified blockchain transaction for twenty orders',async()=>{
 const orders=await Promise.all(Array.from({length:20},()=>booking()));const paymentId='0xa86a:0x'+'ab'.repeat(32);
 const outcomes=await Promise.allSettled(orders.map(id=>updateBookingPaymentStatus({id,paymentId,paymentStatus:'confirmed'})));
 expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const rows=await db.select().from(bookingRequests).where(inArray(bookingRequests.id,orders));expect(rows.filter((r:any)=>r.paymentStatus==='confirmed')).toHaveLength(1);
},60000);

audit('provider acceptance survives a subsequent database failure without a second email',async()=>{
 mail.mockClear();const id=await booking();await updateBookingPaymentStatus({id,paymentStatus:'confirmed'});
 const j=await db.insert(reportJobs).values({bookingId:id,packageType:'basic',language:'en',status:'approved',idempotencyKey:crypto.randomUUID(),inputHash:'test'});const jobId=Number(j[0].insertId);jobs.push(jobId);
 const v=await db.insert(reportVersions).values({reportJobId:jobId,versionNumber:1,templateVersion:'audit',locale:'en',pdfStorageKey:'synthetic.pdf',pdfSha256:'b'.repeat(64),status:'approved'});const versionId=Number(v[0].insertId);versions.push(versionId);
 const original=db.update.bind(db);let injected=false;const update=vi.spyOn(db,'update').mockImplementation((table:any)=>{if(table===reportVersions&&!injected){injected=true;throw Error('database interruption after provider acceptance')}return original(table)});
 try{await expect(deliverApprovedReport({reportJobId:jobId,versionId,actorId:'sandbox'})).rejects.toThrow('interruption');await deliverApprovedReport({reportJobId:jobId,versionId,actorId:'sandbox'});expect(mail).toHaveBeenCalledTimes(1);expect((await db.select().from(reportDeliveryAttempts).where(eq(reportDeliveryAttempts.reportVersionId,versionId)))[0].status).toBe('sent')}finally{update.mockRestore()}
},60000);
audit('blocks replay of a historical payment even if its claim has not been backfilled',async()=>{
 const old=await booking(),fresh=await booking(),paymentId='0x89:0x'+'cd'.repeat(32);await db.update(bookingRequests).set({paymentStatus:'confirmed',paymentId}).where(eq(bookingRequests.id,old));
 await expect(updateBookingPaymentStatus({id:fresh,paymentStatus:'confirmed',paymentId})).rejects.toThrow('another order');
});
