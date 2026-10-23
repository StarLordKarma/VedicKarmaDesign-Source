import {createHash} from 'node:crypto';
import {TRPCError} from '@trpc/server';
export const MAX_REPORT_BYTES=12*1024*1024;
export function reportDigest(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex')}
export function assertReportAttachment(bytes:Uint8Array,expected?:string|null){
 if(bytes.length>MAX_REPORT_BYTES)throw new TRPCError({code:'PAYLOAD_TOO_LARGE',message:'The report PDF exceeds the delivery limit.'});
 if(Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Report PDF integrity check failed.'});
 if(expected){
  const base64=Buffer.from(bytes).toString('base64');
  // Existing releases stored base64 digests (one also JSON-quoted the string).
  // Keep these immutable reports usable; all new reports use a digest of bytes.
  const legacy=[base64,JSON.stringify(base64)].map(s=>createHash('sha256').update(s).digest('hex'));
  if(![reportDigest(bytes),...legacy].includes(expected))throw new TRPCError({code:'PRECONDITION_FAILED',message:'Report PDF integrity check failed.'});
 }
}
export async function readReportAttachment(response:Response,expected?:string|null){
 if(Number(response.headers.get('content-length')||0)>MAX_REPORT_BYTES){await response.body?.cancel();throw new TRPCError({code:'PAYLOAD_TOO_LARGE',message:'The report PDF exceeds the delivery limit.'})}
 const reader=response.body?.getReader();if(!reader)throw Error('Report PDF is empty');
 const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_REPORT_BYTES){await reader.cancel();throw new TRPCError({code:'PAYLOAD_TOO_LARGE',message:'The report PDF exceeds the delivery limit.'})}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=Buffer.concat(chunks,total);assertReportAttachment(bytes,expected);return bytes;
}
