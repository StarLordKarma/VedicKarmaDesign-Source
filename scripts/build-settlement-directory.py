"""Build an indexed local gazetteer from official GeoNames downloads. No user data."""
import datetime, hashlib, json, math, pathlib, sqlite3, zipfile, subprocess, sys

root=pathlib.Path(__file__).resolve().parents[1]
source=root/'server/data/geonames-source'
target=root/'server/data/geonames-settlements.sqlite'
temp=target.with_suffix('.building.sqlite')
if temp.exists(): temp.unlink()
def admins(file):
    return {p[0]:p[1] for line in (source/file).read_text().splitlines() if len(p:=line.split('\t'))>=2}
a1=admins('admin1CodesASCII.txt'); a2=admins('admin2Codes.txt')
db=sqlite3.connect(temp)
db.executescript('''PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=FILE;
CREATE TABLE places(id INTEGER PRIMARY KEY,name TEXT,ascii TEXT,aliases TEXT,country TEXT,region TEXT,district TEXT,lat REAL,lon REAL,tz TEXT,population INTEGER,feature TEXT);
CREATE TABLE countries(code TEXT PRIMARY KEY,name TEXT);
CREATE VIRTUAL TABLE place_search USING fts5(names,content='',tokenize='unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE place_geo USING rtree(id,minLat,maxLat,minLon,maxLon);
''')
for line in (source/'countryInfo.txt').read_text().splitlines():
    if line.startswith('#') or not line: continue
    p=line.split('\t'); db.execute('INSERT OR IGNORE INTO countries VALUES(?,?)',(p[0],p[4]))
count=0; skipped=0; historical=0; batch=[]; text=[]; spatial=[]
def flush():
    db.executemany('INSERT INTO places VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',batch)
    db.executemany('INSERT INTO place_search(rowid,names) VALUES(?,?)',text)
    db.executemany('INSERT INTO place_geo VALUES(?,?,?,?,?)',spatial)
    db.commit(); batch.clear(); text.clear(); spatial.clear()
with zipfile.ZipFile(source/'allCountries.zip') as archive:
    with archive.open('allCountries.txt') as rows:
        for raw in rows:
            p=raw.decode('utf-8').rstrip('\n').split('\t')
            if len(p)<19 or p[6]!='P': continue
            if not p[17] or not p[8]: skipped+=1; continue
            lat,lon=float(p[4]),float(p[5])
            if not (math.isfinite(lat) and math.isfinite(lon) and abs(lat)<=90 and abs(lon)<=180): skipped+=1; continue
            region=a1.get(p[8]+'.'+p[10],p[10]); district=a2.get(p[8]+'.'+p[10]+'.'+p[11],p[11])
            ident=int(p[0]); population=int(p[14] or 0)
            batch.append((ident,p[1],p[2],p[3],p[8],region,district,lat,lon,p[17],population,p[7]))
            text.append((ident,' '.join(dict.fromkeys([p[1],p[2],p[3].replace(',',' '),region,district]))))
            spatial.append((ident,lat,lat,lon,lon)); count+=1
            if p[7] in ('PPLH','PPLQ','PPLW'): historical+=1
            if len(batch)>=10000:
                flush()
                if count%250000==0: print(json.dumps({'imported':count}),flush=True)
flush()
db.executescript('CREATE INDEX places_country ON places(country); INSERT INTO place_search(place_search) VALUES(\'optimize\'); PRAGMA optimize;')
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
db.close(); temp.replace(target)
subprocess.run([sys.executable,str(root/'scripts/index-settlement-names.py')],check=True)
hasher=hashlib.sha256()
with (source/'allCountries.zip').open('rb') as archive:
    for chunk in iter(lambda:archive.read(1024*1024),b''): hasher.update(chunk)
digest=hasher.hexdigest()
manifest={'source':'https://download.geonames.org/export/dump/allCountries.zip','license':'CC BY 4.0','attribution':'GeoNames — https://www.geonames.org/','builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archiveSha256':digest,'settlements':count,'historicalSettlements':historical,'skippedMissingTimezoneCountryOrCoordinates':skipped,'databaseBytes':target.stat().st_size}
with sqlite3.connect(target) as check: manifest['indexedNames']=check.execute('SELECT count(*) FROM place_names').fetchone()[0]
(root/'server/data/geonames-settlements.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest),flush=True)
