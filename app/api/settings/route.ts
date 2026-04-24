import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Try /data first (mounted volume), fall back to /tmp if not writable
function resolveSettingsFile(): string {
  const candidates = [
    process.env.SETTINGS_DIR,
    '/data',
    '/tmp/axe-dashboard',
  ].filter(Boolean) as string[]

  for (const dir of candidates) {
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const testFile = join(dir, '.write-test')
      writeFileSync(testFile, 'ok', 'utf-8')
      return join(dir, 'settings.json')
    } catch {
      // Try next candidate
    }
  }
  return join('/tmp', 'settings.json')
}

const SETTINGS_FILE = resolveSettingsFile()

export interface PersistedSettings {
  apiUrl:      string
  btcApiUrl:   string
  discordUrl:  string
  pollMs:      number
}

function defaults(): PersistedSettings {
  return {
    apiUrl:     process.env.AXEBCH_API_URL      ?? '',
    btcApiUrl:  process.env.AXEBTC_API_URL      ?? '',
    discordUrl: process.env.DISCORD_WEBHOOK_URL ?? '',
    pollMs:     15000,
  }
}

export function loadSettings(): PersistedSettings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = readFileSync(SETTINGS_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>
      const d = defaults()
      return {
        apiUrl:     parsed.apiUrl     ?? d.apiUrl,
        btcApiUrl:  parsed.btcApiUrl  ?? d.btcApiUrl,
        discordUrl: parsed.discordUrl ?? d.discordUrl,
        pollMs:     parsed.pollMs     ?? d.pollMs,
      }
    }
  } catch {
    // Fall through to defaults
  }
  return defaults()
}

function saveSettings(s: PersistedSettings): void {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8')
  } catch (e) {
    console.error('[settings] Failed to write settings:', e)
  }
}

export async function GET() {
  return NextResponse.json(loadSettings())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<PersistedSettings>
    const current = loadSettings()
    const updated: PersistedSettings = {
      apiUrl:     typeof body.apiUrl     === 'string' ? body.apiUrl.trim()     : current.apiUrl,
      btcApiUrl:  typeof body.btcApiUrl  === 'string' ? body.btcApiUrl.trim()  : current.btcApiUrl,
      discordUrl: typeof body.discordUrl === 'string' ? body.discordUrl.trim() : current.discordUrl,
      pollMs:     typeof body.pollMs     === 'number' ? Math.max(5000, body.pollMs) : current.pollMs,
    }
    saveSettings(updated)
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
