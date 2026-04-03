import { useState, useMemo, useEffect, useRef } from 'react'
import './MostValuablePiece.css'

const PIECE_NAMES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' }
const FILES = ['a','b','c','d','e','f','g','h']

function WreathSVG({ lightMode }) {
  return (
    <img
      src="/wreath.png"
      className={`mvp-wreath-svg${lightMode ? ' mvp-wreath-light' : ''}`}
      alt=""
      aria-hidden="true"
    />
  )
}


const CELL = 14
const BOARD = CELL * 8  // 112
const PAD   = 1


function parseFenBoard(fen) {
  const fenRows = fen.split(' ')[0].split('/')
  const board = Array.from({ length: 8 }, () => Array(8).fill(null))
  for (let fi = 0; fi < 8; fi++) {
    const rank = 7 - fi
    let col = 0
    for (const ch of fenRows[fi]) {
      if (ch >= '1' && ch <= '8') col += +ch
      else { board[rank][col] = ch; col++ }
    }
  }
  return board
}

// moveLog[row][col] = [{ san, moveNum, delta, isCapture }, ...]
function makeMoveLog() {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => []))
}

function computePieceStats(history, evaluations) {
  if (!history?.length) return { w: {}, b: {} }

  const posToId = {}
  const board = parseFenBoard(history[0].fen)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col]) {
        const sq = String.fromCharCode(97 + col) + (row + 1)
        posToId[sq] = sq
      }
    }
  }

  const pieceData = { w: {}, b: {} }

  for (const [sq, id] of Object.entries(posToId)) {
    const col = sq.charCodeAt(0) - 97
    const row = parseInt(sq[1]) - 1
    const piece = board[row][col]
    if (!piece) continue
    const isWhite = piece === piece.toUpperCase()
    const color = isWhite ? 'w' : 'b'
    const visits  = Array.from({ length: 8 }, () => Array(8).fill(0))
    const moveLog = makeMoveLog()
    visits[row][col] = 1
    pieceData[color][id] = { type: piece.toUpperCase(), winDelta: 0, squares: 0, captures: 0, visits, moveLog }
  }

  for (let i = 1; i < history.length; i++) {
    const move = history[i]?.move
    if (!move?.from) continue
    const { from, to, piece, color, flags, san } = move

    const evalBefore = evaluations[i - 1]?.prob ?? 0.5
    const evalAfter  = evaluations[i]?.prob ?? 0.5
    const delta = color === 'w' ? evalAfter - evalBefore : evalBefore - evalAfter

    const fc = from.charCodeAt(0) - 97, fr = parseInt(from[1]) - 1
    const tc = to.charCodeAt(0) - 97,   tr = parseInt(to[1]) - 1
    const dist = Math.max(Math.abs(tc - fc), Math.abs(tr - fr))
    const isCapture = !!(flags?.includes('c') || flags?.includes('e'))
    const id = posToId[from] ?? from
    const data = pieceData[color]?.[id]

    if (data) {
      data.winDelta += delta
      data.squares  += dist
      if (isCapture) data.captures++
      data.visits[tr][tc]++
      data.moveLog[tr][tc].push({ san, moveNum: i, delta, isCapture })
    }

    if (flags?.includes('c')) delete posToId[to]
    delete posToId[from]

    // Castling rook
    if (piece.toUpperCase() === 'K') {
      const kingside  = flags?.includes('k')
      const queenside = flags?.includes('q')
      if (kingside || queenside) {
        const rf = kingside ? (color === 'w' ? 'h1' : 'h8') : (color === 'w' ? 'a1' : 'a8')
        const rt = kingside ? (color === 'w' ? 'f1' : 'f8') : (color === 'w' ? 'd1' : 'd8')
        const rookId = posToId[rf]
        if (rookId !== undefined) {
          const rookData = pieceData[color]?.[rookId]
          if (rookData) {
            rookData.squares += kingside ? 2 : 3
            const rtc = rt.charCodeAt(0) - 97, rtr = parseInt(rt[1]) - 1
            rookData.visits[rtr][rtc]++
            rookData.moveLog[rtr][rtc].push({ san, moveNum: i, delta, isCapture: false })
          }
          delete posToId[rf]
          posToId[rt] = rookId
        }
      }
    }

    // En passant captured pawn
    if (flags?.includes('e')) {
      const capRow = color === 'w' ? tr - 1 : tr + 1
      delete posToId[String.fromCharCode(97 + tc) + (capRow + 1)]
    }

    // Promotion
    if (flags?.includes('p') && move.promotion && data) {
      data.type = move.promotion.toUpperCase()
    }

    posToId[to] = id
  }

  return pieceData
}

function selectMVP(pieceData, color) {
  const pieces = pieceData[color]
  if (!pieces) return null
  let best = null, bestScore = -Infinity
  for (const [id, data] of Object.entries(pieces)) {
    const score = data.winDelta + data.captures * 0.08 + data.squares * 0.003
    if (score > bestScore) { bestScore = score; best = { id, score, ...data } }
  }
  return best
}

function heatAlpha(t) { return t * 0.88 }

// Replay moves up to targetIndex and return the current square of the piece
// whose starting square (id) was pieceId. Returns null if captured.
function getPieceSquareAt(history, pieceId, targetIndex) {
  if (!history?.length) return null
  const board = parseFenBoard(history[0].fen)
  const posToId = {}
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) posToId[FILES[c] + (r + 1)] = FILES[c] + (r + 1)
    }
  }
  for (let i = 1; i <= Math.min(targetIndex, history.length - 1); i++) {
    const move = history[i]?.move
    if (!move?.from) continue
    const { from, to, piece, color, flags } = move
    const id = posToId[from] ?? from
    if (flags?.includes('c')) delete posToId[to]
    delete posToId[from]
    if (piece.toUpperCase() === 'K') {
      const ks = flags?.includes('k'), qs = flags?.includes('q')
      if (ks || qs) {
        const rf = ks ? (color === 'w' ? 'h1' : 'h8') : (color === 'w' ? 'a1' : 'a8')
        const rt = ks ? (color === 'w' ? 'f1' : 'f8') : (color === 'w' ? 'd1' : 'd8')
        const rookId = posToId[rf]
        if (rookId !== undefined) { delete posToId[rf]; posToId[rt] = rookId }
      }
    }
    if (flags?.includes('e')) {
      const tc = to.charCodeAt(0) - 97, tr = parseInt(to[1]) - 1
      const capRow = color === 'w' ? tr - 1 : tr + 1
      delete posToId[String.fromCharCode(97 + tc) + (capRow + 1)]
    }
    posToId[to] = id
  }
  for (const [sq, id] of Object.entries(posToId)) {
    if (id === pieceId) return sq
  }
  return null
}

export default function MostValuablePiece({ history, evaluations, lightMode, moveIndex, onPieceHover, onHoverMove, onLeaveMove, open }) {
  const [hovCell, setHovCell] = useState(null)
  // { col, rank, rankIdx, playerColor, moves[] }

  const pieceData = useMemo(
    () => computePieceStats(history ?? [], evaluations ?? []),
    [history, evaluations]
  )

  const wMVP = useMemo(() => selectMVP(pieceData, 'w'), [pieceData])
  const bMVP = useMemo(() => selectMVP(pieceData, 'b'), [pieceData])

  // ── Per-player entrance animations (independent) ────────────────────────────
  const [wAnimFrac, setWAnimFrac] = useState(0)
  const [bAnimFrac, setBAnimFrac] = useState(0)
  const wAnimRef = useRef(null)
  const bAnimRef = useRef(null)

  function startAnim(setter, rafRef) {
    cancelAnimationFrame(rafRef.current)
    setter(0)
    const DURATION = 550
    const start = performance.now()
    function tick(now) {
      const t = Math.min((now - start) / DURATION, 1)
      setter(1 - Math.pow(1 - t, 3)) // easeOutCubic
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!open) { cancelAnimationFrame(wAnimRef.current); setWAnimFrac(0); return }
    startAnim(setWAnimFrac, wAnimRef)
    return () => cancelAnimationFrame(wAnimRef.current)
  }, [open, wMVP])

  useEffect(() => {
    if (!open) { cancelAnimationFrame(bAnimRef.current); setBAnimFrac(0); return }
    startAnim(setBAnimFrac, bAnimRef)
    return () => cancelAnimationFrame(bAnimRef.current)
  }, [open, bMVP])

  function renderPlayer(playerColor, mvp, animFrac) {
    if (!mvp) return null
    const label = playerColor === 'w' ? 'White' : 'Black'
    const pieceCode = playerColor + mvp.type
    const pieceName = PIECE_NAMES[mvp.type] ?? mvp.type

    const allVisits = mvp.visits.flat()
    const maxVisit  = Math.max(1, ...allVisits)

    const sqLight = lightMode ? 'rgba(200,175,130,0.45)' : 'rgba(175,165,220,0.28)'
    const sqDark  = lightMode ? 'rgba(155,120,65,0.45)'  : 'rgba(80,70,135,0.38)'
    const heatRgb = lightMode ? '155,115,5' : '160,130,255'

    const deltaColor = mvp.winDelta >= 0
      ? (lightMode ? '#7a4510' : '#a29bfe')
      : '#ff4757'

    // ── Square reveal order (sorted by first visit move number) ──────────────
    const orderedSquares = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (mvp.moveLog[r][c].length > 0)
          orderedSquares.push({ rank: r, col: c, firstMove: mvp.moveLog[r][c][0].moveNum })
      }
    }
    orderedSquares.sort((a, b) => a.firstMove - b.firstMove)
    const totalSq = orderedSquares.length
    const sqOrderMap = Object.fromEntries(orderedSquares.map((s, i) => [`${s.rank},${s.col}`, i]))

    // ── Animated stat values ─────────────────────────────────────────────────
    const animDelta    = mvp.winDelta * animFrac
    const animSquares  = Math.round(mvp.squares  * animFrac)
    const animCaptures = Math.round(mvp.captures * animFrac)

    // Tooltip — positioned relative to the heatmap wrapper
    const isHov = hovCell?.playerColor === playerColor
    let tipNode = null
    if (isHov && hovCell.moves.length > 0) {
      const { col, rankIdx, moves } = hovCell
      const tipX  = PAD + col * CELL + CELL / 2
      const above = rankIdx >= 4
      const tipStyle = {
        left:      tipX,
        transform: above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
        top:       above
          ? PAD + rankIdx * CELL - 5
          : PAD + (rankIdx + 1) * CELL + 5,
      }
      tipNode = (
        <div
          className={`mvp-cell-tip${lightMode ? ' mvp-cell-tip-light' : ''}`}
          style={tipStyle}
        >
          <div className="mvp-tip-moves">
            {moves.slice(0, 4).map((m, idx) => {
              const sign = m.delta >= 0 ? '+' : ''
              const dPct = `${sign}${(m.delta * 100).toFixed(1)}%`
              const dCol = m.delta >= 0
                ? (lightMode ? '#7a4510' : '#a29bfe')
                : '#ff4757'
              return (
                <div key={idx} className="mvp-tip-move-row">
                  <span className="mvp-tip-movenum">Move {Math.ceil(m.moveNum / 2)}</span>
                  <div className="mvp-tip-bottom-row">
                    <span className="mvp-tip-san">{m.san}</span>
                    <span className="mvp-tip-delta" style={{ color: dCol }}>{dPct}</span>
                  </div>
                </div>
              )
            })}
            {moves.length > 4 && (
              <div className="mvp-tip-more">+{moves.length - 4} more</div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="mvp-player">
        <div className="mvp-header">
          <img src={`/pieces/${playerColor}K.svg`} className="mvp-king" alt={label} />
          <span className="mvp-player-label">{label}</span>
        </div>

        <div className="mvp-body">
          <div className="mvp-piece-col">
            <div
              className="mvp-piece-wrap"
              onMouseEnter={() => {
                const sq = getPieceSquareAt(history, mvp.id, moveIndex ?? (history?.length - 1) ?? 0)
                onPieceHover?.(sq)
              }}
              onMouseLeave={() => onPieceHover?.(null)}
            >
              <WreathSVG lightMode={lightMode} />
              <img src={`/pieces/${pieceCode}.svg`} className="mvp-piece-icon" alt={pieceName} />
            </div>
            <span className="mvp-piece-name">{pieceName}</span>
          </div>

          {/* Heatmap with tooltip — centred */}
          <div
            className="mvp-heatmap-wrap"
            onMouseLeave={() => { setHovCell(null); onLeaveMove?.() }}
          >
            <svg
              className="mvp-heatmap"
              width={BOARD + PAD * 2}
              height={BOARD + PAD * 2}
            >
              <rect
                x={0} y={0}
                width={BOARD + PAD * 2} height={BOARD + PAD * 2}
                fill="none"
                stroke={lightMode ? 'rgba(120,80,20,0.2)' : 'rgba(150,140,220,0.2)'}
                strokeWidth={PAD}
                rx={2}
              />
              {Array.from({ length: 8 }, (_, rankIdx) => {
                const rank = 7 - rankIdx
                return Array.from({ length: 8 }, (_, col) => {
                  const count  = mvp.visits[rank][col]
                  const moves  = mvp.moveLog[rank][col]
                  const t      = count / maxVisit
                  const x      = PAD + col * CELL
                  const y      = PAD + rankIdx * CELL
                  const isLightSq = (col + rank) % 2 === 1
                  const isHov = hovCell?.playerColor === playerColor
                    && hovCell?.col === col && hovCell?.rank === rank
                  const hasVisit = count > 0

                  return (
                    <g key={`${col}-${rank}`}>
                      <rect x={x} y={y} width={CELL} height={CELL}
                        fill={isLightSq ? sqLight : sqDark}
                      />
                      {hasVisit && (() => {
                        const sqIdx = sqOrderMap[`${rank},${col}`] ?? 0
                        const sliceSize = totalSq <= 1 ? 1 : 1 / totalSq
                        const fadeStart = totalSq <= 1 ? 0 : sqIdx / totalSq
                        const sqOpacity = Math.min(1, Math.max(0, (animFrac - fadeStart) / sliceSize))
                        return (
                          <rect x={x} y={y} width={CELL} height={CELL}
                            fill={`rgba(${heatRgb},${heatAlpha(t).toFixed(3)})`}
                            style={{ opacity: sqOpacity }}
                          />
                        )
                      })()}
                      {isHov && (
                        <rect
                          x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2}
                          fill="none"
                          stroke={lightMode ? 'rgba(80,40,5,0.85)' : 'rgba(255,255,255,0.8)'}
                          strokeWidth={1.5}
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                      {hasVisit && (
                        <rect x={x} y={y} width={CELL} height={CELL}
                          fill="transparent"
                          style={{ cursor: 'default' }}
                          onMouseEnter={() => {
                            setHovCell({ col, rank, rankIdx, playerColor, moves })
                            if (moves.length) onHoverMove?.(moves[moves.length - 1].moveNum)
                          }}
                        />
                      )}
                    </g>
                  )
                })
              })}
            </svg>
            {tipNode}
          </div>

          {/* Stats — vertical column on the right */}
          <div className="mvp-stats">
            <div className="mvp-stat">
              <span className="mvp-stat-label">ΔWin%</span>
              <span className="mvp-stat-value" style={{ color: deltaColor }}>
                {animDelta >= 0 ? '+' : ''}{(animDelta * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mvp-stat-sep" />
            <div className="mvp-stat">
              <span className="mvp-stat-label">Squares</span>
              <span className="mvp-stat-value">{animSquares}</span>
            </div>
            <div className="mvp-stat-sep" />
            <div className="mvp-stat">
              <span className="mvp-stat-label">Captures</span>
              <span className="mvp-stat-value">{animCaptures}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mvp-wrap">
      {renderPlayer('b', bMVP, bAnimFrac)}
      <div className="mvp-divider" />
      {renderPlayer('w', wMVP, wAnimFrac)}
    </div>
  )
}
