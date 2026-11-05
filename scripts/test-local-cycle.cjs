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
