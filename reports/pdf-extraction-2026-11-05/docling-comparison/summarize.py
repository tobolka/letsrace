"""Refresh the checkpoint from completed per-document outputs, without running extraction."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent
manifest=json.loads((root/'manifest.json').read_text())
summary=[]
for item in manifest:
 row={'index':item['index'],'name':item['name'],'url':item['url'],'runs':{}}
 for mode in ['baseline','rapid','vision-full','rapid-full']:
  path=root/f"{mode}-{item['index']:03d}.json"
  if path.exists():row['runs'][mode]=json.loads(path.read_text())
 summary.append(row)
(root/'comparison-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
for mode in ['baseline','rapid','vision-full','rapid-full']:
 runs=[row['runs'][mode] for row in summary if mode in row['runs']]
 print(mode,len(runs),'of',len(manifest),'documents; seconds:',round(sum(r.get('seconds',0) for r in runs),2))
