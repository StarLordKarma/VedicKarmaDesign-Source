import {afterEach,expect,it,vi}from'vitest';
import {createHash}from'node:crypto';
import {sendClientReportPdf}from'./client-delivery';
import {createRateLimit}from'./observability';
vi.mock('./storage',()=>({storageGetSignedUrl:async()=> 'https://storage.example/private.pdf'}));
afterEach(()=>vi.restoreAllMocks());
it('rejects a changed attachment before contacting the email provider',async()=>{
 const original=Buffer.from('%PDF-original'),changed=Buffer.from('%PDF-tampered');
 const f=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(changed)).mockResolvedValueOnce(Response.json({id:'unexpected-send'}));
 await expect(sendClientReportPdf({name:'Test',email:'test@example.com',language:'English',pdfKey:'report.pdf',pdfName:'report.pdf',expectedPdfSha256:createHash('sha256').update(original).digest('hex')} as any)).rejects.toThrow(/integrity/i);
 expect(f).toHaveBeenCalledTimes(1);
});
it('bounds rate-limiter memory for many distinct clients without evicting active limits',()=>{
 vi.spyOn(console,'warn').mockImplementation(()=>{});
 const limiter=createRateLimit({name:'bounded',windowMs:60000,max:2,maxKeys:8} as any);
 const run=(ip:string)=>{const next=vi.fn(),res:any={setHeader:vi.fn(),status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res);limiter({ip,socket:{}} as any,res,next);return{next,res}};
 for(let i=0;i<8;i++)expect(run('client-'+i).next).toHaveBeenCalledOnce();
 expect(run('one-more').res.status).toHaveBeenCalledWith(429);
 expect(run('client-0').next).toHaveBeenCalledOnce();
 expect(run('client-0').res.status).toHaveBeenCalledWith(429);
});

it('rejects unsupported dates and Tarot currency before accepting a payment',async()=>{
 const{bookingSchema,PRIVACY_NOTICE_VERSION}=await import('../shared/booking');
 const base={name:'Test',email:'test@example.com',language:'English',addon:false,privacyAcknowledged:true,privacyNoticeVersion:PRIVACY_NOTICE_VERSION,privacyLocale:'en'};
 expect(bookingSchema.safeParse({...base,product:'tarot',currency:'EUR'}).success).toBe(false);
 const birth={birthDate:'1799-12-31',birthTime:'12:00',birthCity:'Berlin',birthCountry:'Germany'};
 expect(bookingSchema.safeParse({...base,...birth,product:'portrait'}).success).toBe(false);
 expect(bookingSchema.safeParse({...base,...birth,birthDate:'1990-01-01',product:'monthly',month:'2400-01'}).success).toBe(false);
});
it('rejects oversized streaming PDFs even without a content-length header',async()=>{
 const{readReportAttachment,MAX_REPORT_BYTES}=await import('./report-attachment');let cancelled=false;
 const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1024*1024))},cancel(){cancelled=true}});
 await expect(readReportAttachment(new Response(stream))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});expect(cancelled).toBe(true);expect(MAX_REPORT_BYTES).toBe(12*1024*1024);
});
it('allows the three historical digest formats but rejects non-PDF objects',async()=>{
 const{assertReportAttachment,reportDigest}=await import('./report-attachment');const bytes=Buffer.from('%PDF-valid'),base64=bytes.toString('base64');
 for(const hash of[reportDigest(bytes),... [base64,JSON.stringify(base64)].map(v=>createHash('sha256').update(v).digest('hex'))])expect(()=>assertReportAttachment(bytes,hash)).not.toThrow();
 expect(()=>assertReportAttachment(Buffer.from('<html>error</html>'))).toThrow('integrity');
});
