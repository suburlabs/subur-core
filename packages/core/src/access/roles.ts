import type { Access, FieldAccess } from 'payload'

type WithRole = { role?: null | string } | null | undefined

export const isSuperAdminUser = (user: WithRole): boolean => user?.role === 'superadmin'

export const isSuperAdmin: Access = ({ req: { user } }) => isSuperAdminUser(user)

export const isSuperAdminField: FieldAccess = ({ req: { user } }) => isSuperAdminUser(user)

/** El superadmin ho veu tot; qualsevol altre usuari, només el seu document. */
export const isSuperAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdminUser(user)) return true
  return { id: { equals: user.id } }
}
