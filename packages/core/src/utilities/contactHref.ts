// Els ajustos d'una base acabada de migrar encara no tenen telèfon ni correu: sense valor net no hi ha enllaç,
// i qui crida no pinta l'`<a>` (cap `tel:` buit ni cap enllaç sense `href`).

export const telHref = (phone: string | null | undefined): string | undefined => {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : undefined
}

export const mailtoHref = (email: string | null | undefined): string | undefined => {
  const address = (email ?? '').trim()
  return address ? `mailto:${address}` : undefined
}
