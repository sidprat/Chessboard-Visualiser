import { Chess } from 'chess.js'

// Material values in pawns
const VALUES = { p: 1, n: 3.05, b: 3.33, r: 5.63, q: 9.5, k: 0 }

// Piece-square bonus tables (white perspective, rank 1 = index 7)
const PST = {
  p: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
}

export function evaluatePosition(fen) {
  const chess = new Chess(fen)

  if (chess.isCheckmate()) return chess.turn() === 'w' ? -999 : 999
  if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial()) return 0

  let score = 0
  const board = chess.board()

  board.forEach((row, rankIdx) => {
    row.forEach((sq, fileIdx) => {
      if (!sq) return
      const pstRow = sq.color === 'w' ? rankIdx : 7 - rankIdx
      const material = VALUES[sq.type]
      const positional = (PST[sq.type]?.[pstRow]?.[fileIdx] ?? 0) / 100
      const total = material + positional
      score += sq.color === 'w' ? total : -total
    })
  })

  return score
}

// Convert centipawn score → white win probability [0..1]
export function winProbability(score) {
  if (score >= 50)  return 1
  if (score <= -50) return 0
  return 1 / (1 + Math.pow(10, -score / 4))
}

// Build full evaluation array for a game history (local heuristic)
export function buildEvaluations(history) {
  return history.map(({ fen }) => {
    const score = evaluatePosition(fen)
    return { score, prob: winProbability(score) }
  })
}

// Classify a move based on win-probability change from the mover's perspective.
// prevProb / currProb are white's win probability [0..1].
// color is 'white' | 'black'.
export function classifyMove(prevProb, currProb, color) {
  const delta = color === 'white'
    ? currProb - prevProb       // white wants prob to rise
    : prevProb - currProb       // black wants prob to fall

  if (delta >= 0.05) return 'brilliant'
  if (delta >= 0.01) return 'great'
  if (delta >= -0.02) return 'best'
  if (delta >= -0.08) return 'mistake'
  return 'blunder'
}

