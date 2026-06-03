import { BraiinsWebDashboard } from '@/components/braiins-web-dashboard'

export const metadata = {
  title: 'Braiins Solo Mining Dashboard',
  description: 'Monitor your Braiins Solo mining stats with Discord alerts',
}

export default function Page() {
  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-cyan-500/30 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="text-4xl font-bold text-cyan-400 font-mono">⚡ BRAIINS SOLO MINER</h1>
          <p className="mt-2 text-cyan-300/60 font-mono text-sm">REAL-TIME MINING TELEMETRY // DISCORD ALERT SYSTEM ACTIVE</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <BraiinsWebDashboard />
      </main>
    </div>
  )
}
