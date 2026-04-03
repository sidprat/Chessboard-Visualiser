import { useMemo, useState, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import { classifyMove } from '../utils/evaluate'
import './MoveQualityVsSquares.css'

const S       = 120
const H       = S * Math.sqrt(3) / 2

const PAD_H   = 30
const PAD_TOP = 31
const PAD_BOT = 26
const GAP     = 4
const CW      = S + PAD_H * 2
const CH      = Math.round(H) + PAD_TOP + PAD_BOT
const TOTAL_W = CW * 2 + GAP

const Vt  = [CW / 2,      PAD_TOP]
const Vbl = [PAD_H,       PAD_TOP + H]
const Vbr = [CW - PAD_H,  PAD_TOP + H]

const LABEL_OFF = 13
const BOT_LABEL   = [(Vbl[0] + Vbr[0]) / 2, Vbl[1] + LABEL_OFF]
const RIGHT_LABEL = [(Vt[0] + Vbr[0]) / 2 + LABEL_OFF * Math.sqrt(3) / 2, (Vt[1] + Vbr[1]) / 2 - LABEL_OFF * 0.5]
const LEFT_LABEL  = [(Vt[0] + Vbl[0]) / 2 - LABEL_OFF * Math.sqrt(3) / 2, (Vt[1] + Vbl[1]) / 2 - LABEL_OFF * 0.5]

function perpFoot(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
  return [ax + t * dx, ay + t * dy]
}

function baryToCart(occ, att, free) {
  const total = occ + att + free || 1
  const a = occ / total, b = att / total, c = free / total
  return [
    a * Vbl[0] + b * Vt[0] + c * Vbr[0],
    a * Vbl[1] + b * Vt[1] + c * Vbr[1],
  ]
}

function computeMetrics(fenEntry) {
  if (!fenEntry?.fen) return null
  try {
    const chess = new Chess(fenEntry.fen)
    const pieces = chess.board().flat().filter(Boolean)
    const occupiedSet = new Set(pieces.map(p => p.square))
    const dests = new Set(chess.moves({ verbose: true }).map(m => m.to))
    const attacked = dests.size
    return {
      occupied: occupiedSet.size,
      attacked,
      free: 64 - occupiedSet.size - attacked,
    }
  } catch { return null }
}

const STEPS = [0.25, 0.5, 0.75]
const GRID_LINES = (() => {
  const lines = []
  for (const t of STEPS) {
    lines.push([
      [t * Vbl[0] + (1 - t) * Vt[0],  t * Vbl[1] + (1 - t) * Vt[1]],
      [t * Vbl[0] + (1 - t) * Vbr[0], t * Vbl[1] + (1 - t) * Vbr[1]],
    ])
    lines.push([
      [t * Vt[0] + (1 - t) * Vbl[0], t * Vt[1] + (1 - t) * Vbl[1]],
      [t * Vt[0] + (1 - t) * Vbr[0], t * Vt[1] + (1 - t) * Vbr[1]],
    ])
    lines.push([
      [t * Vbr[0] + (1 - t) * Vbl[0], t * Vbr[1] + (1 - t) * Vbl[1]],
      [t * Vbr[0] + (1 - t) * Vt[0],  t * Vbr[1] + (1 - t) * Vt[1]],
    ])
  }
  return lines
})()

const CENTROID_X = CW / 2
const CENTROID_Y = PAD_TOP + (2 * H) / 3

function TrianglePanel({ points, side, animFrac, onHover, onLeave }) {
  const avg = points.length
    ? { cx: points.reduce((s, p) => s + p.cx, 0) / points.length,
        cy: points.reduce((s, p) => s + p.cy, 0) / points.length,
        occ:  points.reduce((s, p) => s + p.metrics.occupied, 0) / points.length,
        att:  points.reduce((s, p) => s + p.metrics.attacked, 0) / points.length,
        free: points.reduce((s, p) => s + p.metrics.free,     0) / points.length,
      }
    : null

  const dispCx = avg ? CENTROID_X + (avg.cx - CENTROID_X) * animFrac : CENTROID_X
  const dispCy = avg ? CENTROID_Y + (avg.cy - CENTROID_Y) * animFrac : CENTROID_Y

  const feet = avg ? [
    perpFoot(dispCx, dispCy, Vbl[0], Vbl[1], Vbr[0], Vbr[1]),
    perpFoot(dispCx, dispCy, Vt[0],  Vt[1],  Vbr[0], Vbr[1]),
    perpFoot(dispCx, dispCy, Vt[0],  Vt[1],  Vbl[0], Vbl[1]),
  ] : []

  return (
    <g>
      {GRID_LINES.map(([[x1, y1], [x2, y2]], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="mqvs-grid" />
      ))}
      <polygon
        points={`${Vt[0]},${Vt[1]} ${Vbl[0]},${Vbl[1]} ${Vbr[0]},${Vbr[1]}`}
        className={`mqvs-triangle mqvs-triangle-${side}`}
      />
      <text x={BOT_LABEL[0]}   y={BOT_LABEL[1]}   className="mqvs-side-label" textAnchor="middle" dominantBaseline="central">ATTACKED</text>
      <text x={RIGHT_LABEL[0]} y={RIGHT_LABEL[1]} className="mqvs-side-label" textAnchor="middle" dominantBaseline="central"
        transform={`rotate(60,${RIGHT_LABEL[0]},${RIGHT_LABEL[1]})`}>OCCUPIED</text>
      <text x={LEFT_LABEL[0]}  y={LEFT_LABEL[1]}  className="mqvs-side-label" textAnchor="middle" dominantBaseline="central"
        transform={`rotate(-60,${LEFT_LABEL[0]},${LEFT_LABEL[1]})`}>UNATTACKED</text>

      {avg && feet.map(([fx, fy], i) => (
        <line key={i} x1={dispCx} y1={dispCy} x2={fx} y2={fy} className="mqvs-perp" />
      ))}
      {avg && (
        <circle
          cx={dispCx} cy={dispCy} r={5}
          className={`mqvs-avg-dot mqvs-avg-dot-${side}`}
          onMouseEnter={() => onHover(avg)}
          onMouseLeave={onLeave}
        />
      )}
    </g>
  )
}

export default function MoveQualityVsSquares({
  moves, evaluations, history, lightMode, open,
}) {
  const [hov, setHov] = useState(null) // { avg, panelOffset }
  const [animFrac, setAnimFrac] = useState(0)
  const rafRef = useRef(null)

  const { white: whitePoints, black: blackPoints } = useMemo(() => {
    const white = [], black = []
    moves.forEach((move, i) => {
      const metrics = computeMetrics(history?.[i])
      if (!metrics) return
      const prevProb = evaluations[i]?.prob ?? 0.5
      const currProb = evaluations[i + 1]?.prob ?? 0.5
      const cls = classifyMove(prevProb, currProb, move.color)
      const [cx, cy] = baryToCart(metrics.occupied, metrics.attacked, metrics.free)
      const pt = { idx: i + 1, move, metrics, cls, cx, cy }
      if (move.color === 'white') white.push(pt)
      else black.push(pt)
    })
    return { white, black }
  }, [moves, evaluations, history])

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    if (!open) { setAnimFrac(0); return }
    setAnimFrac(0)
    const start = performance.now()
    function tick(now) {
      const t = Math.min((now - start) / 550, 1)
      setAnimFrac(1 - Math.pow(1 - t, 3))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [open, whitePoints, blackPoints])

  const TW = 152, TH = 62
  let tipStyle = null
  if (hov) {
    const absX = hov.avg.cx + hov.panelOffset
    const left = Math.min(Math.max(absX - TW / 2, 0), TOTAL_W - TW)
    const top  = hov.avg.cy < PAD_TOP + H / 2 ? hov.avg.cy + 8 : hov.avg.cy - TH - 8
    tipStyle = { left, top }
  }

  return (
    <div className="mqvs-wrap" style={{ width: TOTAL_W }}>
      <svg width={TOTAL_W} height={CH} className="mqvs-svg">

        <g>
          <image href="/pieces/wK.svg" x={CW / 2 - 23} y={PAD_TOP - 25} width={15} height={15} />
          <text x={CW / 2 - 4} y={PAD_TOP - 12} className="mqvs-panel-label" textAnchor="start">White</text>
          <TrianglePanel
            points={whitePoints} side="white" animFrac={animFrac}
            onHover={avg => setHov({ avg, panelOffset: 0 })}
            onLeave={() => setHov(null)}
          />
        </g>

        <g transform={`translate(${CW + GAP}, 0)`}>
          <image href="/pieces/bK.svg" x={CW / 2 - 23} y={PAD_TOP - 25} width={15} height={15} />
          <text x={CW / 2 - 4} y={PAD_TOP - 12} className="mqvs-panel-label" textAnchor="start">Black</text>
          <TrianglePanel
            points={blackPoints} side="black" animFrac={animFrac}
            onHover={avg => setHov({ avg, panelOffset: CW + GAP })}
            onLeave={() => setHov(null)}
          />
        </g>

      </svg>

      {hov && tipStyle && (
        <div className="mqvs-tooltip" style={tipStyle}>
          <div className="mqvs-tt-metrics">
            <span><span className="mqvs-tt-ml">Occ</span> {hov.avg.occ.toFixed(1)}</span>
            <span><span className="mqvs-tt-ml">Att</span> {hov.avg.att.toFixed(1)}</span>
            <span><span className="mqvs-tt-ml">Unatt</span> {hov.avg.free.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
