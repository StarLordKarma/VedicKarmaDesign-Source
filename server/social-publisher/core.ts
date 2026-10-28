import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {z} from 'zod';

export const VERSION='social-publisher-2026-10-28-1';
export const CHANNEL='UCWWmtrG-9zSgg5EDkKecf1A';
export const USERS=['emilialifedesign','morgan506942'] as const;
export const PREFIX='social-publisher-v1/';
export const MAX_MEDIA_BYTES=1024*1024*1024;
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const credential=z.string().min(10).max(8192);
export const installSchema=z.object({
 apiKey:z.string().regex(/^[a-f0-9]{64}$/),
 youtube:z.object({clientId:credential,clientSecret:credential,refreshToken:credential,channel:z.literal(CHANNEL)}).strict(),
 instagram:z.array(z.object({username:z.enum(USERS),id:z.string().regex(/^\d{10,30}$/),token:credential,exportedAt:z.string().datetime({offset:true})}).strict()).length(2),
}).strict().refine(x=>new Set(x.instagram.map(i=>i.username)).size===2);
export type Installation=z.infer<typeof installSchema>;
export const prepareSchema=z.object({
 itemId:z.string().regex(/^Cosmic-Psyche-[a-f0-9]{64}$/),sha256:digest,coverSha256:digest,
 videoBytes:z.number().int().min(100).max(300*1024*1024),coverBytes:z.number().int().min(100).max(8*1024*1024),
 youtubeVideoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/),youtubePublishAt:z.string().datetime({offset:true}),
 captions:z.object({emilialifedesign:z.string().min(10).max(2200),morgan506942:z.string().min(10).max(2200)}).strict(),
}).strict().refine(x=>x.itemId==='Cosmic-Psyche-'+x.sha256);
export type Prepared=z.infer<typeof prepareSchema>;
export type Target={username:typeof USERS[number];status:'pending'|'creating'|'processing'|'publishing'|'published'|'needs_reconciliation';containerId?:string;mediaId?:string;attemptedAt?:string;polls?:number;verifiedAt?:string;result?:Record<string,unknown>};
export type Job=Prepared & {createdAt:string;state:'uploading'|'queued'|'complete'|'needs_reconciliation';targets:Target[];youtubeVerifiedAt?:string;acceptedAt?:string;lastCheck?:string;blocker?:string};
export type YoutubeStatus={channel:string;privacy:string;processing:string;publishAt?:string};
export interface EngineIO {
 now?:()=>Date;
 save(job:Job):Promise<void>;
 youtube(job:Job):Promise<YoutubeStatus>;
 create(job:Job,target:Target):Promise<string>;
 container(target:Target):Promise<string>;
 publish(target:Target):Promise<string>;
 verify(job:Job,target:Target):Promise<Record<string,unknown>>;
}
export function equalSecret(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function key(master:string){if(master.length<32)throw Error('unavailable');return createHash('sha256').update('social-publisher-v1\0'+master).digest()}
export function seal(value:unknown,master:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(master),iv);cipher.setAAD(Buffer.from(PREFIX));const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')})}
export function unseal(value:string,master:string):unknown{const x=JSON.parse(value);if(x.v!==1)throw Error('unavailable');const cipher=createDecipheriv('aes-256-gcm',key(master),Buffer.from(x.iv,'base64'));cipher.setAAD(Buffer.from(PREFIX));cipher.setAuthTag(Buffer.from(x.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(x.data,'base64')),cipher.final()]).toString('utf8'))}
export function publicJob(job:Job){return {...job,targets:job.targets.map(t=>({...t}))}}
export function initialJob(input:Prepared,date=new Date()):Job{return {...input,createdAt:date.toISOString(),state:'uploading',targets:USERS.map(username=>({username,status:'pending'}))}}
export function canAccept(status:YoutubeStatus,job:Job){return status.channel===CHANNEL&&status.processing==='succeeded'&&(status.privacy==='public'||(status.privacy==='private'&&Boolean(status.publishAt)&&Date.parse(status.publishAt!)===Date.parse(job.youtubePublishAt)))}

/** All mutations run under a dedicated database advisory lock. Pending markers are durable before remote calls. */
export async function advance(job:Job,all:Job[],io:EngineIO,time=new Date()){
 if(job.state!=='queued')return;
 job.lastCheck=time.toISOString();
 // The owner opted to use the verified YouTube schedule without checking public status.
 const youtubeBaseline=job.youtubePublishAt;
 for(let index=0;index<job.targets.length;index++){
  const target=job.targets[index];if(target.status==='published')continue;
  if(['creating','publishing','needs_reconciliation'].includes(target.status)){
   target.status='needs_reconciliation';job.state='needs_reconciliation';await io.save(job);return;
  }
  const before=index?job.targets[index-1].verifiedAt:youtubeBaseline;
  if(!before)return;
  if(time.getTime()<Date.parse(before)+3600000)return;
  // Across all videos, keep at least one hour between accounts and one day per account.
  for(const other of all)for(const published of other.targets){
   if(published.status!=='published'||!published.verifiedAt)continue;
   const gap=published.username===target.username?86400000:3600000;
   if(time.getTime()<Date.parse(published.verifiedAt)+gap)return;
  }
  if(!target.containerId){
   target.status='creating';target.attemptedAt=time.toISOString();await io.save(job);
   target.containerId=await io.create(job,target);target.status='processing';target.polls=0;await io.save(job);return;
  }
  const state=await io.container(target);target.polls=(target.polls||0)+1;
  if(state!=='FINISHED'){
   if(state!=='IN_PROGRESS'||target.polls>=5){target.status='needs_reconciliation';job.state='needs_reconciliation'}
   await io.save(job);return;
  }
  target.status='publishing';await io.save(job);
  target.mediaId=await io.publish(target);await io.save(job);
  const result=await io.verify(job,target);
  if(result.username!==target.username||result.media_type!=='VIDEO'||result.caption!==job.captions[target.username]||typeof result.permalink!=='string'||!result.permalink.startsWith('https://www.instagram.com/')){
   target.status='needs_reconciliation';job.state='needs_reconciliation';await io.save(job);return;
  }
  target.result=result;target.status='published';target.verifiedAt=(io.now?.()||time).toISOString();await io.save(job);return;
 }
 job.state='complete';delete job.blocker;await io.save(job);
}
