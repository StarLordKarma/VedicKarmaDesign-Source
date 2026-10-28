import {S3Client,GetObjectCommand,PutObjectCommand,ListObjectsV2Command,HeadObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl}from'@aws-sdk/s3-request-presigner';
import {createHash} from 'node:crypto';
import {createConnection}from'mysql2/promise';
import {resolveDatabaseUrl}from'../_core/database-url';
import {ENV}from'../_core/env';
import {PREFIX,MAX_MEDIA_BYTES,seal,unseal,type Installation,type Job}from'./core';
let s3:S3Client|undefined;
function client(){if(process.env.STORAGE_PROVIDER!=='s3'||!process.env.S3_BUCKET)throw Error('storage_unavailable');return s3??=new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true'})}
function bucket(){return process.env.S3_BUCKET!}
export async function getText(key:string){try{const r=await client().send(new GetObjectCommand({Bucket:bucket(),Key:PREFIX+key}));return await r.Body!.transformToString()}catch(e:any){if(e?.$metadata?.httpStatusCode===404||e?.name==='NoSuchKey')return null;throw Error('storage_unavailable')}}
export async function putText(key:string,body:string){await client().send(new PutObjectCommand({Bucket:bucket(),Key:PREFIX+key,Body:body,ContentType:'application/json',CacheControl:'private,no-store'}))}
export async function getInstallation(){const text=await getText('installation.enc');return text?unseal(text,ENV.cookieSecret) as Installation:null}
export async function saveInstallation(config:Installation){await putText('installation.enc',seal(config,ENV.cookieSecret))}
export async function getJob(id:string){const text=await getText('jobs/'+id+'.json');return text?JSON.parse(text) as Job:null}
export async function saveJob(job:Job){await putText('jobs/'+job.itemId+'.json',JSON.stringify(job))}
export async function jobs(){const result:Job[]=[];let token:string|undefined;do{const r=await client().send(new ListObjectsV2Command({Bucket:bucket(),Prefix:PREFIX+'jobs/',ContinuationToken:token,MaxKeys:1000}));for(const obj of r.Contents||[]){const text=await getText(obj.Key!.slice(PREFIX.length));if(text)result.push(JSON.parse(text))}token=r.IsTruncated?r.NextContinuationToken:undefined}while(token);return result}
export async function usage(){let media=0,total=0,objects=0,token:string|undefined;do{const r=await client().send(new ListObjectsV2Command({Bucket:bucket(),ContinuationToken:token,MaxKeys:1000}));for(const x of r.Contents||[]){total+=x.Size||0;objects++;if(x.Key?.startsWith(PREFIX+'media/'))media+=x.Size||0}token=r.IsTruncated?r.NextContinuationToken:undefined;if(objects>10000)throw Error('storage_review_required')}while(token);return {mediaBytes:media,bucketBytes:total,mediaLimit:MAX_MEDIA_BYTES}}
export async function lock<T>(fn:()=>Promise<T>):Promise<T|null>{const url=resolveDatabaseUrl();if(!url)throw Error('database_unavailable');const db=await createConnection(url);let got=false;try{const[r]=await db.query<any[]>("SELECT GET_LOCK('social-publisher-v1',0) AS acquired");got=Number(r[0]?.acquired)===1;if(!got)return null;return await fn()}finally{if(got)await db.query("SELECT RELEASE_LOCK('social-publisher-v1')").catch(()=>{});await db.end().catch(()=>{})}}
export function mediaKey(job:Job,kind:'video'|'cover'){return PREFIX+'media/'+job.itemId+'/'+(kind==='video'?job.sha256+'.mp4':job.coverSha256+'.jpg')}
export async function uploadUrls(job:Job){const result:Record<string,string>={};for(const kind of ['video','cover'] as const){result[kind]=await getSignedUrl(client(),new PutObjectCommand({Bucket:bucket(),Key:mediaKey(job,kind),ContentType:kind==='video'?'video/mp4':'image/jpeg',ContentLength:kind==='video'?job.videoBytes:job.coverBytes}),{expiresIn:3600})}return result}
export async function downloadUrl(job:Job,kind:'video'|'cover'){return getSignedUrl(client(),new GetObjectCommand({Bucket:bucket(),Key:mediaKey(job,kind)}),{expiresIn:21600})}
export async function verifyMedia(job:Job){for(const kind of ['video','cover'] as const){const Key=mediaKey(job,kind),head=await client().send(new HeadObjectCommand({Bucket:bucket(),Key}));if(head.ContentLength!==(kind==='video'?job.videoBytes:job.coverBytes))throw Error('media_mismatch');const r=await client().send(new GetObjectCommand({Bucket:bucket(),Key}));const hash=createHash('sha256');let bytes=0;for await(const block of r.Body as any){bytes+=block.length;if(bytes>300*1024*1024)throw Error('media_mismatch');hash.update(block)}if(hash.digest('hex')!==(kind==='video'?job.sha256:job.coverSha256))throw Error('media_mismatch')}}
