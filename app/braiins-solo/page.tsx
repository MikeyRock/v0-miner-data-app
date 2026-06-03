import { BraiinsWebDashboard } from '@/components/braiins-web-dashboard'

export const metadata = {
  title: 'Braiins Solo Mining Dashboard',
  description: 'Monitor your Braiins Solo mining stats with Discord alerts',
}

export default function Page() {
  return (
    <BraiinsWebDashboard />
  )
}
