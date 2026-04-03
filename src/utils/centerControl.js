// Centre squares: d4=(3,3), e4=(4,3), d5=(3,4), e5=(4,4)  [col, row], row 0 = rank 1
const CENTRE_SQ = [[3,3],[4,3],[3,4],[4,4]]

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

function attacksCentre(piece, col, row, board) {
  const isWhite = piece === piece.toUpperCase()
  const type = piece.toUpperCase()
  for (const [tc, tr] of CENTRE_SQ) {
    if (tc === col && tr === row) continue
    if (type === 'P') {
      const dir = isWhite ? 1 : -1
      if (row + dir === tr && Math.abs(col - tc) === 1) return true
    } else if (type === 'N') {
      const dc = Math.abs(tc - col), dr = Math.abs(tr - row)
      if ((dc === 1 && dr === 2) || (dc === 2 && dr === 1)) return true
    } else if (type === 'K') {
      if (Math.abs(tc - col) <= 1 && Math.abs(tr - row) <= 1) return true
    } else {
      const dc = tc - col, dr = tr - row
      const diag = Math.abs(dc) === Math.abs(dr)
      const ortho = dc === 0 || dr === 0
      const covers = (type === 'B' && diag) || (type === 'R' && ortho) || (type === 'Q' && (diag || ortho))
      if (covers) {
        const sc = dc === 0 ? 0 : dc / Math.abs(dc)
        const sr = dr === 0 ? 0 : dr / Math.abs(dr)
        let c = col + sc, r = row + sr
        let blocked = false
        while (c !== tc || r !== tr) {
          if (board[r][c] !== null) { blocked = true; break }
          c += sc; r += sr
        }
        if (!blocked) return true
      }
    }
  }
  return false
}

export function countCenterAttackers(fen, color) {
  if (!fen) return 0
  const board = parseFenBoard(fen)
  let count = 0
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (!piece) continue
      if ((color === 'white') !== (piece === piece.toUpperCase())) continue
      if (attacksCentre(piece, col, row, board)) count++
    }
  }
  return count
}
