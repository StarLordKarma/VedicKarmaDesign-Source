import express,{type Request,type RequestHandler}from'express';
import{sdk}from'./_core/sdk';import{ENV}from'./_core/env';
const uploadPaths=new Set(['admin.attachNatalPdf','admin.sendSlaChartPdf']);
const editorialPaths=new Set(['reportStudio.reviseNarrative','knowledge.approve']);
const smallJson=express.json({limit:'64kb',inflate:false}),editorialJson=express.json({limit:'2mb',inflate:false}),uploadJson=express.json({limit:'18mb',inflate:false});
const form=express.urlencoded({limit:'64kb',extended:false,parameterLimit:100,inflate:false});
export function requestBoundaries(authenticate:(req:Request)=>Promise<any>=req=>sdk.authenticateRequest(req)):RequestHandler{
 return async(req,res,next)=>{
  let path:string;try{path=decodeURIComponent(req.path)}catch{return void res.status(400).json({error:'invalid_path'})}
  const procedure=path.startsWith('/api/trpc/')?path.slice('/api/trpc/'.length):'';
  if(req.method==='POST'&&procedure.includes(','))return void res.status(400).json({error:'mutation_batch_not_allowed'});
  const privileged=uploadPaths.has(procedure)||editorialPaths.has(procedure);
  if(privileged){try{const user=await authenticate(req);if(!user||user.role!=='admin'||!ENV.ownerOpenId||user.openId!==ENV.ownerOpenId)return void res.status(403).json({error:'forbidden'})}catch{return void res.status(403).json({error:'forbidden'})}}
  const parser=uploadPaths.has(procedure)?uploadJson:editorialPaths.has(procedure)?editorialJson:smallJson;
  if(req.is('application/x-www-form-urlencoded'))return form(req,res,next);
  return parser(req,res,next);
 };
}
