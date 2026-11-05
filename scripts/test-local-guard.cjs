/** No database or network: exercise only guarded child-process contracts. */
const {execFileSync}=require('node:child_process');
const {resolve}=require('node:path');
const code=`const assert=require('node:assert/strict');const{promisify}=require('node:util');const cp=require('node:child_process');(async()=>{
 const out=await promisify(cp.execFile)('/usr/bin/printf',['reader-result'],{encoding:'buffer'});assert(Buffer.isBuffer(out.stdout));assert.equal(out.stdout.toString(),'reader-result');assert(Buffer.isBuffer(out.stderr));
 const shell=await promisify(cp.exec)('printf shell-result');assert.equal(shell.stdout,'shell-result');
 await assert.rejects(async()=>promisify(cp.execFile)('/usr/bin/curl',['https://letsrace.cz']),/local-guard: blocked/);
 await assert.rejects(async()=>promisify(cp.exec)('curl https://letsrace.cz'),/local-guard: blocked/);
 console.log('PASS buffer stdout/stderr, shell promise, blocked direct and promisified commands');
})().catch(e=>{console.error(e.message);process.exit(1)});`;
process.stdout.write(execFileSync(process.execPath,['-e',code],{encoding:'utf8',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54331',NODE_OPTIONS:`--require ${resolve('scripts/local-guard.cjs')}`}}));
