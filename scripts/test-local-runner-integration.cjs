/** Isolated fake workload: tests heartbeat, pause, manual queue and durable restart. No network or catalogue. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const data=fs.mkdtempSync(path.join(os.tmpdir(),'letsrace-supervisor-'));
const command=path.join(data,'fake.sh');fs.writeFileSync(command,'echo \'pipeline_batch {"reads":4,"created":2,"updated":1,"failed":0}\'\nsleep 1\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const read=name=>JSON.parse(fs.readFileSync(path.join(data,name),'utf8'));
let child;
const start=()=>child=spawn(process.execPath,[path.join(__dirname,'local-runner.cjs')],{env:{...process.env,LETSRACE_DATA_DIR:data,LETSRACE_RUN_COMMAND:command,LETSRACE_NO_SERVER_CHECK:'1',LETSRACE_INTERVAL_MS:'3600000'},stdio:'ignore'});
const until=async check=>{for(let n=0;n<90;n++){try{if(check())return;}catch{}await sleep(500);}throw Error('Timed out waiting for runner');};
(async()=>{
 try{
  fs.writeFileSync(path.join(data,'control.json'),JSON.stringify({paused:true}));start();
  await until(()=>read('monitor.json').status==='paused');
  assert.equal(read('monitor.json').childPid,null);
  fs.writeFileSync(path.join(data,'control.json'),JSON.stringify({paused:false,runNowAt:'test'}));
  await until(()=>read('monitor.json').lastResult?.created===2);
  const result=read('monitor.json');assert.equal(result.lastResult.reads,4);assert.equal(result.lastResult.updated,1);
  assert.ok(Date.now()-Date.parse(result.at)<15000);
  child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));
  start();await until(()=>read('monitor.json').pid===child.pid);
  assert.equal(read('monitor.json').lastResult.created,2);assert.equal(read('monitor.json').childPid,null);
  console.log('PASS: paused startup, manual run, real result counters, fresh heartbeat, restart retains results without duplicate workload');
 }finally{
  if(child?.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
  fs.rmSync(data,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
