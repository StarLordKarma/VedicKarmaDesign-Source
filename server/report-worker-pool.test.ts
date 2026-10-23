import{expect,it}from'vitest';import{createReportWorkerPool}from'./report-worker-pool';
it('keeps the main event loop responsive while worker CPU is busy',async()=>{
 const pool=createReportWorkerPool(`const{parentPort}=require('node:worker_threads');parentPort.on('message',m=>{const until=Date.now()+300;while(Date.now()<until){}parentPort.postMessage({id:m.id,result:'done'})})`,{eval:true});
 try{let responded=false;const work=pool.run('test',{});await new Promise(r=>setTimeout(()=>{responded=true;r(undefined)},20));expect(responded).toBe(true);expect(await work).toBe('done')}finally{await pool.close()}
},10000);
it('terminates a stuck worker and recovers for a later job',async()=>{
 const pool=createReportWorkerPool(`const{parentPort}=require('node:worker_threads');parentPort.on('message',m=>{if(m.input.hang)while(true){}else parentPort.postMessage({id:m.id,result:'recovered'})})`,{eval:true},2000);
 try{await expect(pool.run('test',{hang:true})).rejects.toThrow('timed out');expect(await pool.run('test',{})).toBe('recovered')}finally{await pool.close()}
},10000);
