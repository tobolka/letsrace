/** Install/update a private runtime and two login agents. No admin rights or Documents access needed at runtime. */
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const cp=require('node:child_process');const crypto=require('node:crypto');
const source=path.resolve(__dirname,'..'),home=os.homedir(),base=path.join(home,'Library/Application Support/LetsRace');
const runtime=path.join(base,'runtime'),data=path.join(base,'data'),agents=path.join(home,'Library/LaunchAgents');
const app=path.join(home,'Applications/LetsRace Monitor.app'),domain=`gui/${process.getuid()}`;
const run=(file,args,opts={})=>cp.execFileSync(file,args,{stdio:'pipe',...opts});
function unload(label){try{run('/bin/launchctl',['bootout',`${domain}/${label}`]);}catch{}}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const string=s=>`<string>${escape(s)}</string>`;
function plist(body){return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${body}</dict></plist>`;}
function installEnv(p){let text=fs.readFileSync(p,'utf8');const line=`LLM_LEDGER_PATH=${JSON.stringify(path.join(data,'llm-budget.json'))}`;text=/^LLM_LEDGER_PATH=/m.test(text)?text.replace(/^LLM_LEDGER_PATH=.*$/m,line):text+`\n# Shared managed collector budget.\n${line}\n`;fs.writeFileSync(p,text,{mode:0o600});fs.chmodSync(p,0o600);}
async function main(){
 if(!fs.existsSync(path.join(source,'tmp/macos-monitor-build/LetsRaceMonitor')))throw Error('Build the native monitor before installing');
 fs.mkdirSync(base,{recursive:true,mode:0o700});fs.mkdirSync(runtime,{recursive:true,mode:0o700});fs.mkdirSync(data,{recursive:true,mode:0o700});
 fs.chmodSync(base,0o700);fs.chmodSync(data,0o700);
 // Pause/update only our previous managed agents. Existing manual loop is retired after snapshot checks.
 const old=JSON.parse(fs.existsSync(path.join(data,'monitor.json'))?fs.readFileSync(path.join(data,'monitor.json'),'utf8'):'{}');
 unload('cz.letsrace.runner');unload('cz.letsrace.monitor');
 // Older direct-binary launches were invisible to macOS app activation. Retire
 // only exact copies of our own panel before switching to Launch Services.
 const panels=run('/bin/ps',['-axo','pid=,comm='],{encoding:'utf8'}).split('\n');
 for(const line of panels){const match=line.trim().match(/^(\d+)\s+(.+)$/);if(match?.[2]===path.join(app,'Contents/MacOS/LetsRaceMonitor')){try{process.kill(Number(match[1]),'SIGTERM');}catch{}}}
 // Do not replace a runtime while its child is still finishing a write.
 for(let i=0;i<100;i++){
  let alive=false;for(const pid of [old.pid,old.childPid])if(pid){try{process.kill(pid,0);alive=true;}catch{}}
  if(!alive)break;
  if(i===99)throw Error('Previous collector is still stopping; retry update in a moment');
  await new Promise(r=>setTimeout(r,100));
 }
 for(const dir of ['src','scripts','docs','public']){
  fs.mkdirSync(path.join(runtime,dir),{recursive:true});run('/usr/bin/rsync',['-a',`${path.join(source,dir)}/`,`${path.join(runtime,dir)}/`]);
 }
 for(const file of ['package.json','package-lock.json','tsconfig.json','.env.local'])fs.copyFileSync(path.join(source,file),path.join(runtime,file));
 fs.mkdirSync(path.join(runtime,'node_modules'),{recursive:true});
 run('/usr/bin/rsync',['-a',`--link-dest=${path.join(source,'node_modules')}`,`${path.join(source,'node_modules')}/`,`${path.join(runtime,'node_modules')}/`]);
 // Initial state migration only; never overwrite a live managed budget on upgrades.
 if(!fs.existsSync(path.join(data,'llm-budget.json'))){
  run('/usr/bin/rsync',['-a','--exclude=pipeline-db-test/','--exclude=macos-monitor-build/',`--link-dest=${path.join(source,'tmp')}`,`${path.join(source,'tmp')}/`,`${data}/`]);
 }
 const runtimeTmp=path.join(runtime,'tmp');if(!fs.existsSync(runtimeTmp))fs.symlinkSync(data,runtimeTmp,'dir');
 installEnv(path.join(source,'.env.local'));installEnv(path.join(runtime,'.env.local'));
 // Confirm the snapshot resolves and can read the existing budget before replacing the loop.
 const probe=run(process.execPath,[path.join(runtime,'scripts/with-node.cjs'),'tsx',path.join(runtime,'scripts/pipeline-status.ts'),'--json'],{cwd:runtime,encoding:'utf8'});JSON.parse(probe);
 const rows=run('/bin/ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).split('\n').flatMap(l=>{const m=l.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);return m?[{pid:Number(m[1]),parent:Number(m[2]),command:m[3]}]:[];});
 for(const row of rows.filter(r=>/^(?:\/bin\/)?bash scripts\/keep-fresh\.sh(?:\s|$)/.test(r.command))){
  let cwd='';try{cwd=run('/usr/sbin/lsof',['-a','-p',String(row.pid),'-d','cwd','-Fn'],{encoding:'utf8'});}catch{}
  if(!cwd.split('\n').includes(`n${source}`))continue;
  const descendants=[];const visit=pid=>{for(const r of rows.filter(r=>r.parent===pid)){visit(r.pid);descendants.push(r.pid);}};visit(row.pid);
  for(const pid of [...descendants,row.pid]){try{process.kill(pid,'SIGTERM');}catch{}}
 }
 fs.mkdirSync(path.join(app,'Contents/MacOS'),{recursive:true});
 fs.copyFileSync(path.join(source,'tmp/macos-monitor-build/LetsRaceMonitor'),path.join(app,'Contents/MacOS/LetsRaceMonitor'));fs.chmodSync(path.join(app,'Contents/MacOS/LetsRaceMonitor'),0o755);
 fs.writeFileSync(path.join(app,'Contents/Info.plist'),plist('<key>CFBundleIdentifier</key><string>cz.letsrace.monitor</string><key>CFBundleName</key><string>LetsRace Monitor</string><key>CFBundleDisplayName</key><string>LetsRace Monitor</string><key>CFBundleExecutable</key><string>LetsRaceMonitor</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleVersion</key><string>1</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/><key>LSMinimumSystemVersion</key><string>14.0</string>'));
 run('/usr/bin/codesign',['--force','--deep','--sign','-',app]);
 fs.mkdirSync(agents,{recursive:true});
 const environment=`<key>EnvironmentVariables</key><dict><key>LETSRACE_DATA_DIR</key>${string(data)}<key>LETSRACE_NODE_PATH</key>${string(process.execPath)}</dict>`;
 const runner=plist(`<key>Label</key><string>cz.letsrace.runner</string><key>ProgramArguments</key><array><string>/bin/bash</string>${string(path.join(runtime,'scripts/launch-local-runner.sh'))}</array><key>WorkingDirectory</key>${string(runtime)}${environment}<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>ExitTimeOut</key><integer>15</integer><key>ProcessType</key><string>Standard</string><key>StandardOutPath</key>${string(path.join(data,'agent.log'))}<key>StandardErrorPath</key>${string(path.join(data,'agent.log'))}`);
 const monitor=plist(`<key>Label</key><string>cz.letsrace.monitor</string><key>ProgramArguments</key><array><string>/bin/bash</string>${string(path.join(runtime,'scripts/launch-monitor.sh'))}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>30</integer><key>ProcessType</key><string>Interactive</string><key>StandardOutPath</key>${string(path.join(data,'menu.log'))}<key>StandardErrorPath</key>${string(path.join(data,'menu.log'))}`);
 for(const [label,content] of [['cz.letsrace.runner',runner],['cz.letsrace.monitor',monitor]]){const file=path.join(agents,`${label}.plist`);fs.writeFileSync(file,content,{mode:0o644});run('/usr/bin/plutil',['-lint',file]);}
 const manifest={installedAt:new Date().toISOString(),source,runtime,data,app,node:process.execPath,sourceVersion:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'scripts/local-runner.cjs'))).digest('hex')};fs.writeFileSync(path.join(base,'installation.json'),JSON.stringify(manifest,null,2),{mode:0o600});
 run('/bin/launchctl',['bootstrap',domain,path.join(agents,'cz.letsrace.runner.plist')]);
 run('/bin/launchctl',['bootstrap',domain,path.join(agents,'cz.letsrace.monitor.plist')]);
 console.log(JSON.stringify({installed:true,...manifest,credentials:'private file, never shown'},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
