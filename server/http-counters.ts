import {randomUUID} from 'node:crypto';
import {getDb} from './db';
import {httpMetricBatches} from '../drizzle/schema';
import {sql} from 'drizzle-orm';
type Bucket={id:string;category:string;requests:number;errors:number;totalMs:number;maxMs:number;day:Date};
const pending=new Map<string,Bucket>();let retry:Bucket[]=[];let flushing=false,timer:ReturnType<typeof setInterval>|undefined;
export function recordHttpCounter(path:string,status:number,duration:number){
 if(path==='/health'||path==='/ready'||path==='/api/audience')return;
 const category=path.startsWith('/api/trpc/booking.submit')?'order_api':path.startsWith('/admin')?'admin':path.startsWith('/pay/')||path.startsWith('/api/direct-payment')?'checkout':path.startsWith('/readings/')?'assets':path==='/'||path.startsWith('/guides/')?'pages':path.startsWith('/api/')?'api':'other';
 const date=new Date().toISOString().slice(0,10),key=date+':'+category;if(!pending.has(key)&&pending.size>=32)return;
 const b=pending.get(key)||{id:randomUUID(),category,requests:0,errors:0,totalMs:0,maxMs:0,day:new Date(date+'T00:00:00Z')};
 b.requests++;b.errors+=status>=500?1:0;b.totalMs+=Math.min(600000,Math.max(0,duration));b.maxMs=Math.max(b.maxMs,Math.min(600000,duration));pending.set(key,b);
 if(!timer){timer=setInterval(()=>void flushHttpCounters(),60000);timer.unref()}
}
export async function flushHttpCounters(){if(flushing)return;flushing=true;try{const db=await getDb();if(!db)return;if(!retry.length){retry=Array.from(pending.values());pending.clear()}if(!retry.length)return;
 await db.insert(httpMetricBatches).values(retry).onDuplicateKeyUpdate({set:{id:sql`id`}});retry=[];
 await db.execute(sql`DELETE FROM http_metric_batches WHERE day < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 90 DAY) LIMIT 1000`);
 }catch{/* Keep a bounded batch with stable IDs for idempotent retry. */}finally{flushing=false}}
