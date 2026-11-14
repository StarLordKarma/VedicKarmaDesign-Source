import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const base='https://github.com/StarLordKarma/VedicKarmaDesign-Source/releases/download/geonames-2026-11-14-v1/';
const destination=resolve('server/data/geonames-settlements.sqlite'),temporary=destination+'.download';
async function get(name){const r=await fetch(base+name,{signal:AbortSignal.timeout(name.endsWith('.gz')?900000:120000)});if(!r.ok)throw Error(`Settlement artifact ${name}: HTTP ${r.status}`);return r;}
const manifest=await (await get('geonames-settlements.manifest.json')).json();
const checksum=async name=>{const value=await (await get(name)).text();const hash=value.trim().split(/\s+/)[0];if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid settlement artifact checksum');return hash;};
const expected=await checksum('database.sha256'),expectedArchive=await checksum('archive.sha256');
if(expected!=='1e6b70a982e5f588614d8eac73bd777f03262036b6bc7466a2756a8b01b098d0'||expectedArchive!=='8bf5129c9cb56a3455761018c937843243bee1c97367b088478f814c926d550a')throw Error('Settlement artifact differs from the reviewed release');
if(manifest.archiveSha256!=='b61155e9b902c6b2ad212c0d31a44fe1280c91ccbe6703cc52d22f2e9050509d'||manifest.settlements!==5233013||manifest.indexedNames!==11512783||manifest.license!=='CC BY 4.0')throw Error('Unexpected settlement source snapshot');
async function hashFile(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
let installed=false;try{installed=(await hashFile(destination))===expected;}catch{}
await mkdir(resolve('server/data'),{recursive:true});
if(!installed){
 const compressed=createHash('sha256'),uncompressed=createHash('sha256');let bytes=0;
 try{const response=await get('geonames-settlements.sqlite.gz');await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_enc,cb){compressed.update(chunk);cb(null,chunk);}}),createGunzip(),new Transform({transform(chunk,_enc,cb){bytes+=chunk.length;if(bytes>manifest.databaseBytes)return cb(Error('Settlement artifact is larger than declared'));uncompressed.update(chunk);cb(null,chunk);}}),createWriteStream(temporary,{flags:'w',mode:0o644}));if(compressed.digest('hex')!==expectedArchive||uncompressed.digest('hex')!==expected||bytes!==manifest.databaseBytes)throw Error('Settlement artifact integrity check failed');await rename(temporary,destination);}catch(e){await rm(temporary,{force:true});throw e;}
}
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');const db=new DatabaseSync(destination,{readOnly:true});
if(db.prepare('SELECT name FROM places WHERE id=2950159').get()?.name!=='Berlin'||!db.prepare("SELECT rowid FROM place_search WHERE place_search MATCH '\"berlin\"' LIMIT 1").get()||!db.prepare('SELECT id FROM place_geo LIMIT 1').get())throw Error('Settlement directory schema check failed');db.close();
await writeFile(resolve('server/data/geonames-settlements.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({settlements:manifest.settlements,indexedNames:manifest.indexedNames,sha256:expected,installed:true}));
