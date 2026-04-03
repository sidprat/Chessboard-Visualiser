import { useState, useMemo, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import './AttackHeatmap.css'

const CELL = 22
const BOARD = CELL * 8   // 176
const CW = 198, CH = 230
const GAP = 4
const PAD = { t: 34, r: 8, b: 28, l: 14 }
const TOTAL_W = CW * 2 + GAP

const FILES = ['A','B','C','D','E','F','G','H']

// Returns final maps + per-position delta arrays for animation replay
function computeFreedomData(history) {
  const wMap = Array.from({ length: 8 }, () => Array(8).fill(0))
  const bMap = Array.from({ length: 8 }, () => Array(8).fill(0))
  const wDeltas = [] // wDeltas[i] = [[row,col], ...] added at position i
  const bDeltas = []

  for (const entry of history) {
    const fen = entry?.fen
    if (!fen) { wDeltas.push([]); bDeltas.push([]); continue }
    try {
      const chess = new Chess(fen)
      const isWhite = fen.split(' ')[1] === 'w'
      const map = isWhite ? wMap : bMap
      const deltas = []
      for (const move of chess.moves({ verbose: true })) {
        const col = move.to.charCodeAt(0) - 97
        const row = parseInt(move.to[1]) - 1
        map[row][col]++
        deltas.push([row, col])
      }
      if (isWhite) { wDeltas.push(deltas); bDeltas.push([]) }
      else          { wDeltas.push([]);     bDeltas.push(deltas) }
    } catch { wDeltas.push([]); bDeltas.push([]) }
  }

  return { wMap, bMap, wDeltas, bDeltas }
}

// ── green → yellow → red heat scale ──────────────────────────────────────────
const GREEN  = [34,  197, 94]
const YELLOW = [250, 204, 21]
const RED    = [239, 68,  68]

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function heatColor(count, avg, max) {
  if (max === 0) return `rgba(${GREEN.join(',')},0.75)`
  const t = count / max
  const mid = avg / max
  let rgb
  if (t <= mid) {
    rgb = lerpRgb(GREEN, YELLOW, mid > 0 ? t / mid : 0)
  } else {
    rgb = lerpRgb(YELLOW, RED, (t - mid) / Math.max(1 - mid, 0.001))
  }
  return `rgba(${rgb.join(',')},0.82)`
}

// Build accumulated map up to `steps` delta entries
function buildMap(deltas, steps) {
  const map = Array.from({ length: 8 }, () => Array(8).fill(0))
  const end = Math.min(steps, deltas.length)
  for (let i = 0; i < end; i++) {
    for (const [row, col] of deltas[i]) map[row][col]++
  }
  return map
}

export default function AttackHeatmap({ history, whitePlayer, blackPlayer, lightMode, open }) {
  const [hovCell, setHovCell] = useState(null)

  const { wMap, bMap, wDeltas, bDeltas } = useMemo(
    () => computeFreedomData(history ?? []),
    [history]
  )

  // Final-map stats — pinned scale so colours don't jump during animation
  const wMax = useMemo(() => Math.max(1, ...wMap.flat()), [wMap])
  const bMax = useMemo(() => Math.max(1, ...bMap.flat()), [bMap])
  const wAvg = useMemo(() => {
    const vals = wMap.flat().filter(v => v > 0)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 1
  }, [wMap])
  const bAvg = useMemo(() => {
    const vals = bMap.flat().filter(v => v > 0)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 1
  }, [bMap])

  // ── Independent per-board animation fracs ─────────────────────────────────
  const [wAnimFrac, setWAnimFrac] = useState(0)
  const [bAnimFrac, setBAnimFrac] = useState(0)
  const wRaf = useRef(null)
  const bRaf = useRef(null)
  const ANIM_DURATION = 550

  function startAnim(setter, rafRef) {
    cancelAnimationFrame(rafRef.current)
    setter(0)
    const start = performance.now()
    function tick(now) {
      const t = Math.min((now - start) / ANIM_DURATION, 1)
      setter(t)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!open) { cancelAnimationFrame(wRaf.current); setWAnimFrac(0); return }
    startAnim(setWAnimFrac, wRaf)
    return () => cancelAnimationFrame(wRaf.current)
  }, [open, wMap])

  useEffect(() => {
    if (!open) { cancelAnimationFrame(bRaf.current); setBAnimFrac(0); return }
    startAnim(setBAnimFrac, bRaf)
    return () => cancelAnimationFrame(bRaf.current)
  }, [open, bMap])

  // Partial maps derived from current animation fracs
  const wStep     = Math.floor(wAnimFrac * wDeltas.length)
  const bStep     = Math.floor(bAnimFrac * bDeltas.length)
  const wCurrMap  = useMemo(() => buildMap(wDeltas, wStep), [wDeltas, wStep])
  const bCurrMap  = useMemo(() => buildMap(bDeltas, bStep), [bDeltas, bStep])
  const wCurrTotal = useMemo(() => wCurrMap.flat().reduce((s, v) => s + v, 0), [wCurrMap])
  const bCurrTotal = useMemo(() => bCurrMap.flat().reduce((s, v) => s + v, 0), [bCurrMap])

  // Tooltip positioning
  const TW = 120, TH = 40
  let tipStyle = null
  if (hovCell) {
    const cellX = PAD.l + hovCell.col * CELL + CELL / 2 + hovCell.paneX
    const cellY = PAD.t + (7 - hovCell.rank) * CELL
    const left = Math.min(Math.max(cellX - TW / 2, 0), TOTAL_W - TW)
    const top  = hovCell.rank < 4 ? cellY + CELL + 4 : cellY - TH - 4
    tipStyle = { left, top }
  }

  function renderPane(currMap, currTotal, maxVal, avgVal, paneX, pieceColor, showRankLabels) {
    const cx = PAD.l + BOARD / 2
    const label = pieceColor === 'b' ? 'Black' : 'White'
    return (
      <svg key={pieceColor} width={CW} height={CH} className="ahm-svg" style={{ overflow: 'visible' }}>
        {/* Title */}
        <image href={`/pieces/${pieceColor}K.svg`} x={cx - 24} y={0} width={15} height={15} />
        <text x={cx + 9} y={11} className="ahm-pane-title" textAnchor="middle">{label}</text>
        <text x={cx} y={25} className="ahm-pane-subtitle" textAnchor="middle">
          {currTotal.toLocaleString()} possibilities
        </text>

        {/* Board squares */}
        {Array.from({ length: 8 }, (_, rankIdx) => {
          const rank = 7 - rankIdx
          return Array.from({ length: 8 }, (_, col) => {
            const isLight = (col + rank) % 2 === 1
            const count = currMap[rank][col]
            const x = PAD.l + col * CELL
            const y = PAD.t + rankIdx * CELL
            const isHovered = hovCell?.col === col && hovCell?.rank === rank && hovCell?.paneX === paneX

            return (
              <g key={`${col}-${rank}`}>
                <rect x={x} y={y} width={CELL} height={CELL}
                  className={isLight ? 'ahm-sq-light' : 'ahm-sq-dark'}
                />
                <rect x={x} y={y} width={CELL} height={CELL}
                  fill={heatColor(count, avgVal, maxVal)}
                  style={{ pointerEvents: 'none' }}
                />
                {isHovered && (
                  <rect
                    x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2}
                    fill="none"
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth="1.5"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                <rect x={x} y={y} width={CELL} height={CELL}
                  fill="transparent"
                  className="ahm-hover-target"
                  onMouseEnter={() => setHovCell({ col, rank, count, paneX })}
                  onMouseLeave={() => setHovCell(null)}
                />
              </g>
            )
          })
        })}

        {/* Board border */}
        <rect x={PAD.l} y={PAD.t} width={BOARD} height={BOARD} className="ahm-border" fill="none" />

        {/* Rank labels */}
        {showRankLabels && Array.from({ length: 8 }, (_, rankIdx) => {
          const rank = 7 - rankIdx
          const y = PAD.t + rankIdx * CELL + CELL / 2 + 4
          return (
            <text key={rank} x={PAD.l - 4} y={y} className="ahm-rank-label" textAnchor="end">
              {rank + 1}
            </text>
          )
        })}

        {/* File labels */}
        {FILES.map((f, col) => (
          <text key={f}
            x={PAD.l + col * CELL + CELL / 2}
            y={PAD.t + BOARD + 14}
            className="ahm-file-label"
            textAnchor="middle"
          >
            {f}
          </text>
        ))}
      </svg>
    )
  }

  return (
    <div className="ahm-wrap" style={{ width: TOTAL_W }}>
      <div className="ahm-panes">
        {renderPane(bCurrMap, bCurrTotal, bMax, bAvg, 0,        'b', true)}
        {renderPane(wCurrMap, wCurrTotal, wMax, wAvg, CW + GAP, 'w', false)}
      </div>

      {hovCell && tipStyle && (
        <div className="ahm-tooltip" style={tipStyle}>
          <span className="ahm-tt-sq">{FILES[hovCell.col]}{hovCell.rank + 1}</span>
          <span className="ahm-tt-count">{hovCell.count} moves</span>
        </div>
      )}
    </div>
  )
}
