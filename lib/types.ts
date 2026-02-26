export interface Worker {
  workerId: string
  hashrate: number
  hashrateUnit: string
  bestShare: number
  bestShareUnit: string
  bestShareRaw: number
  sharesAccepted: number
  sharesRejected: number
  lastShareAgo: number // seconds
  isOnline: boolean
}

export interface NodeStats {
  height: number
  blockDiff: number
  blockDiffUnit: string
  blockDiffRaw: number
  networkHashrate: number
  networkHashrateUnit: string
  progressPercent: number
  etaDays: number
  etaHours: number
  poolHashrate: number
  poolHashrateUnit: string
  bestShare: number
  bestShareUnit: string
  bestShareRaw: number
  workers: Worker[]
  // ATH tracking
  athShare: number
  athShareUnit: string
  athShareWorker: string
  timestamp: number
  isMock?: boolean
  mockReason?: string
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
