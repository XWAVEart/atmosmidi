import { curvePoints } from '../lib/curves'
import type { CurveType } from '../lib/types'

interface Props {
  curve: CurveType
  invert: boolean
  marker?: number | null
  inputMin: number
  inputMax: number
}

export function CurvePreview({ curve, invert, marker, inputMin, inputMax }: Props) {
  const points = curvePoints(curve, invert)
  let markerX: number | null = null
  if (marker != null && inputMax !== inputMin) {
    markerX = Math.max(0, Math.min(1, (marker - inputMin) / (inputMax - inputMin))) * 100
  }

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-full rounded-md border border-[var(--color-line)] bg-black/30">
      <polyline
        fill="none"
        stroke="rgba(61,224,255,0.85)"
        strokeWidth="2"
        points={points}
      />
      {markerX != null && (
        <line
          x1={markerX}
          y1="0"
          x2={markerX}
          y2="100"
          stroke="rgba(139,108,255,0.8)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
    </svg>
  )
}
