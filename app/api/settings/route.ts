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

export interface AlertSettings {
  newBest:         boolean
  milestones:      boolean
  milestoneValues: number[]   // e.g. [25, 50, 75, 90]
  blockCandidate:  boolean
  workerOffline:   boolean
  offlineThresholdMin: number // minutes before offline alert fires
}

export interface PersistedSettings {
  apiUrl:        string
  btcApiUrl:     string
  xecApiUrl:     string
  discordUrl:    string
  pollMs:        number
  alertSettings: AlertSettings
  showBch:       boolean
  showBtc:       boolean
  showXec:       boolean
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  newBest:             true,
  milestones:          true,
  milestoneValues:     [25, 50, 75, 90],
  blockCandidate:      true,
  workerOffline:       true,
  offlineThresholdMin: 10,
}

function defaults(): PersistedSettings {
  return {
    apiUrl:        process.env.AXEBCH_API_URL      ?? '',
    btcApiUrl:     process.env.AXEBTC_API_URL      ?? '',
    xecApiUrl:     process.env.AXEXEC_API_URL      ?? '',
    discordUrl:    process.env.DISCORD_WEBHOOK_URL ?? '',
    pollMs:        15000,
    alertSettings: DEFAULT_ALERT_SETTINGS,
    showBch:       true,
    showBtc:       true,
    showXec:       true,
  }
}

function mergeAlertSettings(saved?: Partial<AlertSettings>): AlertSettings {
  if (!saved) return DEFAULT_ALERT_SETTINGS
  return {
    newBest:             saved.newBest             ?? DEFAULT_ALERT_SETTINGS.newBest,
    milestones:          saved.milestones          ?? DEFAULT_ALERT_SETTINGS.milestones,
    milestoneValues:     Array.isArray(saved.milestoneValues) ? saved.milestoneValues : DEFAULT_ALERT_SETTINGS.milestoneValues,
    blockCandidate:      saved.blockCandidate      ?? DEFAULT_ALERT_SETTINGS.blockCandidate,
    workerOffline:       saved.workerOffline       ?? DEFAULT_ALERT_SETTINGS.workerOffline,
    offlineThresholdMin: saved.offlineThresholdMin ?? DEFAULT_ALERT_SETTINGS.offlineThresholdMin,
  }
}

export function loadSettings(): PersistedSettings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = readFileSync(SETTINGS_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>
      const d = defaults()
      return {
        apiUrl:        parsed.apiUrl     ?? d.apiUrl,
        btcApiUrl:     parsed.btcApiUrl  ?? d.btcApiUrl,
        xecApiUrl:     parsed.xecApiUrl  ?? d.xecApiUrl,
        discordUrl:    parsed.discordUrl ?? d.discordUrl,
        pollMs:        parsed.pollMs     ?? d.pollMs,
        alertSettings: mergeAlertSettings(parsed.alertSettings),
        showBch:       parsed.showBch    ?? d.showBch,
        showBtc:       parsed.showBtc    ?? d.showBtc,
        showXec:       parsed.showXec    ?? d.showXec,
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
      apiUrl:        typeof body.apiUrl     === 'string' ? body.apiUrl.trim()     : current.apiUrl,
      btcApiUrl:     typeof body.btcApiUrl  === 'string' ? body.btcApiUrl.trim()  : current.btcApiUrl,
      xecApiUrl:     typeof body.xecApiUrl  === 'string' ? body.xecApiUrl.trim()  : current.xecApiUrl,
      discordUrl:    typeof body.discordUrl === 'string' ? body.discordUrl.trim() : current.discordUrl,
      pollMs:        typeof body.pollMs     === 'number' ? Math.max(5000, body.pollMs) : current.pollMs,
      alertSettings: body.alertSettings ? mergeAlertSettings(body.alertSettings) : current.alertSettings,
      showBch:       typeof body.showBch    === 'boolean' ? body.showBch : current.showBch,
      showBtc:       typeof body.showBtc    === 'boolean' ? body.showBtc : current.showBtc,
      showXec:       typeof body.showXec    === 'boolean' ? body.showXec : current.showXec,
    }
    saveSettings(updated)
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
