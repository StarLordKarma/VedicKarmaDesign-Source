import{resolve}from'node:path';import{createReportWorkerPool}from'./report-worker-pool';
const production=process.env.NODE_ENV==='production';
const pool=createReportWorkerPool(resolve(production?'dist/reading-worker.js':'server/reading-worker-bootstrap.mjs'),{...(production?{}:{execArgv:[]}),resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32}});
export const buildReadingOffThread=(input:any)=>pool.run('reading',input);
export const renderReadingOffThread=async(reading:any)=>Buffer.from(await pool.run('pdf',reading));
export const renderLegacyOffThread=async(input:any)=>Buffer.from(await pool.run('legacy-pdf',input));
export const closeReportRenderer=()=>pool.close();
