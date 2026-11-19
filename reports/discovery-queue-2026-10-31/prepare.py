import json, hashlib
from pathlib import Path
from urllib.parse import urlsplit
p=Path(__file__).parent
a=json.loads((p/'before.json').read_text())['pending']
f={x['i']:x for x in json.loads((p/'fetch.json').read_text())}
w=json.loads((p/'watched-before.json').read_text())
d={}
def group(indices,status,reason,kind=None):
    for i in indices:
        assert i not in d, i
        r=a[i];s=f[i]
        d[i]={'i':i,'id':r['id'],'url':r['url'],'previousStatus':r['status'],'status':status,'reason':reason,'parentId':r['from_watched_url_id'],'httpStatus':s.get('status'),'finalUrl':s.get('finalUrl'),'title':s.get('title'),'evidenceFile':f'sources/{i}.txt','textHash':hashlib.sha256(s.get('text','').encode()).hexdigest()}
        if kind:d[i]['kind']=kind
group([1,8,11,21,22,37,39,40,42,43,44,53,59,60,64,68,70,73,74,77,78,81,82,86,88,90,95,108,111,127,131,134,157,159,166,173,179,193,196,203], 'accepted', 'Ověřená stránka pořadatele s informacemi o cyklistickém závodu nebo sérii. Sledovat změny; údaje konkrétního ročníku potvrzovat samostatně.', 'race')
group([2,3,4,45,47,132,137,177,187,195], 'accepted', 'Ověřený cyklistický svaz, pořadatel nebo kalendář s konkrétními závody. Používat jako zdroj návrhů; dodržet ověření termínů, identit a podporovaných zemí.', 'calendar')
group([9], 'accepted', 'Stálá adresa aktuálních oficiálních propozic German Pumptrack Series; nyní přesměruje na PDF 2026. Nesledovat zvlášť konečnou ročníkovou adresu.', 'calendar')
group([72], 'accepted', 'Oficiální novinky ČT Author Cup umožňují sledovat oznámení dalších ročníků.', 'calendar')
group([96], 'accepted', 'Opakovaně ověřena funkční adresa https://www.imster-radmarathon.at/; použít tuto ověřenou variantu, původní adresa bez www selhala.', 'race')
d[96]['watchUrl']='https://www.imster-radmarathon.at/'
group([0,7,12,13,14,15,17,18,19,20,23,27,29,30,38,52,56,58,61,62,65,66,97,110,115,116,118,124,136,149,150,156,158], 'ignored', 'Registrace, přihláška nebo startovní listina ke známému závodu; pomocný odkaz, nikoli nový samostatný zdroj závodů.')
group([24,31,32,33,34,35,54,92,98,99,119,120,129,130,154,155,170,171], 'ignored', 'Výsledky, galerie nebo historie; uchovat v historii návrhů, nepřidávat jako zdroj nových závodů.')
group([16,51,57,67,69,71,80,84,101,104,112,140,142,143,144,145,147,148,151,152,161,167], 'ignored', 'Pomocný obsah: mapa, trasa, historie, obchod, tým, sponzoři, kontakt či podmínky. Nejde o nový nezávislý kalendář nebo stránku závodu.')
group([25,48,63,89,94,100,106,126,128,133,138,141,146,153,163,164,174,180,185,199,204,206], 'ignored', 'Duplicitní nebo doplňková stránka známého závodu či zdroje; odpovídající hlavní/oficiální zdroj je již sledován nebo přijat v této kontrole. Ročníkové články a reporty nepřidávat zvlášť.')
group([26,28,87,109,114,117,122,123,162,168,169,172,176,178,181,186,198,200,201,202], 'ignored', 'Archivní či ročníková stránka dokončené sezóny, staré propozice nebo druhotná zpráva. Nejde o potvrzení nového ročníku ani vhodný nový průběžný zdroj.')
group([49,85,121], 'ignored', 'Adresa vede na obecný rozcestník; konkrétní závodní kalendáře tohoto pořadatele či svazu již sledujeme.')
group([46], 'ignored', 'Adresa obsahuje pouze výběr jazyka a text o cookies; bez závodního kalendáře na této konkrétní stránce.')
group([102], 'ignored', 'Tato stránka již existuje jako ručně pozastavený zdroj. Zachovat pozastavení, nevytvářet jeho aktivní variantu.')
group([160], 'ignored', 'Kalendář je dostupný, ale výslovně hlásí No events were found. Hlavní web Okolohor již sledujeme.')
group([175], 'ignored', 'Stránka vrací pouze ochrannou výzvu Please wait while your request is being verified. Kalendáře jednotlivých disciplín Swiss Cycling již existují; zachovat jejich dosavadní stavy.')
group([183,188,190], 'ignored', 'Druhotný zpravodajský článek, nikoli nový oficiální zdroj. Zprávu ani únik kalendáře nezaměňovat za potvrzení pořadatele.')
group([5,6], 'rejected', 'Kolová nebo krasojízda; nejde o cyklistický závod v podporovaných disciplínách katalogu.')
group([55,76,165,182], 'rejected', 'Ověřený obsah je mimo katalog cyklistických závodů: běh, motorový pitbike, pronájem nemovitostí nebo elektroinstalace.')
group([79], 'rejected', 'Bývalá cyklokrosová doména nyní zobrazuje kasino Slotexo. Nepřidávat jako cyklistický zdroj.')
group([10,36,75,91,107,113,135,139,205], 'rejected', 'Konkrétní odkaz vrací 404 nebo výchozí stránku serveru bez závodního obsahu. Hlavní weby pořadatelů tím nejsou odmítnuty.')
group([41,93,191,194], 'ignored', 'Ověřený závod či závody se konají mimo podporované země CZ, SK, DE, AT, CH, IT, PL; nerozšiřovat touto kontrolou geografický rozsah.')
group([184,189,192], 'rejected', 'Zdroj obsahuje modelové odhady termínů podle minulého ročníku (např. Haltern 2027), nikoli pouze výslovně oznámená data. Nevhodné pro automatické přebírání termínů.')
group([197], 'ignored', 'Pořadatel výslovně uvádí Breitensport, kein Rennen: cyklistické setkání a vyjížďky bez závodního charakteru.')
group([103], 'ignored', 'Web má poslední ročník 2024 a oznámení zrušení 2025; nebyl nalezen aktuální ani budoucí závod. Neinterpretovat jako zrušení dalších ročníků.')
group([105], 'pending', 'Opakovaná chyba serveru HTTP 500 i na www variantě. Obsah nelze ověřit; ponechat k opětovnému načtení, závod neodmítat jen kvůli výpadku.')
group([50], 'accepted', 'Stálá stránka oficiálních propozic Okolo Stejskala; hlavní web existuje, zde jsou podrobné podklady pro ověření.', 'race')
group([83], 'accepted', 'Oficiální stránka opakovaného dětského cyklistického závodu v Neunkirchenu; nyní obsahuje informace a výsledky 2026, další ročník nepotvrzen.', 'race')
group([125], 'accepted', 'Varianta www byla úspěšně načtena a obsahuje Pohár KVSC. Sledovat dostupnou ověřenou adresu.', 'calendar')
d[125]['watchUrl']='http://www.bikeri.cz/pohary/pohar-kvsc'
missing=set(range(len(a)))-set(d)
assert not missing,sorted(missing)
def norm(u):
    s=urlsplit(u);return s.netloc.lower().removeprefix('www.')+s.path.rstrip('/')+('?' + s.query if s.query else '')
known={norm(x['url']):x for x in w}
chosen={}
for i,x in sorted(d.items()):
    if x['status']!='accepted':continue
    target=x.get('watchUrl',x['url']); existing=known.get(norm(target)) or known.get(norm(x.get('finalUrl') or target))
    if existing:
        x.update(status='ignored',reason=f"Normalizovaná nebo konečná adresa již existuje jako zdroj ve stavu {existing['status']}; zachovat původní zdroj a jeho stav.",existingSourceId=existing['id'])
    elif norm(target) in chosen:
        x.update(status='ignored',reason='Stejný normalizovaný zdroj již byl přijat v této kontrole.')
    else:chosen[norm(target)]=i
rows=[d[i] for i in range(len(a))]
(p/'decisions.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
from collections import Counter
print(Counter(x['status'] for x in rows))
print('ACCEPT',[(x['i'],x['url']) for x in rows if x['status']=='accepted'])
