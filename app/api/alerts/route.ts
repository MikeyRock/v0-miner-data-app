import { NextRequest, NextResponse } from 'next/server'

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? ''

interface AlertPayload {
  type: 'block_found' | 'worker_offline' | 'milestone' | 'ath'
  workerName?: string
  bestShare?: string
  blockDiff?: string
  height?: number
  progressPercent?: number
  etaDays?: number
  etaHours?: number
  lastShareAgo?: number
  discordWebhookUrl?: string
  _test?: boolean
}

function buildEmbed(payload: AlertPayload) {
  const ts = Math.floor(Date.now() / 1000)

  if (payload._test) {
    return {
      embeds: [
        {
          title: 'AxeBCH Dashboard — Test Alert',
          description: 'Your Discord webhook is working correctly. You will receive mining alerts here.',
          color: 0xf7931a,
          footer: { text: 'AxeBCH Solo Node • Test Message' },
          timestamp: new Date().toISOString(),
        },
      ],
    }
  }

  switch (payload.type) {
    case 'ath':
      return {
        embeds: [
          {
            title: 'NEW WORKER ATH',
            color: 0xf7931a, // Bitcoin orange
            fields: [
              { name: 'Worker', value: payload.workerName ?? 'Unknown', inline: true },
              { name: 'Best Share', value: payload.bestShare ?? '?', inline: true },
              { name: 'Block Diff', value: payload.blockDiff ?? '?', inline: true },
            ],
            footer: { text: 'AxeBCH Solo Node' },
            timestamp: new Date().toISOString(),
          },
        ],
      }

    case 'block_found':
      return {
        embeds: [
          {
            title: 'BLOCK FOUND!',
            description: `Block **#${payload.height}** solved!`,
            color: 0x22c55e,
            footer: { text: 'AxeBCH Solo Node' },
            timestamp: new Date().toISOString(),
          },
        ],
      }

    case 'milestone':
      return {
        embeds: [
          {
            title: `Progress Milestone: ${payload.progressPercent}%`,
            description: `Pool is ${payload.progressPercent}% of the way to solving the next block.\nETA: ${payload.etaDays}d ${payload.etaHours}h`,
            color: 0xeab308,
            footer: { text: 'AxeBCH Solo Node' },
            timestamp: new Date().toISOString(),
          },
        ],
      }

    case 'worker_offline':
      return {
        embeds: [
          {
            title: 'Worker Offline',
            description: `Worker **${payload.workerName}** has not submitted a share in ${Math.floor((payload.lastShareAgo ?? 0) / 60)} minutes.`,
            color: 0xef4444,
            footer: { text: 'AxeBCH Solo Node' },
            timestamp: new Date().toISOString(),
          },
        ],
      }

    default:
      return { content: `Mining alert at <t:${ts}:T>` }
  }
}

export async function POST(req: NextRequest) {
  const payload: AlertPayload = await req.json()
  // Accept webhook URL from the request body (set via Settings drawer) or fall back to env var
  const webhookUrl = payload.discordWebhookUrl || DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    return NextResponse.json({ error: 'No Discord webhook URL configured' }, { status: 503 })
  }

  const body = buildEmbed(payload)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Discord returned ${res.status}: ${text}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
