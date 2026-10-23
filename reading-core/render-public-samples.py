from pathlib import Path
import json
from pypdf import PdfReader,PdfWriter
import pypdfium2 as pdfium
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parent
period_titles={'en':'Your timeline','ru':'Ваша линия времени','es':'Tu línea del tiempo','de':'Ihre Zeitlinie'}
summary={}
for lang in ['en','ru','es','de']:
 out=root/'public/samples'/lang;out.mkdir(parents=True,exist_ok=True)
 for kind in ['western','tarot','vedic']:
  src=root/'output/sample-source'/lang/(kind+'.pdf');r=PdfReader(src)
  if kind=='vedic':
   time=next(i for i,p in enumerate(r.pages) if period_titles[lang] in (p.extract_text() or ''))
   indices=[0,1,time]
  else:
   if kind=='western':indices=[0,1,2]
   else:
    titles={'en':'Reading the cards together','ru':'Как связаны три карты','es':'Cómo se relacionan las cartas','de':'Die Karten gemeinsam betrachten'}
    story=next((i for i,p in enumerate(r.pages) if titles[lang] in (p.extract_text() or '')),min(2,len(r.pages)-1))
    indices=[0,1,story]
  assert len(set(indices))==3,(kind,indices)
  w=PdfWriter()
  for i in indices:w.add_page(r.pages[i])
  w.add_metadata({'/Title':f'Karma Life Design — {kind} — {lang} — fictional sample','/Subject':'Three selected pages from a fictional full report'})
  pdf=out/(kind+'.pdf')
  with pdf.open('wb')as f:w.write(f)
  doc=pdfium.PdfDocument(pdf);assert len(doc)==3
  previews=[]
  for i in range(3):
   im=doc[i].render(scale=1.5).to_pil().convert('RGB');im.save(out/f'{kind}-{i+1}.webp',quality=86)
   im.thumbnail((320,460));previews.append(im)
  sheet=Image.new('RGB',(990,480),'#eee8de')
  for i,im in enumerate(previews):sheet.paste(im,(i*330+5,5))
  qa=root/'output/qa-v3';qa.mkdir(exist_ok=True);sheet.save(qa/f'{lang}-{kind}.jpg',quality=90)
  for i,p in enumerate(PdfReader(pdf).pages):assert len(p.extract_text() or '')>80,(lang,kind,i)
  summary[f'{lang}-{kind}']={'fullPages':len(r.pages),'publicPages':3,'selected':indices}
 daily=PdfReader(root/'output/sample-source'/lang/'daily.pdf');assert len(daily.pages)==1,(lang,'daily must be 1 page')
 summary[f'{lang}-daily']={'pages':1}
(root/'output/public-sample-validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False))
