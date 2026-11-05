const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');
const binary=path.resolve('tmp/macos-monitor-build/LetsRaceMonitor');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'letsrace-overview-'));
const now=Date.parse('2026-11-01T20:00:00Z'), iso=ms=>new Date(ms).toISOString();
const base={version:1,at:iso(now),pid:1,root:'/test',data:'/test',status:'waiting',paused:false,nextRunAt:now+7200000,counters:{},totals:[],ai:{month:'2026-11',spentUsd:0,monthCapUsd:5,dayCapUsd:0.5,schedule:'Tuesday/Friday'},system:{processes:[]},countries:['CZ'],recent:{created:999,updated:999,failed:999},lastResult:{at:now-60000,created:99,updated:99,failed:0},server:{at:iso(now),checkedAt:iso(now),brokenSources:0,unreadableSources:0,reviewCandidates:0,jobs:[{key:'server-free',started_at:iso(now-2000),finished_at:iso(now-1000),status:'ok',summary:{created:2,updated:4,failed:0}}]}};
function describe(change){const input=structuredClone(base);change?.(input);const file=path.join(folder,'monitor.json');fs.writeFileSync(file,JSON.stringify(input));return JSON.parse(execFileSync(binary,['--describe-snapshot',file,String(now/1000)],{encoding:'utf8'}));}
try{
 let d=describe();assert.equal(d.state.tone,'good');assert.equal(d.lastRun.created,2);assert.equal(d.lastRun.updated,4);assert.ok(!JSON.stringify(d).includes('999')); // no double counting or historical-error alarm
 d=describe(s=>{s.server.brokenSources=2;});assert.equal(d.state.tone,'warning');assert.match(d.state.title,/omezením/);
 d=describe(s=>{s.server.unreadableSources=393;s.server.reviewCandidates=19;});assert.equal(d.state.tone,'warning');assert.match(d.state.title,/ověřování čeká/);assert.match(d.reviewDetail,/19 podkladů/);assert.match(d.reviewDetail,/ještě není zapnuté/);assert.doesNotMatch(d.reviewDetail,/AI.*řeší/);
 d=describe(s=>{s.server.reviewCandidates=1;});assert.match(d.reviewDetail,/1 podklad čeká/);
 d=describe(s=>{s.server.reviewCandidates=3;});assert.match(d.reviewDetail,/3 podklady čekají/);
 d=describe(s=>{s.paused=true;s.status='paused';});assert.equal(d.state.tone,'muted');assert.match(d.state.detail,/pouze pro Mac/);
 d=describe(s=>{s.at=iso(now-121000);});assert.equal(d.state.tone,'warning');assert.match(d.state.title,/Mac se nehlásí/);
 d=describe(s=>{s.server.error='offline';});assert.equal(d.state.tone,'warning');assert.match(d.reviewTitle,/nelze ověřit/);assert.doesNotMatch(d.reviewTitle,/žádná otázka/);
 d=describe(s=>{delete s.server.reviewCandidates;});assert.equal(d.state.tone,'warning');assert.match(d.state.title,/není úplný/);
 d=describe(s=>{s.server.jobs=[];});assert.equal(d.state.tone,'warning');assert.match(d.state.title,/není potvrzená/);
 d=describe(s=>{s.childPid=123;s.status='running';});assert.equal(d.state.tone,'busy');assert.doesNotMatch(d.state.detail,/odhad|zbývá/);
 d=describe(s=>{s.status='attention';s.lastExitCode=1;});assert.match(d.state.title,/nedoběhl/);
 d=describe(s=>{s.server.jobs[0].status='running';s.server.jobs[0].started_at=iso(now-901000);delete s.server.jobs[0].finished_at;});assert.match(d.state.title,/nedokončila/);
 d=describe(s=>{s.pipelineMode='local-new-races';s.cycleResult={state:'finished',heldRaces:13,sourceFailures:0,seconds:29};s.server.jobs=[];});assert.equal(d.state.tone,'good');assert.equal(d.lastRun.created,99);assert.match(d.reviewDetail,/13 nálezů/);assert.match(d.state.detail,/12 hodin/);
 d=describe(s=>{s.pipelineMode='local-new-races';s.cycleResult={state:'finished',heldRaces:2,sourceFailures:30};});assert.equal(d.state.tone,'warning');assert.match(d.state.title,/omezením/);
 d=describe(s=>{s.pipelineMode='local-new-races';s.cycleResult={state:'publication_pending',heldRaces:0,sourceFailures:0};});assert.match(d.state.title,/zobrazení čeká/);
 d=describe(s=>{s.pipelineMode='local-new-races';s.childPid=123;s.stage='Kontroluji nové závody';});assert.equal(d.state.tone,'busy');assert.equal(d.state.detail,'Kontroluji nové závody');
 d=JSON.parse(execFileSync(binary,['--describe-snapshot','-',String(now/1000)],{encoding:'utf8'}));assert.equal(d.state.tone,'warning');assert.equal(d.lastRun,undefined);
 console.log('PASS: 14 owner overview scenarios, latest result without double counting, honest waiting and unavailable states, local pause and real failures');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
