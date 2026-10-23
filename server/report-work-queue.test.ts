import{expect,it}from'vitest';import{createReportWorkQueue}from'./report-work-queue';
it('coalesces 1000 simultaneous requests for the same report',async()=>{
 const run=createReportWorkQueue();let calls=0;const results=await Promise.all(Array.from({length:1000},()=>run(1,async()=>{calls++;await new Promise(r=>setTimeout(r,5));return'one saved report'})));
 expect(calls).toBe(1);expect(new Set(results).size).toBe(1);
});
it('bounds simultaneous work and queue memory during a burst, then recovers',async()=>{
 const run=createReportWorkQueue(20);let active=0,peak=0,done=0;
 const results=await Promise.allSettled(Array.from({length:1000},(_,id)=>run(id,async()=>{peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,1));active--;done++;return id})));
 expect(peak).toBe(1);expect(done).toBe(21);expect(results.filter(r=>r.status==='rejected')).toHaveLength(979);
 await expect(run(2000,async()=> 'recovered')).resolves.toBe('recovered');
});
it('releases a failed job so the durable worker can retry it',async()=>{
 const run=createReportWorkQueue();await expect(run(1,async()=>{throw Error('storage offline')})).rejects.toThrow('offline');
 await new Promise(r=>setTimeout(r,0));await expect(run(1,async()=> 'retry')).resolves.toBe('retry');
});
