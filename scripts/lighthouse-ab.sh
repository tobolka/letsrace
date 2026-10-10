#!/bin/bash
# usage: run.sh <label> <url> <n>
for i in $(seq 1 $3); do
  npx -y lighthouse@13 "$2" --only-categories=performance $LH_EXTRA --output=json --output-path="$1_$i.json" --chrome-flags="--headless=new" --quiet >/dev/null 2>&1
  python3 -I -c "
import json; r=json.load(open('$1_$i.json')); a=r['audits']
b={x['subpart']:round(x['duration']) for x in a['lcp-breakdown-insight']['details']['items'][0]['items']} if a.get('lcp-breakdown-insight',{}).get('details') else {}
print('$1 $i', round(r['categories']['performance']['score']*100), 'LCP', a['largest-contentful-paint']['displayValue'], 'TBT', a['total-blocking-time']['displayValue'], 'CLS', a['cumulative-layout-shift']['displayValue'], 'renderDelay', b.get('elementRenderDelay'))"
done
