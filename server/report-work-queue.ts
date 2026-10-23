// Bound expensive PDF/AI work per process. Jobs stay persisted in the database
// when this in-memory admission queue is full; the worker will retry them.
export function createReportWorkQueue(maxPending=20){
 const jobs=new Map<number,Promise<any>>();const pending:Array<()=>void>=[];let active=false;
 function pump(){if(active||!pending.length)return;active=true;pending.shift()!()}
 return function run<T>(id:number,work:()=>Promise<T>):Promise<T>{
  const existing=jobs.get(id);if(existing)return existing;
  if(jobs.size>=maxPending+1)return Promise.reject(Error('Report capacity busy; persisted job remains queued for retry'));
  let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;
  const result=new Promise<T>((yes,no)=>{resolve=yes;reject=no});jobs.set(id,result);
  pending.push(()=>{void Promise.resolve().then(work).then(resolve,reject).finally(()=>{jobs.delete(id);active=false;pump()})});pump();return result;
 };
}
export const runReportWork=createReportWorkQueue();
