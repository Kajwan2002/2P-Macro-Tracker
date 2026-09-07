interface Point {
  x: string
  y: number
}

interface LineChartProps {
  points: Point[]
  height?: number
  color?: string
  formatY?: (v: number) => string
}

/** A minimal SVG line chart for the weight trend. */
export function LineChart({
  points,
  height = 150,
  color = 'var(--color-accent)',
  formatY = (v) => String(v),
}: LineChartProps) {
  if (points.length < 2) {
    return (
      <div
        className="grid place-items-center rounded-2xl bg-surface-2 text-sm text-ink-faint"
        style={{ height }}
      >
        Log a few days to see the trend
      </div>
    )
  }

  const w = 320
  const pad = 8
  const ys = points.map((p) => p.y)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const stepX = (w - pad * 2) / (points.length - 1)

  const coords = points.map((p, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (p.y - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)} ${height - pad} L${coords[0][0].toFixed(1)} ${height - pad} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <path d={area} fill={color} opacity={0.12} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={color} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[0.65rem] font-semibold text-ink-faint">
        <span>{formatY(points[0].y)}</span>
        <span>
          {points[0].x} → {points[points.length - 1].x}
        </span>
        <span>{formatY(points[points.length - 1].y)}</span>
      </div>
    </div>
  )
}
