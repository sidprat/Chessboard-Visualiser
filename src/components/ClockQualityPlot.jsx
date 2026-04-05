import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { classifyMove } from '../utils/evaluate'
import './ClockQualityPlot.css'

const CLS_COLOR = {
  brilliant: '#1dd1a1', great: '#5599ff', best: '#a29bfe',
  mistake:   '#ffa502', blunder: '#ff4757',
}
const CLS_COLOR_LIGHT = {
  brilliant: '#15b88f', great: '#c8960c', best: '#92400e',
  mistake:   '#e07c00', blunder: '#ff4757',
}

const CW = 155, CH = 244
const GAP = 0
const PAD = { t: 26, r: 2, b: 44, l: 46 }
const PW = CW - PAD.l - PAD.r
const PH = CH - PAD.t - PAD.b
const TOTAL_W = CW * 2 + GAP

function makeToX(xMin, xMax, pw) {
  return (d, paneX = 0) => paneX + PAD.l + ((d - xMin) / (xMax - xMin)) * pw
}

function getPieceCode(move) {
  if (move.san.startsWith('O-O')) return (move.color === 'white' ? 'w' : 'b') + 'K'
  const map = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' }
  return (move.color === 'white' ? 'w' : 'b') + (map[move.san[0]] || 'P')
}

function formatTime(s) {
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return `${m}m${String(sec).padStart(2, '0')}s`
}

export default function ClockQualityPlot({
  moves, evaluations, moveIndex,
  whitePlayer, blackPlayer,
  onHoverMove, onLeaveMove, onSelectMove, lightMode, open,
}) {
  const [hovState, setHovState] = useState(null)
  const [wAnimFrac, setWAnimFrac] = useState(0)
  const [bAnimFrac, setBAnimFrac] = useState(0)
  const wRaf = useRef(null)
  const bRaf = useRef(null)
  const containerRef = useRef(null)
  const [cw, setCw] = useState(CW)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      if (w > 0) setCw(Math.max(CW, Math.floor(w / 2)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const pw = cw - PAD.l - PAD.r
  const totalW = cw * 2 + GAP

  const moveData = useMemo(() => {
    const totalWhite = moves.filter(m => m.color === 'white').reduce((s, m) => s + m.timeSeconds, 0)
    const totalBlack = moves.filter(m => m.color === 'black').reduce((s, m) => s + m.timeSeconds, 0)
    let cumWhite = 0, cumBlack = 0
    return moves.map((move, i) => {
      const prevProb = evaluations[i]?.prob ?? 0.5
      const currProb = evaluations[i + 1]?.prob ?? 0.5
      const delta = move.color === 'white' ? currProb - prevProb : prevProb - currProb
      const classification = classifyMove(prevProb, currProb, move.color)
      if (move.color === 'white') {
        cumWhite += move.timeSeconds
        return { move, idx: i + 1, delta, timeSeconds: move.timeSeconds,
                 classification, timeRemaining: totalWhite - cumWhite, totalTime: totalWhite }
      } else {
        cumBlack += move.timeSeconds
        return { move, idx: i + 1, delta, timeSeconds: move.timeSeconds,
                 classification, timeRemaining: totalBlack - cumBlack, totalTime: totalBlack }
      }
    })
  }, [moves, evaluations])

  const yMax = useMemo(() => {
    const max = Math.max(...moveData.map(d => d.totalTime))
    // Round up to a clean interval
    const interval = max <= 120 ? 20 : max <= 300 ? 60 : max <= 600 ? 120 : 300
    return Math.ceil(max / interval) * interval
  }, [moveData])

  const toY = useCallback((t) => PAD.t + PH - (t / yMax) * PH, [yMax])

  const yTicks = useMemo(() => {
    const interval = yMax <= 120 ? 20 : yMax <= 300 ? 60 : yMax <= 600 ? 120 : 300
    const ticks = []
    for (let t = 0; t <= yMax; t += interval) ticks.push(t)
    return ticks
  }, [yMax])

  const { xMin, xMax } = useMemo(() => {
    const deltas = moveData.map(d => d.delta)
    const margin = (Math.max(...deltas) - Math.min(...deltas)) * 0.08 || 0.02
    return { xMin: Math.min(...deltas) - margin, xMax: Math.max(...deltas) + margin }
  }, [moveData])

  const toX = useMemo(() => makeToX(xMin, xMax, pw), [xMin, xMax, pw])

  const xTicks = useMemo(() => {
    const candidates = [-0.4,-0.3,-0.2,-0.15,-0.1,-0.05,0,0.05,0.1,0.15,0.2,0.3,0.4]
    return candidates.filter(v => v >= xMin - 0.001 && v <= xMax + 0.001)
  }, [xMin, xMax])

  const blackPoints = useMemo(() =>
    moveData.filter(d => d.move.color === 'black')
      .map(d => ({ ...d, px: toX(d.delta, 0), py: toY(d.timeRemaining) })),
  [moveData, toX, toY])

  const whitePoints = useMemo(() =>
    moveData.filter(d => d.move.color === 'white')
      .map(d => ({ ...d, px: toX(d.delta, cw + GAP), py: toY(d.timeRemaining) })),
  [moveData, toX, toY, cw])

  function startAnim(setter, rafRef) {
    cancelAnimationFrame(rafRef.current)
    setter(0)
    const start = performance.now()
    function tick(now) {
      const t = Math.min((now - start) / 550, 1)
      setter(1 - Math.pow(1 - t, 3))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!open) { cancelAnimationFrame(wRaf.current); setWAnimFrac(0); return }
    startAnim(setWAnimFrac, wRaf)
    return () => cancelAnimationFrame(wRaf.current)
  }, [open, whitePoints])

  useEffect(() => {
    if (!open) { cancelAnimationFrame(bRaf.current); setBAnimFrac(0); return }
    startAnim(setBAnimFrac, bRaf)
    return () => cancelAnimationFrame(bRaf.current)
  }, [open, blackPoints])

  function handleEnter(pt, paneX) {
    setHovState({ pt, paneX })
    onHoverMove?.(pt.idx)
  }
  function handleLeave() {
    setHovState(null)
    onLeaveMove?.()
  }

  const TW = 160, TH = 60
  let tipStyle = null
  if (hovState) {
    const { pt } = hovState
    const left = Math.min(Math.max(pt.px - TW / 2, 0), totalW - TW)
    const midY = PAD.t + PH / 2
    const top = pt.py < midY ? pt.py + 12 : pt.py - TH - 12
    tipStyle = { left, top }
  }

  const hovPt = hovState?.pt ?? null

  function renderPane(pts, paneX, pieceColor, showYAxis, animFrac) {
    const cx = PAD.l + pw / 2
    const label = pieceColor === 'b' ? 'Black' : 'White'
    return (
      <svg key={pieceColor} width={cw} height={CH} className="cqp-svg" style={{ overflow: 'visible' }}>
        <image href={`/pieces/${pieceColor}K.svg`} x={cx - 23} y={2} width={15} height={15} />
        <text x={cx - 4} y={13} className="cqp-pane-title" textAnchor="start">{label}</text>
        <rect x={PAD.l} y={PAD.t} width={pw} height={PH} className="cqp-bg" rx="2" />

        {xTicks.map((v, i) => {
          const x = toX(v, 0)
          const showLabel = i === 0 || i === xTicks.length - 1 || v === 0
          return (
            <g key={v}>
              <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + PH} className="cqp-grid-line" />
              {showLabel && (
                <text x={x} y={PAD.t + PH + 12} className="cqp-tick" textAnchor="middle">
                  {v === 0 ? '0' : (v > 0 ? '+' : '') + Math.round(v * 100)}
                </text>
              )}
            </g>
          )
        })}

        {xMin < 0 && xMax > 0 && (
          <line x1={toX(0, 0)} y1={PAD.t} x2={toX(0, 0)} y2={PAD.t + PH} className="cqp-zero-line" />
        )}

        {yTicks.map(t => {
          const y = toY(t)
          return (
            <g key={t}>
              <line x1={PAD.l} y1={y} x2={PAD.l + pw} y2={y} className="cqp-grid-line" />
              {showYAxis && (
                <text x={PAD.l - 5} y={y + 4} className="cqp-tick" textAnchor="end">
                  {t >= 60 ? `${Math.floor(t / 60)}m` : `${t}s`}
                </text>
              )}
            </g>
          )
        })}

        {showYAxis && (
          <text x={9} y={PAD.t + PH / 2} className="cqp-axis-label" textAnchor="middle"
            transform={`rotate(-90, 9, ${PAD.t + PH / 2})`}>
            Time Left
          </text>
        )}

        <text x={PAD.l + pw / 2} y={CH - 3} className="cqp-axis-label" textAnchor="middle">
          ← ΔWin% →
        </text>

        {pts.map((pt, dotIdx) => {
          const localX = pt.px - paneX
          const isActive  = pt.idx === moveIndex
          const isHovered = hovPt?.idx === pt.idx
          const r = isActive || isHovered ? 5.5 : 3.5
          const clsColor = (lightMode ? CLS_COLOR_LIGHT : CLS_COLOR)[pt.classification]
          const fadeStart = dotIdx / pts.length
          const dotAnimOpacity = Math.min(1, Math.max(0, (animFrac - fadeStart) / (1 / pts.length)))
          return (
            <circle
              key={pt.idx}
              cx={localX} cy={pt.py} r={r}
              fill={clsColor}
              fillOpacity={(isActive ? 1 : 0.72) * dotAnimOpacity}
              stroke={isActive ? (lightMode ? '#f5c030' : 'rgba(255,255,255,0.92)') : isHovered ? 'rgba(255,255,255,0.55)' : 'none'}
              strokeWidth={isActive ? 2 : 1.5}
              className="cqp-dot"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => handleEnter(pt, paneX)}
              onMouseLeave={handleLeave}
              onClick={() => onSelectMove?.(pt.idx)}
            />
          )
        })}
      </svg>
    )
  }

  return (
    <div ref={containerRef} className="cqp-wrap" style={{ width: '100%' }}>
      <div className="cqp-panes">
        {renderPane(blackPoints, 0,        'b', true,  bAnimFrac)}
        {renderPane(whitePoints, cw + GAP, 'w', false, wAnimFrac)}
      </div>

      {hovPt && tipStyle && (
        <div className="cqp-tooltip" style={tipStyle}>
          <div className="cqp-tt-row cqp-tt-top">
            <img src={`/pieces/${getPieceCode(hovPt.move)}.svg`} className="cqp-tt-piece" alt="" />
            <span className="cqp-tt-num">#{hovPt.idx}</span>
            <span className="cqp-tt-san">{hovPt.move.san}</span>
            <span className="cqp-tt-time">{formatTime(hovPt.timeRemaining)} left</span>
          </div>
          <div className="cqp-tt-row cqp-tt-bot">
            <span
              className="cqp-tt-cls"
              style={(() => {
                const c = (lightMode ? CLS_COLOR_LIGHT : CLS_COLOR)[hovPt.classification]
                return { color: c, background: c + '22', borderColor: c + '55' }
              })()}
            >
              {hovPt.classification[0].toUpperCase() + hovPt.classification.slice(1)}
              <span className="cqp-tt-delta">
                {hovPt.delta >= 0 ? '+' : ''}{(hovPt.delta * 100).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
