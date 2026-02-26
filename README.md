# AxeBCH Mining Dashboard

A self-hosted dashboard for your AxeBCH Solo Mining Node. Shows live worker stats, pool hashrate across multiple time windows, network difficulty, best share tracking, block progress, ETA, and sends Discord alerts for key events.

Runs on Umbrel (or any Docker host) with **direct LAN access** to your AxeBCH node — no Cloudflare proxy or cookie required.

---

## What It Displays

Data pulled directly from your AxeBCH `/api/node` endpoint:

- Active worker count and last share time (across all workers)
- Pool hashrate for 1m / 5m / 15m / 1h / 6h / 24h / 7d windows
- Network difficulty, algorithm, and block height
- Best share since last block reset (with which worker holds it)
- All-time best share record
- Progress to next block (best share / network difficulty)
- ETA to find a block (based on pool hashrate)
- Per-worker: name, hashrate, record best share, last share time, odds, online/offline status

---

## Discord Alerts

Fires a rich embed to your Discord channel when:
- A worker hits a new personal best share (ATH)
- A worker goes offline (no share for 5+ minutes)
- Progress milestones: 25%, 50%, 75%, 90%
- A block is solved

---

## Install on Umbrel

### Prerequisites
- Docker and Docker Compose installed on your Umbrel machine
- AxeBCH node running and reachable on your LAN

### Steps

```bash
# 1. SSH into your Umbrel and clone the repo
git clone https://github.com/MikeyRock/v0-miner-data-app.git
cd v0-miner-data-app

# 2. Create your .env file
cp .env.example .env
nano .env
```

Set at minimum:

```env
AXEBCH_API_URL=http://192.168.0.117:21212/api/node
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
APP_PORT=3080
```

```bash
# 3. Build and start (first run takes a few minutes)
docker compose up -d --build

# 4. Open the dashboard
# http://YOUR_UMBREL_IP:3080
```

The dashboard auto-connects using your `.env` — no manual Settings required.

### Updating

```bash
git pull
docker compose up -d --build
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AXEBCH_API_URL` | *(required)* | Full URL to your AxeBCH `/api/node` endpoint |
| `DISCORD_WEBHOOK_URL` | *(empty)* | Discord webhook URL — leave blank to disable alerts |
| `APP_PORT` | `3080` | Host port to expose the dashboard on |

---

## Discord Webhook Setup

1. In your Discord server: **Server Settings → Integrations → Webhooks → New Webhook**
2. Name it (e.g. "AxeBCH Alerts"), pick a channel, copy the URL
3. Paste it into `.env` as `DISCORD_WEBHOOK_URL`
4. Restart: `docker compose up -d --build`

---

## Run Without Docker (Development)

```bash
npm install
cp .env.example .env.local   # fill in AXEBCH_API_URL
npm run dev
# Open http://localhost:3000
```
