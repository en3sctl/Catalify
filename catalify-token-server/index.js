'use strict'

// Çatalify developer-token server.
//
// Signs Apple Music JWTs on demand and serves them to the Çatalify
// desktop clients over HTTPS. The .p8 private key stays on this VPS —
// never bundled into the installer, never shipped to end users.
//
// Deploy: `npm install && pm2 start index.js --name catalify-token`
// Front it with an HTTPS reverse proxy (nginx / Caddy / Cloudflare).

const fs = require('fs')
const path = require('path')
const express = require('express')
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')

require('dotenv').config()

const PORT = Number(process.env.PORT) || 3000
const TEAM_ID = process.env.APPLE_TEAM_ID
const KEY_ID = process.env.APPLE_KEY_ID
const KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH
const TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS) || 60 * 60 * 24 * 150

if (!TEAM_ID || !KEY_ID || !KEY_PATH) {
  console.error(
    '[catalify-token] Missing config. Require APPLE_TEAM_ID, APPLE_KEY_ID, ' +
      'APPLE_PRIVATE_KEY_PATH in .env',
  )
  process.exit(1)
}

const resolvedKeyPath = path.resolve(KEY_PATH)
if (!fs.existsSync(resolvedKeyPath)) {
  console.error(`[catalify-token] private key not found at ${resolvedKeyPath}`)
  process.exit(1)
}

// Sign once, cache until it's close to expiry. JWTs are deterministic-ish
// given the same exp, so there's no benefit to minting a fresh one per
// request — even at 150 days, you'll re-sign roughly once every 4 months.
let cache = null

function currentToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cache && cache.exp - now > 60 * 60 * 24) return cache.token

  const privateKey = fs.readFileSync(resolvedKeyPath, 'utf8')
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: TTL_SECONDS,
    issuer: TEAM_ID,
    header: { alg: 'ES256', kid: KEY_ID },
  })
  cache = { token, exp: now + TTL_SECONDS }
  console.log(`[catalify-token] minted new JWT, expires in ${TTL_SECONDS}s`)
  return cache.token
}

const app = express()

// Behind nginx / Cloudflare we need to trust the proxy so rate-limit
// keys per real client IP instead of the loopback proxy address.
app.set('trust proxy', 1)

// Very permissive CORS — the Electron renderer's origin is app:// in
// production and http://localhost:5173 in dev. No cookies involved.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// A public endpoint is fine for Apple Music dev tokens (Apple's own
// web player exposes theirs in browser devtools), but cap it so a bot
// can't burn our rate limit. 60 reqs / minute / IP is generous.
app.use(
  '/musickit-token',
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many token requests, slow down.' },
  }),
)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/musickit-token', (_req, res) => {
  try {
    res.json({ token: currentToken(), ttl: TTL_SECONDS })
  } catch (err) {
    console.error('[catalify-token] signing failed', err)
    res.status(500).json({ error: 'Token generation failed' })
  }
})

app.listen(PORT, () => {
  console.log(`[catalify-token] listening on :${PORT}`)
})
