import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

async function resolveAuthDatabase() {
  if (process.env.NODE_ENV === 'production') {
    return undefined
  }

  try {
    const { mkdirSync } = await import('node:fs')
    mkdirSync('.data', { recursive: true })

    const { DatabaseSync } = await import('node:sqlite')
    return new DatabaseSync('.data/better-auth.sqlite')
  } catch {
    return undefined
  }
}

const database = await resolveAuthDatabase()
const configuredBaseURL = process.env.BETTER_AUTH_URL?.trim()
const baseURL = process.env.NODE_ENV === 'production' ? configuredBaseURL : undefined

if (database) {
  console.info('[auth] persistent database enabled')
} else {
  console.warn('[auth] using in-memory fallback database')
}

export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  secret: process.env.BETTER_AUTH_SECRET,
  ...(database ? { database } : {}),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [tanstackStartCookies()],
})
