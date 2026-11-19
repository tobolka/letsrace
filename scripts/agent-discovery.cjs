const path = require('node:path');
const { isIP } = require('node:net');

const DISCOVERY_COUNTRIES = ['CZ', 'SK', 'AT', 'DE', 'PL', 'CH', 'IT'];
const MAX_URLS = 5;

function discoveryTarget(day) {
  const index = Math.floor(Date.parse(day + 'T00:00:00Z') / 86_400_000) % DISCOVERY_COUNTRIES.length;
  const year = Number(day.slice(0, 4));
  return { country: DISCOVERY_COUNTRIES[index], season: year + Number(day.slice(5, 7) >= '10') };
}

function submissionPath(data, day, target = discoveryTarget(day)) {
  return path.join(data, 'agent', 'discovery', `${target.country}-${target.season}`, day + '.json');
}

function sourceUrls(input) {
  if (!Array.isArray(input) || input.length > MAX_URLS) throw Error('Expected a JSON array of up to five source URLs');
  const urls = new Set();
  for (const raw of input) {
    if (typeof raw !== 'string' || raw.length > 2048) throw Error('Invalid source URL');
    const url = new URL(raw);
    const host = url.hostname.replace(/\.$/, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port
      || !host.includes('.') || isIP(host) || host.startsWith('[')
      || /(^|\.)(local|localhost|internal|lan|home\.arpa|letsrace\.cz|letsrace\.vercel\.app)$/i.test(host)) {
      throw Error('Expected a public organiser, registration or calendar URL');
    }
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    urls.add(url.toString());
  }
  return [...urls];
}

module.exports = { discoveryTarget, submissionPath, sourceUrls, MAX_URLS };
