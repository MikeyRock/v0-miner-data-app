import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { alerts } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const recentAlerts = await db
      .select()
      .from(alerts)
      .orderBy(desc(alerts.createdAt))
      .limit(50)

    return NextResponse.json(recentAlerts)
  } catch (error) {
    console.error('[v0] Fetch alerts error:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, message, bestDifficulty, workerName, discordUrl } = body

    // Create alert in DB
    const newAlert = await db
      .insert(alerts)
      .values({
        type: type || 'info',
        message,
        bestDifficulty: bestDifficulty || null,
        workerName: workerName || null,
        discordSent: false,
      })
      .returning()

    // Send to Discord if webhook provided
    if (discordUrl && message) {
      try {
        const color = type === 'best_difficulty' ? 0x3b82f6 : type === 'worker_offline' ? 0xef4444 : 0x8b5cf6
        const discordEmbed = {
          embeds: [
            {
              title: `[Braiins Solo] ${type === 'best_difficulty' ? 'New Best Difficulty!' : 'Worker Offline'}`,
              description: message,
              color,
              fields: bestDifficulty ? [{ name: 'Best Difficulty', value: bestDifficulty.toString(), inline: true }] : [],
              timestamp: new Date().toISOString(),
            },
          ],
        }

        const discordRes = await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordEmbed),
        })

        if (discordRes.ok) {
          // Mark as sent in DB
          await db
            .update(alerts)
            .set({ discordSent: true })
            .where(eq(alerts.id, newAlert[0].id))
        }
      } catch (discordError) {
        console.error('[v0] Discord webhook error:', discordError)
        // Don't fail the request if Discord fails
      }
    }

    return NextResponse.json(newAlert[0])
  } catch (error) {
    console.error('[v0] Create alert error:', error)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}
