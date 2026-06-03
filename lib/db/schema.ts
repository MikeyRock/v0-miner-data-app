import { pgTable, serial, varchar, text, bigint, boolean, timestamp } from 'drizzle-orm/pg-core'

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  message: text('message').notNull(),
  bestDifficulty: bigint('best_difficulty'),
  workerName: varchar('worker_name', { length: 255 }),
  discordSent: boolean('discord_sent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export type Alert = typeof alerts.$inferSelect
export type NewAlert = typeof alerts.$inferInsert
