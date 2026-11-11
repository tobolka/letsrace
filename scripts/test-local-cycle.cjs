const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {acquireLock}=require('./local-cycle.cjs');
const {spawn}=require('node:child_process');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'letsrace-cycle-lock-'));const file=path.join(directory,'lock');
try{
 const release=acquireLock(file);assert.throws(()=>acquireLock(file),/už běží/);release();assert(!fs.existsSync(file));
 fs.writeFileSync(file,JSON.stringify({pid:2147483647}));const releaseStale=acquireLock(file);assert.equal(JSON.parse(fs.readFileSync(file)).pid,process.pid);releaseStale();
 fs.writeFileSync(file,'{}');assert.throws(()=>acquireLock(file),/Nečitelný/);
 console.log('PASS: one local cycle, stale-owner recovery, fail closed on invalid lock');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
// A collector can handle SIGTERM and exit 2 (ordinary deferred work). That must
// still stop the coordinator, rather than allowing the following upload stage.
const code=`const {run}=require(${JSON.stringify(require.resolve('./local-cycle.cjs'))});
run(process.execPath,['-e',"process.on('SIGTERM',()=>process.exit(2));console.log('ready');setInterval(()=>{},1000)"],{allowSourceFailures:true}).then(()=>{console.log('UNSAFE_CONTINUATION');process.exitCode=1},()=>console.log('STOPPED'));`;
const child=spawn(process.execPath,['-e',code],{stdio:['ignore','pipe','pipe']});let output='';
const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
child.stdout.on('data',b=>{output+=b;if(output.includes('ready')&&!output.includes('STOPPED'))child.kill('SIGTERM');});
child.once('exit',code=>{clearTimeout(timer);assert.equal(code,0);assert.ok(output.includes('STOPPED'));assert.ok(!output.includes('UNSAFE_CONTINUATION'));console.log('PASS: stopping a deferred collector cannot continue to upload');});
// The shared AI allowance, read the way the readers charge it, and the wait for a new day.
{
 const {aiAllowanceLeft,nextPragueDay,run}=require('./local-cycle.cjs');
 const evening=new Date('2026-11-09T20:15:00Z');
 assert.ok(Math.abs(aiAllowanceLeft({days:{'2026-11-09':0.498},months:{'2026-11':3.04},holds:{}},evening,{})-0.002)<1e-9);
 assert.equal(aiAllowanceLeft({},evening,{}),0.5);
 assert.ok(Math.abs(aiAllowanceLeft({days:{},months:{'2026-11':4.99},holds:{x:{amount:0.005,day:'2026-11-09',month:'2026-11',at:0}}},evening,{})-0.005)<1e-9);
 const near=(at,iso)=>assert.ok(Math.abs(at-Date.parse(iso))<2500,new Date(at).toISOString());
 near(nextPragueDay(evening.getTime()),'2026-11-09T23:00:00Z');
 near(nextPragueDay(Date.parse('2027-03-28T12:00:00Z')),'2027-03-28T22:00:00Z');
 console.log('PASS: AI allowance left and the start of the next day in Prague');
 // A finished step is not held by something it started that keeps its output open.
 const began=Date.now();
 run(process.execPath,['-e',"require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},8000)'],{stdio:'inherit',detached:true}).unref();console.log('step done')"]).then(result=>{
  assert.equal(result.code,0);assert.ok(result.output.includes('step done'));assert.ok(Date.now()-began<5000);
  console.log('PASS: a finished step is not held by a descendant with its output open');
 });
}
// How a step ended is read from what it says and how it left, not from exit 2 alone.
{
 const {stepOutcome}=require('./local-cycle.cjs');
 assert.deepEqual(stepOutcome({code:0,output:'ok'}),{outcome:'done',reason:null});
 assert.deepEqual(stepOutcome({code:2,output:'saved 30 of 40'}),{outcome:'partial',reason:'own_time_budget'});
 assert.deepEqual(stepOutcome({code:2,output:'x\npipeline_step_deferred {"reason":"phase_time_budget","seconds":780}\n'}),{outcome:'timeout',reason:'timeout'});
 assert.deepEqual(stepOutcome({code:null,timedOut:true,output:''}),{outcome:'timeout',reason:'timeout'});
 assert.deepEqual(stepOutcome({code:1,output:'step_outcome {"outcome":"blocked","reason":"robot_check"}\n'}),{outcome:'blocked',reason:'robot_check'});
 assert.deepEqual(stepOutcome({code:1,output:'step_outcome {"outcome":"nonsense"}\nstep_outcome not json'}),{outcome:'failed',reason:'exit_1'});
 assert.deepEqual(stepOutcome({code:1,output:'boom'}),{outcome:'failed',reason:'exit_1'});
 console.log('PASS: a step outcome tells done, partial, timeout, blocked and failed apart');
}
// A step that keeps failing waits longer each time, stops after the fifth, and comes back on success.
{
 const {holdAfter,heldNow,sleptThrough,FAILURE_DELAYS_MS}=require('./local-cycle.cjs');
 const H=3_600_000,failed={outcome:'failed',reason:'exit_1'};let now=Date.parse('2026-11-12T00:00:00Z'),hold=null;const waits=[];
 for(let i=0;i<6;i++){hold=holdAfter(hold,failed,{now,step:'checkDetails'});waits.push(Date.parse(hold.nextTryAt)-now);assert.ok(heldNow(hold,now+1));assert.equal(hold.stopped,i>=4);now=Date.parse(hold.nextTryAt);}
 assert.deepEqual(waits,[H,6*H,24*H,72*H,168*H,168*H]);assert.equal(hold.failures,6);assert.equal(hold.since,'2026-11-12T00:00:00.000Z');
 assert.ok(!heldNow(hold,now));assert.deepEqual(FAILURE_DELAYS_MS.length,5);
 // Success after the weekly try forgets it all.
 assert.equal(holdAfter(hold,{outcome:'done',reason:null},{now}),null);assert.equal(holdAfter(hold,{outcome:'partial',reason:'own_time_budget'},{now}),null);
 // A spent AI allowance is not a failure, however often it happens, and does not clear earlier ones.
 assert.equal(holdAfter(null,{outcome:'waiting',reason:'ai_budget'},{now}),null);assert.equal(holdAfter(hold,{outcome:'waiting',reason:'ai_budget'},{now}),hold);
 // A time limit counts while the Mac was awake, and not when it slept through it.
 assert.equal(holdAfter(null,{outcome:'timeout',reason:'timeout'},{now}).failures,1);assert.equal(holdAfter(null,{outcome:'timeout',reason:'timeout'},{now,slept:true}),null);
 assert.ok(!sleptThrough(840_000,840_000));assert.ok(sleptThrough(3_300_000,840_000));
 // A shut website: its usual interval, no failures counted, shared by both steps that read it.
 const shut=holdAfter(null,{outcome:'blocked',reason:'robot_check'},{now,every:24*H,step:'radNetNew'});
 assert.equal(shut.failures,0);assert.equal(Date.parse(shut.nextTryAt)-now,24*H);assert.ok(!shut.stopped);assert.ok(heldNow(shut,now+23*H));
 const again=holdAfter(shut,{outcome:'blocked',reason:'robot_check'},{now:now+24*H,every:24*H,step:'radNet'});
 assert.deepEqual(again.steps,['radNetNew','radNet']);assert.equal(again.since,shut.since);
 console.log('PASS: failures back off 1 h to 7 days and stop after five; waiting, sleep and a shut website do not count');
}
