export function fieldSpan(width?: number | string | null): string {
  const value = typeof width === 'string' ? Number.parseFloat(width) : width
  return !value || value >= 100 ? 'sm:col-span-2' : 'sm:col-span-1'
}
