import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { classifyMove } from '../utils/evaluate'
import { countCenterAttackers } from '../utils/centerControl'
import './CenterProbPlot.css'

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
const PAD = { t: 26, r: 2, b: 44, l: 38 }
const PW = CW - PAD.l - PAD.r
const PH = CH - PAD.t - PAD.b
const TOTAL_W = CW * 2 + GAP
const Y_MAX = 6

const X_TICKS = [0, 0.25, 0.5, 0.75, 1]

function toY(n) { return PAD.t + PH - (n / Y_MAX) * PH }

function getPieceCode(move) {
  if (move.san.startsWith('O-O')) return (move.color === 'white' ? 'w' : 'b') + 'K'
  const map = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' }
  return (move.color === 'white' ? 'w' : 'b') + (map[move.san[0]] || 'P')
}

export default function CenterProbPlot({
  moves, evaluations, history, moveIndex,
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
  const toX = useCallback((prob) => PAD.l + prob * pw, [pw])

  const moveData = useMemo(() => moves.map((move, i) => {
    const prevProb = evaluations[i]?.prob ?? 0.5
    const currProb = evaluations[i + 1]?.prob ?? 0.5
    const fen = history?.[i + 1]?.fen ?? ''
    // Win prob from the moving player's perspective
    const playerProb = move.color === 'white' ? currProb : 1 - currProb
    const classification = classifyMove(prevProb, currProb, move.color)
    return {
      move, idx: i + 1, playerProb,
      timeSeconds: move.timeSeconds,
      centreCountW: countCenterAttackers(fen, 'white'),
      centreCountB: countCenterAttackers(fen, 'black'),
      classification,
    }
  }), [moves, evaluations, history])

  const blackPoints = useMemo(() =>
    moveData.filter(d => d.move.color === 'black')
      .map(d => ({ ...d, centreCount: d.centreCountB, px: toX(d.playerProb), py: toY(d.centreCountB) })),
  [moveData, toX])

  const whitePoints = useMemo(() =>
    moveData.filter(d => d.move.color === 'white')
      .map(d => ({ ...d, centreCount: d.centreCountW, px: toX(d.playerProb) + cw + GAP, py: toY(d.centreCountW) })),
  [moveData, toX, cw])

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
    const top  = pt.centreCount >= Y_MAX / 2 ? pt.py + 12 : pt.py - TH - 12
    tipStyle = { left, top }
  }

  const hovPt = hovState?.pt ?? null

  function renderPane(pts, paneX, pieceColor, showYAxis, animFrac) {
    const cx = PAD.l + pw / 2
    const label = pieceColor === 'b' ? 'Black' : 'White'
    return (
      <svg key={pieceColor} width={cw} height={CH} className="cpp-svg" style={{ overflow: 'visible' }}>
        <image href={`/pieces/${pieceColor}K.svg`} x={cx - 23} y={2} width={15} height={15} />
        <text x={cx - 4} y={13} className="cpp-pane-title" textAnchor="start">{label}</text>
        <rect x={PAD.l} y={PAD.t} width={pw} height={PH} className="cpp-bg" rx="2" />

        {/* Vertical grid + x ticks */}
        {X_TICKS.map(v => {
          const x = toX(v)
          const label = v === 0.5 ? '50%' : `${Math.round(v * 100)}%`
          return (
            <g key={v}>
              <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + PH}
                className={v === 0.5 ? 'cpp-mid-line' : 'cpp-grid-line'} />
              <text x={x} y={PAD.t + PH + 12} className="cpp-tick" textAnchor="middle">{label}</text>
            </g>
          )
        })}

        {/* Horizontal grid + y labels */}
        {[0,1,2,3,4,5,6].map(t => {
          const y = toY(t)
          return (
            <g key={t}>
              <line x1={PAD.l} y1={y} x2={PAD.l + pw} y2={y} className="cpp-grid-line" />
              {showYAxis && (
                <text x={PAD.l - 5} y={y + 4} className="cpp-tick" textAnchor="end">{t}</text>
              )}
            </g>
          )
        })}

        {showYAxis && (
          <text x={9} y={PAD.t + PH / 2} className="cpp-axis-label" textAnchor="middle"
            transform={`rotate(-90, 9, ${PAD.t + PH / 2})`}>
            Attacking Centre
          </text>
        )}

        <text x={PAD.l + pw / 2} y={CH - 3} className="cpp-axis-label" textAnchor="middle">
          Win Probability
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
              className="cpp-dot"
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
    <div ref={containerRef} className="cpp-wrap" style={{ width: '100%' }}>
      <div className="cpp-panes">
        {renderPane(blackPoints, 0,        'b', true,  bAnimFrac)}
        {renderPane(whitePoints, cw + GAP, 'w', false, wAnimFrac)}
      </div>

      {hovPt && tipStyle && (
        <div className="cpp-tooltip" style={tipStyle}>
          <div className="cpp-tt-row cpp-tt-top">
            <img src={`/pieces/${getPieceCode(hovPt.move)}.svg`} className="cpp-tt-piece" alt="" />
            <span className="cpp-tt-num">#{hovPt.idx}</span>
            <span className="cpp-tt-san">{hovPt.move.san}</span>
            <span className="cpp-tt-prob">{Math.round(hovPt.playerProb * 100)}%</span>
          </div>
          <div className="cpp-tt-row cpp-tt-bot">
            <span
              className="cpp-tt-cls"
              style={(() => {
                const c = (lightMode ? CLS_COLOR_LIGHT : CLS_COLOR)[hovPt.classification]
                return { color: c, background: c + '22', borderColor: c + '55' }
              })()}
            >
              {hovPt.classification[0].toUpperCase() + hovPt.classification.slice(1)}
            </span>
            <span className="cpp-tt-centre">{hovPt.centreCount} attacking centre</span>
          </div>
        </div>
      )}
    </div>
  )
}
