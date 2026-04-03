import { useMemo, useState, useEffect, useRef } from 'react'
import './SquaresMoved.css'

const PIECE_ORDER = ['K', 'Q', 'R', 'B', 'N', 'P']

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

// result[color][pieceType][pieceId] = squares moved
// pieceId = initial square of that piece (permanent ID)
function computeSquaresMoved(history) {
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

  const result = { w: {}, b: {} }

  for (let i = 1; i < history.length; i++) {
    const move = history[i]?.move
    if (!move?.from) continue

    const { from, to, piece, color, flags } = move
    const fc = from.charCodeAt(0) - 97, fr = parseInt(from[1]) - 1
    const tc = to.charCodeAt(0) - 97,   tr = parseInt(to[1]) - 1
    const dist = Math.max(Math.abs(tc - fc), Math.abs(tr - fr))
    const type = piece.toUpperCase()
    const id = posToId[from] ?? from

    if (!result[color][type]) result[color][type] = {}
    result[color][type][id] = (result[color][type][id] ?? 0) + dist

    // Update position map
    delete posToId[from]

    // Castling: also count the rook's squares
    if (type === 'K') {
      const kingside = flags?.includes('k')
      const queenside = flags?.includes('q')
      if (kingside || queenside) {
        const rf = kingside
          ? (color === 'w' ? 'h1' : 'h8')
          : (color === 'w' ? 'a1' : 'a8')
        const rt = kingside
          ? (color === 'w' ? 'f1' : 'f8')
          : (color === 'w' ? 'd1' : 'd8')
        const rookDist = kingside ? 2 : 3
        const rookId = posToId[rf]
        if (rookId !== undefined) {
          if (!result[color]['R']) result[color]['R'] = {}
          result[color]['R'][rookId] = (result[color]['R'][rookId] ?? 0) + rookDist
          delete posToId[rf]
          posToId[rt] = rookId
        }
      }
    }

    // En passant: remove captured pawn from registry
    if (flags?.includes('e')) {
      const capRow = color === 'w' ? tr - 1 : tr + 1
      delete posToId[String.fromCharCode(97 + tc) + (capRow + 1)]
    }

    posToId[to] = id
  }

  return result
}

export default function SquaresMoved({ history, lightMode, open }) {
  const raw = useMemo(() => computeSquaresMoved(history ?? []), [history])

  // ── Bar grow animation ───────────────────────────────────────────────────
  const [animated, setAnimated] = useState(false)
  const rafRef = useRef(null)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    if (!open) { setAnimated(false); return }
    setAnimated(false)
    // Two rAFs: first lets React render bars at width 0, second triggers transition
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setAnimated(true))
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [open, raw])

  const { pieceTotals, playerTotals, maxSum } = useMemo(() => {
    const pieceTotals = { w: {}, b: {} }
    const playerTotals = { w: 0, b: 0 }
    let maxSum = 1

    for (const color of ['w', 'b']) {
      for (const type of PIECE_ORDER) {
        if (!raw[color][type]) continue
        const instances = raw[color][type]
        const sum = Object.values(instances).reduce((a, b) => a + b, 0)
        if (sum === 0) continue
        pieceTotals[color][type] = { instances, sum }
        playerTotals[color] += sum
        if (sum > maxSum) maxSum = sum
      }
    }

    return { pieceTotals, playerTotals, maxSum }
  }, [raw])

  function renderPlayer(color) {
    const label = color === 'w' ? 'White' : 'Black'
    const types = PIECE_ORDER.filter(t => pieceTotals[color]?.[t])

    return (
      <div className="sm-player">
        <div className="sm-header">
          <img src={`/pieces/${color}K.svg`} className="sm-king" alt={label} />
          <span className="sm-player-label">{label}</span>
          <span className="sm-player-total">{playerTotals[color]} sq</span>
        </div>
        <div className="sm-rows">
          {types.map((type, rowIdx) => {
            const { instances, sum } = pieceTotals[color][type]
            const instanceArr = Object.entries(instances)
              .filter(([, v]) => v > 0)
              .sort(([a], [b]) => a.localeCompare(b))
            const barPct = (sum / maxSum) * 100

            return (
              <div key={type} className="sm-row">
                <img src={`/pieces/${color}${type}.svg`} className="sm-piece-icon" alt={type} />
                <div className="sm-bar-track">
                  <div
                    className="sm-bar-fill"
                    style={{
                      width: animated ? `${barPct}%` : '0%',
                      transitionDelay: `${rowIdx * 35}ms`,
                    }}
                  >
                    {instanceArr.map(([id, val], idx) => (
                      <div
                        key={id}
                        className="sm-segment"
                        style={{ flex: val, opacity: idx % 2 === 0 ? 1 : 0.6 }}
                      />
                    ))}
                  </div>
                </div>
                <span className="sm-count">{sum}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="sm-wrap">
      {renderPlayer('b')}
      <div className="sm-divider" />
      {renderPlayer('w')}
    </div>
  )
}
