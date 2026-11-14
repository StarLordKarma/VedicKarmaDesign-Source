import pathlib,sqlite3,unicodedata,json
root=pathlib.Path(__file__).resolve().parents[1]
db=sqlite3.connect(root/'server/data/geonames-settlements.sqlite')
db.executescript("PRAGMA synchronous=OFF; PRAGMA journal_mode=OFF; CREATE TABLE IF NOT EXISTS place_names(key TEXT,id INTEGER,PRIMARY KEY(key,id)) WITHOUT ROWID;")
def norm(s):return ''.join(c for c in unicodedata.normalize('NFKD',s) if not unicodedata.combining(c)).lower().strip()
batch=[];count=0
for ident,name,ascii,aliases in db.execute('SELECT id,name,ascii,aliases FROM places'):
    for value in set(norm(v) for v in [name,ascii,*aliases.split(',')]):
        if 2<=len(value)<=100:batch.append((value,ident))
    count+=1
    if len(batch)>30000:
        db.executemany('INSERT OR IGNORE INTO place_names VALUES(?,?)',batch);db.commit();batch=[]
    if count%1000000==0:print(json.dumps({'namesIndexedForSettlements':count}),flush=True)
db.executemany('INSERT OR IGNORE INTO place_names VALUES(?,?)',batch);db.commit()
names=db.execute('SELECT count(*) FROM place_names').fetchone()[0];db.close()
manifest=root/'server/data/geonames-settlements.manifest.json'
if manifest.exists():
    m=json.loads(manifest.read_text());m.update({'indexedNames':names,'databaseBytes':(root/'server/data/geonames-settlements.sqlite').stat().st_size});manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'indexedNames':names}),flush=True)
