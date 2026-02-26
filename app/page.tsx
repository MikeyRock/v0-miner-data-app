import { DashboardClient } from '@/components/mining/dashboard-client'

// Server component — reads env vars at request time and seeds the client
// so Umbrel deployments auto-connect without touching Settings.
export default function Page() {
  const initialApiUrl     = process.env.AXEBCH_API_URL     ?? ''
  const initialDiscordUrl = process.env.DISCORD_WEBHOOK_URL ?? ''

  return (
    <DashboardClient
      initialApiUrl={initialApiUrl}
      initialDiscordUrl={initialDiscordUrl}
    />
  )
}
