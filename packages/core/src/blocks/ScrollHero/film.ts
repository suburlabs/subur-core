export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export type BeatSegment = { end: number; start: number }

/** Reparteix la durada del film entre les escenes, en unitats normalitzades. */
export function beatSegments(count: number): BeatSegment[] {
  if (count <= 0) return []
  const width = 1 / count
  return Array.from({ length: count }, (_, index) => ({
    end: (index + 1) * width,
    start: index * width,
  }))
}

export function beatAtProgress(progress: number, count: number): number {
  if (count <= 0) return 0
  return Math.min(count - 1, Math.floor(clamp01(progress) * count))
}
