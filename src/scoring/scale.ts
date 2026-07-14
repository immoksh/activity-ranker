// 1 inside [idealLo, idealHi], 0 outside [floorLo, floorHi], linear in between.
export function bandScore(
  value: number,
  floorLo: number,
  idealLo: number,
  idealHi: number,
  floorHi: number,
): number {
  if (value >= idealLo && value <= idealHi) return 1
  if (value <= floorLo || value >= floorHi) return 0
  if (value < idealLo) return (value - floorLo) / (idealLo - floorLo)
  return (floorHi - value) / (floorHi - idealHi)
}

export function toScore(weighted: number): number {
  return Math.round(Math.max(0, Math.min(1, weighted)) * 100)
}
