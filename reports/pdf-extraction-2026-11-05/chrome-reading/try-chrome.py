# Free and read-only: do pages that came back nearly empty show their content in a normal browser?
# Pages that ask to verify the visitor are left alone, that is not ours to pass.
import json,sys,subprocess,re,html,tempfile,shutil,os
from concurrent.futures import ThreadPoolExecutor
d=sys.argv[1]; out=sys.argv[2]
u=[x for x in json.load(open(d+'/unresolved.json')) if x.get('status')==200 and (x.get('textLength') or 0)<400]
seen=set(); rows=[]
for x in u:
    if x['url'] not in seen: seen.add(x['url']); rows.append(x['url'])
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHALLENGE=re.compile(r'verifying you|verify you are|security checkpoint|attention required|captcha|checking your browser|just a moment|ověřujeme|are being redirected',re.I)
def read(url):
    prof=tempfile.mkdtemp(prefix='lr-chrome-')
    try:
        p=subprocess.run([CHROME,'--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-sync',f'--user-data-dir={prof}','--virtual-time-budget=8000','--dump-dom',url],capture_output=True,timeout=45)
        h=p.stdout.decode('utf8','ignore')
    except Exception as e: return dict(url=url,error=str(e)[:60])
    finally: shutil.rmtree(prof,ignore_errors=True)
    t=html.unescape(re.sub(r'<[^>]+>',' ',re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>|<noscript[\s\S]*?</noscript>',' ',h)));t=re.sub(r'\s+',' ',t).strip()
    return dict(url=url,length=len(t),challenge=bool(CHALLENGE.search(t[:600])),y2027=len(re.findall(r'2027',t)),pdf=len(re.findall(r'href="[^"]+\.pdf',h,re.I)),head=t[:110])
with ThreadPoolExecutor(4) as ex: res=list(ex.map(read,rows))
json.dump(res,open(out,'w'),ensure_ascii=False,indent=1)
ok=[r for r in res if r.get('length',0)>=400 and not r.get('challenge')]
print('pages',len(res),'now readable',len(ok),'challenge',sum(1 for r in res if r.get('challenge')),'with 2027',sum(1 for r in ok if r['y2027']),'with pdf',sum(1 for r in ok if r['pdf']))
for r in ok[:25]: print(r['length'],r['y2027'],r['pdf'],r['url'][:48],'|',r['head'][:60])
