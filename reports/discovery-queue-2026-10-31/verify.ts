import { readFile, writeFile } from 'node:fs/promises';
import { isAuxiliaryDiscoveryUrl } from '../../src/lib/watcher/discovery-policy';
async function main(){
const dir=new URL('./',import.meta.url);
const rows=JSON.parse(await readFile(new URL('decisions.json',dir),'utf8'));
const blocked=rows.filter((x:{url:string})=>isAuxiliaryDiscoveryUrl(x.url));
const lost=blocked.filter((x:{status:string})=>x.status==='accepted');
const summary={reviewed:rows.length,auxiliaryLinksBlocked:blocked.length,acceptedSourcesLost:lost.length,blockedByStatus:blocked.reduce((a:Record<string,number>,x:{status:string})=>({...a,[x.status]:(a[x.status]??0)+1}),{}),blockedIndices:blocked.map((x:{i:number})=>x.i)};
await writeFile(new URL('algorithm-replay.json',dir),JSON.stringify(summary,null,2));console.log(summary);
if(lost.length)throw Error('Regression: useful source suppressed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
