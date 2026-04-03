/**
 * Parse a chess.com (or any standard) PGN string into the app's game format.
 * Handles [%clk H:MM:SS] clock annotations for per-move timing.
 */
import { Chess } from 'chess.js'

function parseHeaders(pgn) {
  const headers = {}
  for (const m of pgn.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) {
    headers[m[1]] = m[2]
  }
  return headers
}

function parsePgn(pgn) {
  const headers = parseHeaders(pgn)

  // Strip only PGN tag headers (e.g. [Event "..."]) — NOT inline annotations like [%clk ...]
  // Then strip result token
  const moveText = pgn
    .replace(/\[\s*\w+\s+"[^"]*"\s*\]\s*/g, '')
    .replace(/(?:1-0|0-1|1\/2-1\/2|\*)\s*$/, '')
    .trim()

  // Initial time from TimeControl header (e.g. "600", "600+5", "180+2")
  const tc = headers.TimeControl || '600'
  const baseSeconds = parseInt(tc.split('+')[0]) || 600
  const increment   = parseFloat(tc.split('+')[1] ?? 0) || 0

  // Replace {comments} with placeholders, extracting clock and eval annotations
  const clocks = []
  const evals  = []
  const text = moveText.replace(/\{[^}]*\}/g, m => {
    const c = m.match(/%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)/)
    clocks.push(c ? parseInt(c[1]) * 3600 + parseInt(c[2]) * 60 + parseFloat(c[3]) : null)
    const ev = m.match(/%eval\s+([+-]?(?:#-?\d+|\d+(?:\.\d+)?))/)
    evals.push(ev ? ev[1] : null)
    return ` ~${clocks.length - 1}~ `
  })

  // State-machine tokeniser: handles both "1. e4 1... e5" and "1. e4 e5" formats
  const tokens = []
  let color = 'white'
  let pendingSan = null
  let pendingColor = null
  let pendingEval = null

  for (const part of text.trim().split(/\s+/)) {
    if (!part) continue

    // Move number: "1." or "1.." = white turn, "1..." = black turn
    if (/^\d+\.\.\.$/.test(part)) { color = 'black'; continue }
    if (/^\d+\.+$/.test(part))    { color = 'white'; continue }

    // Game result
    if (/^(?:1-0|0-1|1\/2-1\/2|\*)$/.test(part)) break

    // Clock/eval placeholder ~N~
    if (/^~(\d+)~$/.test(part)) {
      if (pendingSan !== null) {
        const idx = parseInt(part.slice(1, -1))
        const clk = clocks[idx]
        const ev  = evals[idx]
        // Accumulate eval onto the pending move (last non-null wins)
        if (ev !== null) pendingEval = ev
        if (clk !== null) {
          tokens.push({ color: pendingColor, san: pendingSan, clkSeconds: clk, evalStr: pendingEval })
          pendingSan = null; pendingColor = null; pendingEval = null
        }
        // null clock: keep pendingSan alive for a later comment
      }
      continue
    }

    // SAN move (starts with a letter or O-O castling)
    if (/^[A-Za-z]/.test(part) || /^O-O/.test(part)) {
      if (pendingSan !== null) {
        tokens.push({ color: pendingColor, san: pendingSan, clkSeconds: null, evalStr: pendingEval })
      }
      pendingSan = part
      pendingColor = color
      pendingEval = null
      color = color === 'white' ? 'black' : 'white'
    }
  }

  if (pendingSan !== null) {
    tokens.push({ color: pendingColor, san: pendingSan, clkSeconds: null, evalStr: pendingEval })
  }

  const prevClk = { white: null, black: null }
  const moves = tokens.map(t => {
    let timeSeconds = 5
    if (t.clkSeconds !== null) {
      const prev = prevClk[t.color]
      timeSeconds = prev !== null
        ? Math.round(Math.max(0.01, prev - t.clkSeconds + increment) * 100) / 100
        : Math.round(Math.max(0.01, baseSeconds - t.clkSeconds + increment) * 100) / 100
      prevClk[t.color] = t.clkSeconds
    }
    return { san: t.san, timeSeconds, color: t.color, evalStr: t.evalStr ?? null }
  })

  return { headers, moves }
}

/**
 * Parse a PGN string and return an app-compatible game object.
 * Throws a descriptive Error on failure.
 */
export function importFromPgn(pgn) {
  if (!pgn.trim()) throw new Error('Paste a PGN first.')

  let headers, moves
  try {
    ;({ headers, moves } = parsePgn(pgn))
  } catch (e) {
    throw new Error(`Could not parse PGN: ${e.message}`)
  }

  if (moves.length === 0) {
    throw new Error('No moves found. Make sure you copied the full PGN including the move list.')
  }

  const hasClockData = pgn.includes('%clk')
  if (!hasClockData) {
    throw new Error(
      'No clock data found in this PGN.\n' +
      'On chess.com: Share & Export → Copy PGN → enable "Include time stamps" before copying.'
    )
  }

  // Convert centipawn/mate eval string → white win probability (logistic)
  function evalToProb(evalStr) {
    if (!evalStr) return null
    if (evalStr.startsWith('#')) {
      return parseInt(evalStr.slice(1)) > 0 ? 0.999 : 0.001
    }
    const e = parseFloat(evalStr)
    return isNaN(e) ? null : 1 / (1 + Math.exp(-e * 0.4))
  }

  // Material values in pawns
  const MAT = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 }
  function materialProb(chess) {
    let w = 0, b = 0
    for (const row of chess.board()) {
      for (const sq of row) {
        if (!sq) continue
        if (sq.color === 'w') w += MAT[sq.type] ?? 0
        else                  b += MAT[sq.type] ?? 0
      }
    }
    return 1 / (1 + Math.exp(-(w - b) * 0.4))
  }

  const white = headers.White  || 'White'
  const black = headers.Black  || 'Black'
  const whiteElo = parseInt(headers.WhiteElo ?? '')
  const blackElo = parseInt(headers.BlackElo ?? '')
  const event  = headers.Event || 'Chess.com'
  const date   = (headers.Date || '').replace(/\.\d+$/, '')
  const result = headers.Result || '*'

  // Extract game ID from the [Link] header if present (chess.com exports include it)
  const linkId = (headers.Link || '').match(/\/(\d+)$/)?.[1]
  const id = linkId ? `chesscom-${linkId}` : `pgn-${Date.now()}`

  // Build probs[0..n] from %eval annotations when present, else fall back to material balance
  const probs = new Array(moves.length + 1).fill(0.5)
  const hasEval = moves.some(m => m.evalStr !== null)

  if (hasEval) {
    let lastProb = 0.5
    for (let i = 0; i < moves.length; i++) {
      const p = evalToProb(moves[i].evalStr)
      if (p !== null) lastProb = p
      probs[i + 1] = lastProb
    }
  } else {
    // No engine eval in PGN — approximate with material balance
    const chess = new Chess()
    probs[0] = materialProb(chess)
    for (let i = 0; i < moves.length; i++) {
      try { chess.move(moves[i].san) } catch {}
      probs[i + 1] = materialProb(chess)
    }
  }

  const tc = headers.TimeControl || ''
  const timeControlSeconds = parseInt(tc.split('+')[0]) || undefined

  return {
    id,
    title:       `${white} vs ${black}`,
    white,
    black,
    whiteRating: isNaN(whiteElo) ? undefined : whiteElo,
    blackRating: isNaN(blackElo) ? undefined : blackElo,
    event:       date ? `${event}, ${date}` : event,
    result,
    probs,
    moves,
    timeControlSeconds,
  }
}
