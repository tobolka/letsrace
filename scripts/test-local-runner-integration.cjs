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
  child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));

  // Use the managed scheduler, with a fake cycle in a separate runtime directory.
  const scripts=path.join(data,'runtime','scripts');
  fs.mkdirSync(scripts,{recursive:true});
  for(const name of ['local-runner.cjs','local-schedule.cjs','agent-discovery.cjs']){
   fs.copyFileSync(path.join(__dirname,name),path.join(scripts,name));
  }
  const report={state:'finished',progressed:true,readSources:1,nextWorkAt:'2090-01-01T00:00:00Z'};
  fs.writeFileSync(path.join(scripts,'local-cycle.sh'),"echo 'local_cycle_result "+JSON.stringify(report)+"'\n");
  child=spawn(process.execPath,[path.join(scripts,'local-runner.cjs')],{env:{...process.env,LETSRACE_DATA_DIR:data,LETSRACE_RUN_COMMAND:'',LETSRACE_NO_SERVER_CHECK:'1'},stdio:'ignore'});
  await until(()=>read('monitor.json').pid===child.pid);
  assert.equal(read('monitor.json').childPid,null);
  const answers=path.join(data,'agent','answers');
  fs.mkdirSync(answers,{recursive:true});
  fs.writeFileSync(path.join(answers,'practical-1234abcd.json'),'{}');
  await until(()=>read('monitor.json').lastResult?.reads===1);
  const first=read('monitor.json').lastResult.at;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const inbox=require('./agent-discovery.cjs').submissionPath(data,day);
  fs.mkdirSync(path.dirname(inbox),{recursive:true});
  fs.writeFileSync(inbox,'[]');
  await until(()=>read('monitor.json').lastResult?.at>first);
  assert.equal(read('runner-state.json').history.length,2);
  console.log('PASS: a new Codex answer and a website submission each wake an otherwise idle collector');

 }finally{
  if(child?.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
  fs.rmSync(data,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
