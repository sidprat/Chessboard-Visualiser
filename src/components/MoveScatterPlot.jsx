import { useState, useMemo, useEffect, useRef } from 'react'
import { classifyMove } from '../utils/evaluate'
import { countCenterAttackers } from '../utils/centerControl'
import './MoveScatterPlot.css'

const CLS_COLOR = {
  brilliant: '#1dd1a1', great: '#5599ff', best: '#a29bfe',
  mistake:   '#ffa502', blunder: '#ff4757',
}

const CLS_COLOR_LIGHT = {
  brilliant: '#15b88f', great: '#c8960c', best: '#92400e',
  mistake:   '#e07c00', blunder: '#ff4757',
}

// Pane geometry — both charts share identical dimensions for comparable scales
const CW = 155, CH = 244
const GAP = 0
const PAD = { t: 26, r: 2, b: 44, l: 38 }
const PW = CW - PAD.l - PAD.r   // 98
const PH = CH - PAD.t - PAD.b   // 174
const TOTAL_W = CW * 2 + GAP
const Y_MAX = 6

const DOT_WHITE       = '#ddd8ff'
const DOT_BLACK       = '#6a5acd'
const DOT_WHITE_LIGHT = '#a0622a'
const DOT_BLACK_LIGHT = '#5c3010'


function getPieceCode(move) {
  if (move.san.startsWith('O-O')) return (move.color === 'white' ? 'w' : 'b') + 'K'
  const map = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' }
  return (move.color === 'white' ? 'w' : 'b') + (map[move.san[0]] || 'P')
}

// Shared coordinate helpers — paneX offsets screen x into scatter-wrap coords
function makeToX(xMin, xMax) {
  return (d, paneX = 0) => paneX + PAD.l + ((d - xMin) / (xMax - xMin)) * PW
}
function toY(n) { return PAD.t + PH - (n / Y_MAX) * PH }

export default function MoveScatterPlot({
  moves, evaluations, history, moveIndex,
  whitePlayer, blackPlayer,
  onHoverMove, onLeaveMove, onSelectMove, lightMode, open,
}) {
  const [hovState, setHovState] = useState(null) // { pt, paneX }
  const [wAnimFrac, setWAnimFrac] = useState(0)
  const [bAnimFrac, setBAnimFrac] = useState(0)
  const wRaf = useRef(null)
  const bRaf = useRef(null)

  const moveData = useMemo(() => moves.map((move, i) => {
    const prevProb    = evaluations[i]?.prob ?? 0.5
    const currProb    = evaluations[i + 1]?.prob ?? 0.5
    const delta       = move.color === 'white' ? currProb - prevProb : prevProb - currProb
    const fen = history?.[i + 1]?.fen ?? ''
    return {
      move, idx: i + 1, delta, timeSeconds: move.timeSeconds,
      centreCountW: countCenterAttackers(fen, 'white'),
      centreCountB: countCenterAttackers(fen, 'black'),
      classification: classifyMove(prevProb, currProb, move.color),
    }
  }), [moves, evaluations, history])

  // X range uses ALL moves so both panes share the same scale
  const { xMin, xMax } = useMemo(() => {
    const deltas = moveData.map(d => d.delta)
    const margin = (Math.max(...deltas) - Math.min(...deltas)) * 0.08 || 0.02
    return { xMin: Math.min(...deltas) - margin, xMax: Math.max(...deltas) + margin }
  }, [moveData])

  const toX = useMemo(() => makeToX(xMin, xMax), [xMin, xMax])

  const xTicks = useMemo(() => {
    const candidates = [-0.4,-0.3,-0.2,-0.15,-0.1,-0.05,0,0.05,0.1,0.15,0.2,0.3,0.4]
    return candidates.filter(v => v >= xMin - 0.001 && v <= xMax + 0.001)
  }, [xMin, xMax])

  const blackPoints = useMemo(() =>
    moveData.filter(d => d.move.color === 'black')
      .map(d => ({ ...d, centreCount: d.centreCountW, px: toX(d.delta, 0),   py: toY(d.centreCountW) })),
  [moveData, toX])

  const whitePoints = useMemo(() =>
    moveData.filter(d => d.move.color === 'white')
      .map(d => ({ ...d, centreCount: d.centreCountB, px: toX(d.delta, CW + GAP), py: toY(d.centreCountB) })),
  [moveData, toX])

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

  // Tooltip positioned in scatter-wrap coordinate space
  const TW = 148, TH = 60
  let tipStyle = null
  if (hovState) {
    const { pt, paneX } = hovState
    const ax = paneX + pt.px - paneX  // pt.px already includes paneX offset
    const left = Math.min(Math.max(ax - TW / 2, 0), TOTAL_W - TW)
    const top  = pt.centreCount >= Y_MAX / 2 ? pt.py + 12 : pt.py - TH - 12
    tipStyle = { left, top }
  }

  const hovPt = hovState?.pt ?? null

  function renderPane(pts, paneX, dotColor, pieceColor, showYAxis, animFrac) {
    const xOffset = paneX
    const cx = PAD.l + PW / 2
    const label = pieceColor === 'b' ? 'Black' : 'White'
    return (
      <svg key={pieceColor} width={CW} height={CH} className="scatter-svg" style={{ overflow: 'visible' }}>
        {/* Pane title: piece icon + Black/White */}
        <image href={`/pieces/${pieceColor}K.svg`} x={cx - 23} y={2} width={15} height={15} />
        <text x={cx - 4} y={13} className="scatter-pane-title" textAnchor="start">{label}</text>

        {/* Plot background */}
        <rect x={PAD.l} y={PAD.t} width={PW} height={PH} className="scatter-bg" rx="2" />

        {/* Vertical grid + x-axis ticks (labels only for leftmost, 0, rightmost) */}
        {xTicks.map((v, i) => {
          const x = toX(v, 0)   // local x within this pane
          const showLabel = i === 0 || i === xTicks.length - 1 || v === 0
          return (
            <g key={v}>
              <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + PH} className="scatter-grid-line" />
              {showLabel && (
                <text x={x} y={PAD.t + PH + 12} className="scatter-tick" textAnchor="middle">
                  {v === 0 ? '0' : (v > 0 ? '+' : '') + Math.round(v * 100)}
                </text>
              )}
            </g>
          )
        })}

        {/* Zero line */}
        {xMin < 0 && xMax > 0 && (
          <line
            x1={toX(0, 0)} y1={PAD.t} x2={toX(0, 0)} y2={PAD.t + PH}
            className="scatter-zero-line"
          />
        )}

        {/* Horizontal grid + y-axis labels (left pane only) */}
        {[0, 1, 2, 3, 4, 5, 6].map(t => {
          const y = toY(t)
          return (
            <g key={t}>
              <line x1={PAD.l} y1={y} x2={PAD.l + PW} y2={y} className="scatter-grid-line" />
              {showYAxis && (
                <text x={PAD.l - 5} y={y + 4} className="scatter-tick" textAnchor="end">{t}</text>
              )}
            </g>
          )
        })}

        {/* Y-axis title (left pane only) */}
        {showYAxis && (
          <text
            x={9} y={PAD.t + PH / 2}
            className="scatter-axis-label" textAnchor="middle"
            transform={`rotate(-90, 9, ${PAD.t + PH / 2})`}
          >
            Attacks on Centre
          </text>
        )}

        {/* X-axis title */}
        <text
          x={PAD.l + PW / 2} y={CH - 3}
          className="scatter-axis-label" textAnchor="middle"
        >
          ← ΔWin% →
        </text>

        {/* Data points — px already includes the wrap-level paneX offset, strip it back */}
        {pts.map((pt, dotIdx) => {
          const localX    = pt.px - xOffset
          const isActive  = pt.idx === moveIndex
          const isHovered = hovPt?.idx === pt.idx
          const isBlunder = pt.classification === 'blunder'
          const fill      = isBlunder ? '#ff4757' : dotColor
          const baseOpacity = isActive ? 1 : isBlunder ? 0.82 : 0.28
          const fadeStart = dotIdx / pts.length
          const sliceSize = 1 / pts.length
          const dotAnimOpacity = Math.min(1, Math.max(0, (animFrac - fadeStart) / sliceSize))
          const opacity   = baseOpacity * dotAnimOpacity
          const r         = isActive || isHovered ? 5.5 : isBlunder ? 3.5 : 2.5
          return (
            <circle
              key={pt.idx}
              cx={localX} cy={pt.py} r={r}
              fill={fill}
              fillOpacity={opacity}
              stroke={isActive  ? (lightMode ? '#f5c030' : 'rgba(255,255,255,0.92)') :
                      isHovered ? 'rgba(255,255,255,0.55)' : 'none'}
              strokeWidth={isActive ? 2 : 1.5}
              className="scatter-dot"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => handleEnter(pt, xOffset)}
              onMouseLeave={handleLeave}
              onClick={() => onSelectMove?.(pt.idx)}
            />
          )
        })}
      </svg>
    )
  }

  return (
    <div className="scatter-wrap" style={{ width: TOTAL_W }}>
      <div className="scatter-panes">
        {renderPane(blackPoints, 0,        lightMode ? DOT_BLACK_LIGHT : DOT_BLACK, 'b', true,  bAnimFrac)}
        {renderPane(whitePoints, CW + GAP, lightMode ? DOT_WHITE_LIGHT : DOT_WHITE, 'w', false, wAnimFrac)}
      </div>

      {/* Tooltip rendered at wrap level, spanning both panes */}
      {hovPt && tipStyle && (
        <div className="scatter-tooltip" style={tipStyle}>
          <div className="stt-row stt-top">
            <img src={`/pieces/${getPieceCode(hovPt.move)}.svg`} className="stt-piece" alt="" />
            <span className="stt-num">#{hovPt.idx}</span>
            <span className="stt-san">{hovPt.move.san}</span>
            <span className="stt-time">{hovPt.timeSeconds}s</span>
          </div>
          <div className="stt-row stt-bot">
            <span
              className="stt-cls"
              style={(() => {
                const c = (lightMode ? CLS_COLOR_LIGHT : CLS_COLOR)[hovPt.classification]
                return { color: c, background: c + '22', borderColor: c + '55' }
              })()}
            >
              {hovPt.classification[0].toUpperCase() + hovPt.classification.slice(1)}
              <span className="stt-delta-inline">
                {hovPt.delta >= 0 ? '+' : ''}{(hovPt.delta * 100).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
