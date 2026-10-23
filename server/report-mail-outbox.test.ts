import{beforeEach,afterEach,expect,it,vi}from'vitest';import{createHash}from'node:crypto';
const data=vi.hoisted(()=>new Map());vi.mock('./knowledge/store',()=>({knowledgeStore:()=>({get:async(k:string)=>structuredClone(data.get(k)||null),put:async(k:string,v:any)=>data.set(k,structuredClone(v))})}));
vi.mock('./storage',()=>({storageGetSignedUrl:async()=> 'https://storage.example/report.pdf'}));
import{sendClientReportPdf}from'./client-delivery';
const bytes=Buffer.from('%PDF-outbox'),input={name:'Maya',email:'test@example.com',language:'English',product:'portrait',pdfKey:'report.pdf',pdfName:'report.pdf',expectedPdfSha256:createHash('sha256').update(bytes).digest('hex'),outboxKey:'report-delivery/test.json',idempotencyKey:'report:test'};
beforeEach(()=>data.clear());afterEach(()=>vi.restoreAllMocks());
it('retries exactly the same provider payload after a timeout and owner edits',async()=>{
 const f=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(bytes)).mockRejectedValueOnce(Error('timeout'));
 await expect(sendClientReportPdf(input)).rejects.toThrow('timeout');const first=f.mock.calls[1][1]!.body;
 f.mockResolvedValueOnce(Response.json({id:'accepted'}));await sendClientReportPdf({...input,name:'Edited name',language:'Deutsch',statusUrl:'https://changed.example/status'});
 expect(f).toHaveBeenCalledTimes(3);expect(f.mock.calls[2][1]!.body).toBe(first);
});
it('treats an in-flight idempotent request as retryable, but a changed payload as permanent',async()=>{
 const f=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(bytes)).mockResolvedValueOnce(Response.json({name:'concurrent_idempotent_requests'},{status:409}));
 await expect(sendClientReportPdf(input)).rejects.toMatchObject({code:'BAD_GATEWAY'});
 f.mockResolvedValueOnce(Response.json({name:'invalid_idempotent_request'},{status:409}));await expect(sendClientReportPdf(input)).rejects.toMatchObject({code:'BAD_REQUEST'});
});
it('does not report success for a malformed provider acknowledgement',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(bytes)).mockResolvedValueOnce(Response.json({}));await expect(sendClientReportPdf(input)).rejects.toMatchObject({code:'BAD_GATEWAY'});
});
it('detects a snapshot addressed to someone else before any provider request',async()=>{
 data.set(input.outboxKey,{schemaVersion:'report-mail/v1',idempotencyKey:input.idempotencyKey,payload:{to:['someone-else@example.com'],attachments:[{content:bytes.toString('base64')}]}});
 const f=vi.spyOn(globalThis,'fetch');await expect(sendClientReportPdf(input)).rejects.toThrow('integrity');expect(f).not.toHaveBeenCalled();
});
