export interface WorkerStats {
  workerId: string
  hashrate: number
  hashrateUnit: string
  hashrateRaw: number
  bestShare: number        // record best share difficulty
  bestShareUnit: string
  bestShareRaw: number
  odds: string             // e.g. "60% in 7 days"
  lastShareAgo: number     // seconds since last share
  isOnline: boolean
}

export interface HashrateWindow {
  label: string            // "1m", "5m", "15m", "1h", "6h", "24h", "7d"
  value: number
  unit: string             // "PH/s", "TH/s", etc.
}

export interface NodeStats {
  // Pool
  workerCount: number
  lastShareAgo: number     // seconds, across all workers
  // Hashrate windows
  currentHashrate: number
  currentHashrateUnit: string
  hashrateWindows: HashrateWindow[]
  // Network
  networkDifficulty: number
  networkDifficultyUnit: string
  networkDifficultyRaw: number
  blockHeight: number
  algo: string             // "SHA256D"
  // Best share tracking
  bestShareSinceBlock: number
  bestShareSinceBlockUnit: string
  bestShareSinceBlockWorker: string
  allTimeBest: number
  allTimeBestUnit: string
  allTimeBestWorker: string
  // Block progress
  progressPercent: number
  etaDays: number
  etaHours: number
  // Per-worker
  workers: WorkerStats[]
  timestamp: number
}

export interface AlertEvent {
  id: string
  type: 'block_found' | 'worker_offline' | 'milestone' | 'ath'
  message: string
  workerName?: string
  timestamp: number
  sent: boolean
}

export interface AppConfig {
  axebchApiUrl: string
  discordWebhookUrl: string
  pollIntervalSeconds: number
  offlineThresholdSeconds: number
  milestones: number[]
}
