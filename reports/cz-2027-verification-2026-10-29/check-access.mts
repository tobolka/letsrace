import {readFile} from 'node:fs/promises';import {parse} from 'dotenv';
const env=parse(await readFile('.env.local','utf8'));
const r=await fetch('https://letsrace.cz/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:env.ADMIN_PASSWORD})});
console.log({status:r.status,ok:(await r.json()).ok,cookiePresent:!!r.headers.get('set-cookie')});
