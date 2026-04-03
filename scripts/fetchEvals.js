// One-time script: fetch Stockfish evaluations from Lichess cloud-eval API
// and output win-probability arrays to embed in games.js
// Run: node scripts/fetchEvals.js

import { Chess } from 'chess.js'
import { games } from '../src/data/games.js'

const DELAY_MS = 120

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function lichessWinProb(cp) {
  const w = 2 / (1 + Math.exp(-0.00368208 * cp)) - 1
  return +((w + 1) / 2).toFixed(4)
}

async function fetchEval(fen) {
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const pv = data.pvs?.[0]
    if (!pv) return null
    if (pv.mate != null) return pv.mate > 0 ? 1 : 0
    return lichessWinProb(pv.cp)
  } catch {
    return null
  }
}

function getGameFens(game) {
  const chess = new Chess()
  const fens = [chess.fen()]
  for (const m of game.moves) {
    try { chess.move(m.san) } catch { /* skip illegal */ }
    fens.push(chess.fen())
  }
  return fens
}

const results = {}

for (const game of games) {
  process.stderr.write(`\nFetching: ${game.title} (${game.moves.length} moves)\n`)
  const fens = getGameFens(game)
  const probs = []

  for (let i = 0; i < fens.length; i++) {
    const prob = await fetchEval(fens[i])
    const value = prob ?? 0.5
    probs.push(value)
    process.stderr.write(`  [${String(i + 1).padStart(3)}/${fens.length}] ${value}\n`)
    if (i < fens.length - 1) await sleep(DELAY_MS)
  }

  results[game.id] = probs
}

// Output JSON — redirect stdout to capture the data
console.log(JSON.stringify(results, null, 2))
