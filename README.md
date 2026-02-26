# AxeBCH Mining Dashboard

A self-hosted solo mining monitor for AxeBCH / Bitcoin Cash. Pulls live data directly from your node over LAN — no Cloudflare proxy cookie required.

## Features

- Live worker stats: hashrate, best share, accepted/rejected, last share time
- ATH (all-time high share) detection per worker with badge highlighting
- Progress-to-block bar with 25 / 50 / 75 / 90% milestone markers
- ETA countdown and block height tracking
- Discord webhook alerts for:
  - Worker offline
  - Progress milestones
  - Block found
  - New worker ATH
- Auto-polls every 15 seconds (configurable)

## Quick Start (Docker)

```bash
git clone https://github.com/MikeyRock/v0-miner-data-app
cd v0-miner-data-app

cp .env.example .env
# Edit .env — set AXEBCH_API_URL and optionally DISCORD_WEBHOOK_URL

docker compose up -d --build
```

Dashboard opens at **http://localhost:3080**

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AXEBCH_API_URL` | `http://192.168.0.117:21212/api/node` | Your AxeBCH node API endpoint |
| `DISCORD_WEBHOOK_URL` | _(blank)_ | Discord webhook for alerts — leave blank to disable |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `15000` | Browser poll interval in milliseconds |
| `NEXT_PUBLIC_OFFLINE_THRESHOLD_S` | `300` | Seconds before a worker is flagged offline |
| `APP_PORT` | `3080` | Host port to expose the dashboard on |

## Install on Umbrel

1. Clone the repo onto your Umbrel box:
   ```bash
   git clone https://github.com/MikeyRock/v0-miner-data-app ~/umbrel/apps/axebch-dashboard
   ```
2. Copy and edit the env file:
   ```bash
   cp .env.example .env
   nano .env
   ```
3. Start the container:
   ```bash
   docker compose up -d --build
   ```
4. Access at **http://umbrel.local:3080**

## Discord Webhook Setup

1. In your Discord server: **Server Settings → Integrations → Webhooks → New Webhook**
2. Copy the webhook URL
3. Paste it into your `.env` as `DISCORD_WEBHOOK_URL`
4. Restart the container: `docker compose restart`
