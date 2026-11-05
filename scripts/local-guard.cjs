/**
 * Loaded into every process of a local pass (NODE_OPTIONS=--require). A local pass
 * may read organisers' websites, but it must never reach our server, send a message
 * or publish anything. Stop the process rather than risk it. This also covers commands it
 * starts, such as curl, and points those hosts nowhere for any Chrome it opens.
 */
const childProcess = require('node:child_process');
const http = require('node:http');
const https = require('node:https');
const { promisify } = require('node:util');

const FORBIDDEN = /(?:^|\.)(?:supabase\.co|supabase\.com|letsrace\.cz|vercel\.app|vercel\.com|resend\.com|sendgrid\.net|slack\.com)$/i;
const AI = /(?:^|\.)(?:anthropic\.com|openai\.com)$/i;
const LOCAL = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/;

const database = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!LOCAL.test(database)) {
  console.error('local-guard: the database address is not on this computer; stopping.');
  process.exit(78);
}

function refused(raw) {
  let host = '';
  try { host = new URL(String(raw)).hostname; } catch { return null; }
  if (FORBIDDEN.test(host)) return `local-guard: blocked a request to ${host}`;
  if (AI.test(host) && process.env.LOCAL_ALLOW_AI !== '1') return `local-guard: blocked an AI request to ${host}`;
  return null;
}

// External tools take their target as an argument, so that is where to look for it.
const FORBIDDEN_IN_ARGUMENT = /(?:^|[/@.])(?:[a-z0-9-]+\.)*(?:supabase\.co|supabase\.com|letsrace\.cz|vercel\.app|vercel\.com|resend\.com|sendgrid\.net|slack\.com)(?:[:/?#]|$)/i;
const CHROME_BLOCK = '--host-resolver-rules=' + ['*.supabase.co', '*.supabase.com', 'letsrace.cz', '*.letsrace.cz', '*.vercel.app', '*.vercel.com', '*.resend.com', 'resend.com', '*.slack.com', 'slack.com']
  .map(host => `MAP ${host} ~NOTFOUND`).join(', ');

function checkedArguments(command, args) {
  const list = Array.isArray(args) ? args : [];
  const blocked = [command, ...list].find(item => typeof item === 'string' && FORBIDDEN_IN_ARGUMENT.test(item));
  if (blocked) throw new Error(`local-guard: blocked a command aimed at ${blocked.slice(0, 80)}`);
  return /chrome|chromium/i.test(String(command)) ? [...list, CHROME_BLOCK] : args;
}
for (const method of ['spawn', 'execFile', 'spawnSync', 'execFileSync']) {
  const real = childProcess[method];
  const guarded = function guardedCommand(command, args, ...rest) {
    return real.call(this, command, checkedArguments(command, args), ...rest);
  };
  // Node's execFile has a custom promise result {stdout, stderr}. Dropping it
  // makes promisify return just stdout and breaks the curl document reader.
  // Check arguments again rather than copying the original unguarded shortcut.
  if (real[promisify.custom]) guarded[promisify.custom] = function(command, args, ...rest) {
    return real[promisify.custom].call(this, command, checkedArguments(command, args), ...rest);
  };
  childProcess[method] = guarded;
}
for (const method of ['exec', 'execSync']) {
  const real = childProcess[method];
  const guarded = function guardedShell(command, ...rest) {
    checkedArguments(command, []);
    return real.call(this, command, ...rest);
  };
  if (real[promisify.custom]) guarded[promisify.custom] = function(command, ...rest) {
    checkedArguments(command, []);
    return real[promisify.custom].call(this, command, ...rest);
  };
  childProcess[method] = guarded;
}

const realFetch = globalThis.fetch;
globalThis.fetch = function guardedFetch(input, init) {
  const target = input instanceof Request ? input.url : input;
  const reason = refused(target);
  return reason ? Promise.reject(new Error(reason)) : realFetch(input, init);
};

for (const [protocol, module] of [['http:', http], ['https:', https]]) {
  for (const method of ['request', 'get']) {
    const real = module[method];
    module[method] = function guardedRequest(first, ...rest) {
      const target = typeof first === 'string' || first instanceof URL ? first : `${protocol}//${first?.hostname ?? first?.host ?? ''}`;
      const reason = refused(target);
      if (reason) throw new Error(reason);
      return real.call(this, first, ...rest);
    };
  }
}

// `import { spawn } from 'node:child_process'` must see the guarded versions too.
require('node:module').syncBuiltinESMExports();
