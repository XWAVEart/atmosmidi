import type { CurveType } from './types'

export function applyCurve(normalized: number, curve: CurveType): number {
  const x = Math.max(0, Math.min(1, normalized))
  if (curve === 'exponential') return x * x
  if (curve === 'logarithmic') return Math.sqrt(x)
  if (curve === 's-curve') return x * x * (3 - 2 * x)
  return x
}

export function mapValue(
  raw: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number,
  curve: CurveType,
  invert: boolean,
): number {
  const span = inputMax - inputMin
  let n = span === 0 ? 0 : (raw - inputMin) / span
  n = Math.max(0, Math.min(1, n))
  if (invert) n = 1 - n
  const curved = applyCurve(n, curve)
  return Math.round(outputMin + curved * (outputMax - outputMin))
}

export function curvePoints(curve: CurveType, invert: boolean, steps = 40): string {
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    let n = i / steps
    if (invert) n = 1 - n
    const y = applyCurve(n, curve)
    const x = (i / steps) * 100
    const yy = (1 - y) * 100
    pts.push(`${x},${yy}`)
  }
  return pts.join(' ')
}
