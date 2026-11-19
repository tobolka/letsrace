import json,sys
S='reports/pdf-extraction-2026-11-05/independent-sample'
exp={x['id']:x for x in json.load(open(f'{S}/{sys.argv[2] if len(sys.argv)>2 else "expected.json"}'))}
for r in json.load(open(f'{S}/{sys.argv[1]}')):
    e=exp.get(r['id'])
    if not e: continue
    c=r.get('checked',{}); det=c.get('details',{})
    print('\n###',e['name'][:42],'| rej',c.get('reasons'))
    for f,v in det.items():
        val=v.get('value')
        if isinstance(val,list):
            s=[(x.get('label') or x.get('name') or '')[:18]+' '+str(x.get('time') or x.get('amount') or x.get('distanceKm') or '') for x in val]; print('  ',f,len(val),v.get('status'),s[:15])
        else: print('  ',f,v.get('status'),val.get('name'),val.get('precision') or '')
