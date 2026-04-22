const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const configuredKeyPath = process.env.APPLE_PRIVATE_KEY_PATH;

function resolveKeyPath(configured) {
  const candidates = [];
  if (configured) candidates.push(configured);
  candidates.push(path.join(process.cwd(), 'AuthKey_BQJDU99MSG.p8'));
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'AuthKey_BQJDU99MSG.p8'));
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  throw new Error(`Private key file not found. Tried: ${candidates.join(', ')}`);
}

function findConfigPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = [
    path.join(appData, 'bombomusic', 'config.json'),
    path.join(appData, 'BomboMusic', 'config.json'),
    path.join(appData, 'bombomusic', 'Config.json'),
    path.join(appData, 'Bombo Music', 'config.json')
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return null;
}

function extractUserToken(obj) {
  const queue = [obj];
  const seen = new Set();
  const tokenRegex = /^[A-Za-z0-9\-_.=]{40,}$/;
  const keyHints = ['musicUserToken', 'music_user_token', 'appleMusicUserToken', 'apple_music_user_token', 'userToken', 'appleUserToken'];

  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    for (const [k, v] of Object.entries(cur)) {
      const key = String(k).toLowerCase();
      if (typeof v === 'string') {
        if (keyHints.some(h => key.includes(h.toLowerCase())) && v.trim().length > 20) return v.trim();
        if (key.includes('token') && key.includes('music') && v.trim().length > 20) return v.trim();
        if (key.includes('token') && tokenRegex.test(v.trim())) return v.trim();
      } else if (v && typeof v === 'object') {
        queue.push(v);
      }
    }
  }
  return null;
}

function parseTopLevelError(body) {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body.errors) && body.errors.length) {
    const e = body.errors[0] || {};
    return { code: e.code || '', title: e.title || '', detail: e.detail || '' };
  }
  if (body.error && typeof body.error === 'object') {
    const e = body.error;
    return { code: e.code || '', title: e.title || '', detail: e.detail || '' };
  }
  return null;
}

async function callEndpoint(endpoint, devToken, userToken) {
  const url = `https://api.music.apple.com${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${devToken}`,
      'Music-User-Token': userToken
    }
  });

  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  const err = parseTopLevelError(parsed);
  const msg = err ? ` | error: code=${err.code || '-'} title=${err.title || '-'} detail=${err.detail || '-'}` : '';
  console.log(`${endpoint} | ${res.status}${msg}`);
}

(async () => {
  if (!teamId || !keyId) throw new Error('APPLE_TEAM_ID / APPLE_KEY_ID missing in .env');

  const keyPath = resolveKeyPath(configuredKeyPath);
  const privateKey = fs.readFileSync(keyPath, 'utf8');
  const devToken = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    issuer: teamId,
    header: { alg: 'ES256', kid: keyId }
  });

  const configPath = findConfigPath();
  if (!configPath) {
    console.log('Token file missing: could not find electron-store config.json under %APPDATA%\\bombomusic (or nearby likely paths).');
    return;
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.log(`Token file found but unreadable: ${configPath}`);
    return;
  }

  const userToken = extractUserToken(cfg);
  if (!userToken) {
    console.log(`Token file found but Music-User-Token missing: ${configPath}`);
    return;
  }

  const endpoints = [
    '/v1/me/storefront',
    '/v1/me/library/songs?limit=1',
    '/v1/me/recent/played?limit=1',
    '/v1/me/history/heavy-rotation?limit=1',
    '/v1/me/recommendations?limit=1',
    '/v1/me/subscriptions'
  ];

  for (const ep of endpoints) {
    try {
      await callEndpoint(ep, devToken, userToken);
    } catch (e) {
      console.log(`${ep} | request_failed | error: code=- title=RequestFailed detail=${(e && e.message) ? e.message.replace(/\s+/g, ' ') : String(e)}`);
    }
  }
})();
