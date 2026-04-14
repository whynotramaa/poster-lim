export const UNIVERSAL_ADMIN_EMAIL = 'abhi.cdh211@gmail.com'
export const UNIVERSAL_ADMIN_PASSWORD = 'prakriti@222'

export type AppRole = 'customer' | 'admin'

export function isUniversalAdminEmail(email: string) {
  return email.trim().toLowerCase() === UNIVERSAL_ADMIN_EMAIL
}

export function resolveRoleByEmail(email: string, fallback: AppRole = 'customer'): AppRole {
  return isUniversalAdminEmail(email) ? 'admin' : fallback
}
