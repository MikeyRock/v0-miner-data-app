import { BraiinsWebDashboard } from '@/components/braiins-web-dashboard'

export const metadata = {
  title: 'Braiins Solo Mining Dashboard',
  description: 'Monitor your Braiins Solo mining stats with Discord alerts',
}

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-3xl font-bold text-white">Braiins Solo Miner</h1>
          <p className="text-slate-400">Real-time mining statistics with Discord alerts</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <BraiinsWebDashboard />
      </main>
    </div>
  )
}
