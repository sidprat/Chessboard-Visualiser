import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import Chessboard from './components/Chessboard'
import TimelineSlider from './components/TimelineSlider'
import GameSelector from './components/GameSelector'
import AddGameModal from './components/AddGameModal'
import './components/AddGameModal.css'
import ChessClock from './components/ChessClock'
import EvalBar from './components/EvalBar'
import VsIntro from './components/VsIntro'
import CollapsibleCard from './components/CollapsibleCard'
import MoveScatterPlot from './components/MoveScatterPlot'
import ClockQualityPlot from './components/ClockQualityPlot'
import CenterProbPlot from './components/CenterProbPlot'
import AttackHeatmap from './components/AttackHeatmap'
import SquaresMoved from './components/SquaresMoved'
import MostValuablePiece from './components/MostValuablePiece'
import MoveQualityVsSquares from './components/MoveQualityVsSquares'
import { classifyMove } from './utils/evaluate'
import { analyseGame } from './utils/stockfishAnalyse'
import { games as defaultGames } from './data/games'
import './App.css'

const CLASSIFICATION_CONFIG = {
  brilliant: { label: '!!', color: '#1dd1a1', lightColor: '#15b88f', title: 'Brilliant' },
  great:     { label: '!',  color: '#5599ff', lightColor: '#c8960c', title: 'Great'     },
  best:      { label: '✓',  color: '#a29bfe', lightColor: '#92400e', title: 'Best'      },
  mistake:   { label: '?',  color: '#ffa502', lightColor: '#e07c00', title: 'Mistake'   },
  blunder:   { label: '??', color: '#ff4757', lightColor: '#ff4757', title: 'Blunder'   },
}

function MoveClassIcon({ classification, delta, lightMode }) {
  if (!classification) return null
  const { label, color, lightColor, title } = CLASSIFICATION_CONFIG[classification]
  const c = lightMode ? lightColor : color
  const sign = delta >= 0 ? '+' : ''
  return (
    <span className="move-class-pill" style={{ '--pill-color': c }}>
      <span className="move-class-pill-label">{label}</span>
      <span className="move-class-pill-name">{title}</span>
      <span className="move-class-pill-delta">({sign}{(delta * 100).toFixed(1)}%)</span>
    </span>
  )
}

const CLS_ORDER = ['brilliant', 'great', 'best', 'mistake', 'blunder']
const CLS_COLOR = {
  brilliant: '#1dd1a1', great: '#5599ff', best: '#a29bfe',
  mistake:   '#ffa502', blunder: '#ff4757',
}
const CLS_COLOR_LIGHT = {
  brilliant: '#15b88f', great: '#c8960c', best: '#92400e',
  mistake:   '#e07c00', blunder: '#ff4757',
}

const ACC_HEADER_H = 18
const ACC_BAND_H   = 16
// Derive dimensions from the panel width formula (right-panel: 294px + 5vh, card padding: 10px each side)
const _VH          = window.innerHeight / 100
const ACC_W        = Math.round(294 + 5 * _VH - 20)  // exact card interior width
const ACC_PLOT_X   = 86   // label area on each side (symmetric)
const ACC_PLOT_W   = ACC_W - ACC_PLOT_X * 2           // band rect fills remaining width
const ACC_CLS_X    = 42   // classification label right edge
const ACC_LEFT_X   = 82   // left delta label right edge
const ACC_RIGHT_X  = ACC_PLOT_X + ACC_PLOT_W + 4      // right delta label start

// Theoretical delta bounds for each classification bracket (from classifyMove thresholds)
const CLS_BOUNDS = {
  brilliant: { lo: 0.05,  hi: null  },
  great:     { lo: 0.01,  hi: 0.05  },
  best:      { lo: -0.02, hi: 0.01  },
  mistake:   { lo: -0.08, hi: -0.02 },
  blunder:   { lo: null,  hi: -0.08 },
}

function accPieceCode(move) {
  if (move.san.startsWith('O-O')) return (move.color === 'white' ? 'w' : 'b') + 'K'
  const map = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' }
  return (move.color === 'white' ? 'w' : 'b') + (map[move.san[0]] || 'P')
}

function AccuracySummary({ moves, evaluations, lightMode, moveIndex, onSelectMove, onHoverMove, onLeaveMove, open }) {
  const clsColor = lightMode ? CLS_COLOR_LIGHT : CLS_COLOR
  const [hovState, setHovState] = useState(null)
  const [wAnimFrac, setWAnimFrac] = useState(0)
  const [bAnimFrac, setBAnimFrac] = useState(0)
  const wRaf = useRef(null)
  const bRaf = useRef(null)
  const containerRef = useRef(null)
  const [accW, setAccW] = useState(ACC_W)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      if (w > 0) setAccW(Math.max(ACC_W, w))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const accPlotW = accW - ACC_PLOT_X * 2
  const accRightX = ACC_PLOT_X + accPlotW + 4

  const { white: wPts, black: bPts } = useMemo(() => {
    const white = [], black = []
    moves.forEach((move, i) => {
      const prevProb = evaluations[i]?.prob ?? 0.5
      const currProb = evaluations[i + 1]?.prob ?? 0.5
      const delta = move.color === 'white' ? currProb - prevProb : prevProb - currProb
      const cls = classifyMove(prevProb, currProb, move.color)
      const pt = { delta, cls, idx: i + 1, move, timeSeconds: move.timeSeconds }
      if (move.color === 'white') white.push(pt)
      else black.push(pt)
    })
    return { white, black }
  }, [moves, evaluations])

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
  }, [open, wPts])

  useEffect(() => {
    if (!open) { cancelAnimationFrame(bRaf.current); setBAnimFrac(0); return }
    startAnim(setBAnimFrac, bRaf)
    return () => cancelAnimationFrame(bRaf.current)
  }, [open, bPts])

  function panelSvgH(pts) {
    const byClass = {}
    CLS_ORDER.forEach(c => { byClass[c] = 0 })
    pts.forEach(p => byClass[p.cls]++)
    const present = CLS_ORDER.filter(c => byClass[c] > 0)
    return ACC_HEADER_H + present.length * ACC_BAND_H
  }

  function handleEnter(pt, cx, cy, panelOffsetY) {
    setHovState({ pt, cx, cy, panelOffsetY })
    onHoverMove?.(pt.idx)
  }
  function handleLeave() {
    setHovState(null)
    onLeaveMove?.()
  }

  function renderPanel(pts, label, pieceColor, panelOffsetY, animFrac) {
    if (!pts.length) return null
    const fmt = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
    const totalDots = pts.length

    const byClass = {}
    CLS_ORDER.forEach(cls => { byClass[cls] = [] })
    pts.forEach(pt => byClass[pt.cls].push(pt))
    const present = CLS_ORDER.filter(cls => byClass[cls].length > 0)
    const svgH = ACC_HEADER_H + present.length * ACC_BAND_H

    // Precompute global dot index offset per band for sequential animation
    let cumDots = 0
    const bandOffset = {}
    present.forEach(cls => { bandOffset[cls] = cumDots; cumDots += byClass[cls].length })

    return (
      <svg width={accW} height={svgH} className="acc-svg">
        <image href={`/pieces/${pieceColor}K.svg`} x={4} y={1} width={13} height={13} />
        <text x={20} y={12} className="acc-spark-label">{label}</text>
        <g transform={`translate(${_VH * 3}, 0)`}>
        {present.map((cls, rowIdx) => {
          const rowPts = byClass[cls]
          const bandTop = ACC_HEADER_H + rowIdx * ACC_BAND_H
          const bandCy  = bandTop + ACC_BAND_H / 2
          const { lo, hi } = CLS_BOUNDS[cls]
          const color = clsColor[cls]
          const dataMin = Math.min(...rowPts.map(p => p.delta))
          const dataMax = Math.max(...rowPts.map(p => p.delta))
          const bandLo = lo !== null ? lo : dataMin
          const bandHi = hi !== null ? hi : dataMax
          const bandSpan = bandHi - bandLo
          const BAND_PAD = window.innerHeight * 0.008
          const toBandX = bandSpan < 0.0001
            ? () => ACC_PLOT_X + accPlotW / 2
            : delta => ACC_PLOT_X + BAND_PAD + ((delta - bandLo) / bandSpan) * (accPlotW - BAND_PAD * 2)

          return (
            <g key={cls}>
              <rect x={ACC_PLOT_X} y={bandTop + 2} width={accPlotW} height={ACC_BAND_H - 4}
                fill={color} opacity={0.06} rx={2} />
              <line x1={ACC_PLOT_X} y1={bandCy} x2={ACC_PLOT_X + accPlotW} y2={bandCy}
                stroke={color} strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2 3" />
              <text x={ACC_CLS_X} y={bandCy + 4} className="acc-cls-text" textAnchor="end" fill={color}>
                {cls[0].toUpperCase() + cls.slice(1)} <tspan opacity={0.6}>({rowPts.length})</tspan>
              </text>
              {lo !== null && (
                <text x={ACC_LEFT_X} y={bandCy + 4} className="acc-edge-label" textAnchor="end">
                  {fmt(lo)}
                </text>
              )}
              {rowPts.map((p, k) => {
                const cx = toBandX(p.delta)
                const isActive  = p.idx === moveIndex
                const isHovered = hovState?.pt.idx === p.idx
                const r = isActive || isHovered ? 5.5 : 3.5
                const globalIdx = bandOffset[cls] + k
                const fadeStart = globalIdx / totalDots
                const dotAnimOpacity = Math.min(1, Math.max(0, (animFrac - fadeStart) / (1 / totalDots)))
                return (
                  <circle key={k} cx={cx} cy={bandCy} r={r}
                    fill={color}
                    fillOpacity={(isActive ? 1 : 0.82) * dotAnimOpacity}
                    stroke={isActive  ? (lightMode ? '#f5c030' : 'rgba(255,255,255,0.92)') :
                            isHovered ? 'rgba(255,255,255,0.55)' : 'none'}
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => handleEnter(p, cx + _VH * 3, bandCy, panelOffsetY)}
                    onMouseLeave={handleLeave}
                    onClick={() => onSelectMove?.(p.idx)}
                  />
                )
              })}
              {hi !== null && (
                <text x={accRightX} y={bandCy + 4} className="acc-edge-label" textAnchor="start">
                  {fmt(hi)}
                </text>
              )}
            </g>
          )
        })}
        </g>
      </svg>
    )
  }

  const wH = panelSvgH(wPts)
  const TW = 164, TH = 60
  let tipStyle = null
  if (hovState) {
    const { cx, cy, panelOffsetY } = hovState
    const left = Math.min(Math.max(cx - TW / 2, 0), accW - TW)
    const absY = panelOffsetY + cy
    const top = cy < ACC_HEADER_H + ACC_BAND_H * 1.5 ? absY + 10 : absY - TH - 10
    tipStyle = { left, top }
  }

  return (
    <div ref={containerRef} className="accuracy-summary" style={{ position: 'relative' }}>
      {renderPanel(wPts, 'White', 'w', 0,        wAnimFrac)}
      {renderPanel(bPts, 'Black', 'b', wH + 10, bAnimFrac)}

      {hovState && tipStyle && (
        <div className="scatter-tooltip" style={tipStyle}>
          <div className="stt-row stt-top">
            <img src={`/pieces/${accPieceCode(hovState.pt.move)}.svg`} className="stt-piece" alt="" />
            <span className="stt-num">#{hovState.pt.idx}</span>
            <span className="stt-san">{hovState.pt.move.san}</span>
            <span className="stt-time">{hovState.pt.timeSeconds}s</span>
          </div>
          <div className="stt-row stt-bot">
            <span className="stt-cls" style={(() => {
              const c = clsColor[hovState.pt.cls]
              return { color: c, background: c + '22', borderColor: c + '55' }
            })()}>
              {hovState.pt.cls[0].toUpperCase() + hovState.pt.cls.slice(1)}
              <span className="stt-delta-inline">
                {hovState.pt.delta >= 0 ? '+' : ''}{(hovState.pt.delta * 100).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function buildGameHistory(moves) {
  const chess = new Chess()
  const history = [{ fen: chess.fen(), move: null }]
  for (const m of moves) {
    try {
      const result = chess.move(m.san)
      history.push({ fen: chess.fen(), move: result })
    } catch {
      history.push({ fen: history[history.length - 1].fen, move: null })
    }
  }
  return history
}

export default function App() {
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('lightMode') === '1')
  const [themeToggling, setThemeToggling] = useState(false)
  const [gamesList, setGamesList] = useState(defaultGames)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedGame, setSelectedGame] = useState(defaultGames[0])
  const [moveIndex, setMoveIndex] = useState(0)
  const [flashBtn, setFlashBtn] = useState(null)
  const [animatingMove, setAnimatingMove] = useState(null)
  const [showIntro, setShowIntro] = useState(true)
  const [hoveredMoveIndex, setHoveredMoveIndex] = useState(null)
  const [openCard, setOpenCard] = useState('move-quality')
  const [openCardInline, setOpenCardInline] = useState(null)
  const [hoveredPieceSquare, setHoveredPieceSquare] = useState(null)
  const [attemptMode, setAttemptMode] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [validMoves, setValidMoves] = useState([])
  const [attemptResult, setAttemptResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [timeExpired, setTimeExpired] = useState(false)
  const [revealAnimMove, setRevealAnimMove] = useState(null)
  const [revealFenReady, setRevealFenReady] = useState(false)
  const [boardFlipped, setBoardFlipped] = useState(false)
  const [piecesFlipped, setPiecesFlipped] = useState(false)
  const [squareSize, setSquareSize] = useState(60)
  const [gameAnalyses, setGameAnalyses]       = useState({})   // gameId → probs[]
  const [analysisProgress, setAnalysisProgress] = useState(null) // null | 0..1
  const analysisVersionRef = useRef(0)
  const countdownDelayRef = useRef(0)
  const attemptTimerRef  = useRef(null)
  const revealTimerRef   = useRef(null)
  const prevIndex        = useRef(0)
  const animTimerRef     = useRef(null)
  const skipNextAnimRef  = useRef(false)
  const solvedTimeRef    = useRef(null)
  const sfxRef  = useRef({})   // keyed audio elements for chess sounds
  const tickRef = useRef(null) // dedicated tick element
  const eventTagRef    = useRef(null)
  const themeToggleRef = useRef(null)
  const headerMetaRef  = useRef(null)
  const whiteRatingRef = useRef(null)
  const blackRatingRef = useRef(null)

  const play = useCallback((move) => {
    if (!move) return
    let key = 'move'
    if      (move.san?.includes('#') || move.san?.includes('+'))     key = 'check'
    else if (move.flags?.includes('c') || move.flags?.includes('e')) key = 'capture'
    else if (move.flags?.includes('k') || move.flags?.includes('q')) key = 'castle'
    else if (move.flags?.includes('p'))                               key = 'promote'
    const el = sfxRef.current[key]
    if (!el) return
    el.currentTime = 0
    el.play().catch(() => {})
  }, [])

  const playTick = useCallback(() => {
    const el = tickRef.current
    if (!el) return
    el.currentTime = 0
    el.play().catch(() => {})
  }, [])

  const history = useMemo(
    () => buildGameHistory(selectedGame.moves),
    [selectedGame]
  )

  // Run Stockfish on any game that doesn't have cached results yet
  useEffect(() => {
    if (gameAnalyses[selectedGame.id]) return
    const version = ++analysisVersionRef.current
    setAnalysisProgress(0)
    const fens = buildGameHistory(selectedGame.moves).map(h => h.fen)
    analyseGame(
      fens,
      (done, total) => {
        if (analysisVersionRef.current !== version) return
        setAnalysisProgress(done / total)
      },
      () => analysisVersionRef.current !== version
    ).then(probs => {
      if (analysisVersionRef.current !== version || !probs) return
      setGameAnalyses(prev => ({ ...prev, [selectedGame.id]: probs }))
      setAnalysisProgress(null)
    })
  }, [selectedGame.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Responsive square size: fill timeline width (vw − 144px) when clock is hidden
  useEffect(() => {
    function update() {
      if (window.innerWidth <= 836) {
        setSquareSize(Math.max(28, (window.innerWidth - 144) / 8))
      } else {
        setSquareSize(60)
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Hide event-tag when:
  //  (a) its text wraps to more than one line, OR
  //  (b) its right edge approaches the right edge of the theme toggle.
  // useLayoutEffect runs synchronously before paint — no flicker.
  useLayoutEffect(() => {
    const el = eventTagRef.current
    const toggle = themeToggleRef.current
    if (!el) return
    const check = () => {
      // Temporarily reveal for measurement
      el.style.display = ''
      // (a) multiline: compare nowrap height vs natural height
      el.style.whiteSpace = 'nowrap'
      const singleH = el.scrollHeight
      el.style.whiteSpace = ''
      const isMultiline = el.scrollHeight > singleH
      // (b) proximity: hide when toggle right edge is within 40px of label right edge
      const tagRight = el.getBoundingClientRect().right
      const toggleRight = toggle ? toggle.getBoundingClientRect().right : window.innerWidth - 32
      const tooClose = toggleRight - tagRight < 40
      el.style.display = (isMultiline || tooClose) ? 'none' : ''
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [selectedGame.id])

  // Progressive header-meta hiding as the toggle's right edge closes in:
  //  1. Show everything → measure → if toggle within 40px of meta right → hide ratings.
  //  2. Re-measure without ratings → if still within 40px → hide entire meta row.
  // Single check, two thresholds, no coordination issues between the two levels.
  useLayoutEffect(() => {
    const toggle = themeToggleRef.current
    const meta   = headerMetaRef.current
    const wr     = whiteRatingRef.current
    const br     = blackRatingRef.current
    if (!toggle || !meta) return
    const check = () => {
      // Reveal everything for measurement
      meta.style.display = ''
      if (wr) wr.style.display = ''
      if (br) br.style.display = ''
      const toggleRight = toggle.getBoundingClientRect().right
      // Level 1: full-width measure → hide ratings if close
      const fullMetaRight = meta.getBoundingClientRect().right
      const hideRatings = toggleRight - fullMetaRight < 40
      if (wr) wr.style.display = hideRatings ? 'none' : ''
      if (br) br.style.display = hideRatings ? 'none' : ''
      // Level 2: re-measure without ratings → hide entire meta if still close
      const slimMetaRight = meta.getBoundingClientRect().right
      meta.style.display = toggleRight - slimMetaRight < 40 ? 'none' : ''
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [selectedGame.id])

  const effectiveProbs = gameAnalyses[selectedGame.id] ?? selectedGame.probs

  const evaluations = useMemo(
    () => history.map(({ fen }, i) => {
      let prob = effectiveProbs?.[i] ?? 0.5
      try {
        const chess = new Chess(fen)
        if (chess.isCheckmate()) prob = chess.turn() === 'w' ? 0 : 1
      } catch {}
      return { prob }
    }),
    [history, effectiveProbs]
  )

  const { fen, move: lastMove } = history[moveIndex]
  const currentMoveData = moveIndex > 0 ? selectedGame.moves[moveIndex - 1] : null
  const totalMoves = selectedGame.moves.length

  const moveClassification = useMemo(() => {
    if (moveIndex === 0 || !currentMoveData) return null
    const prevProb = evaluations[moveIndex - 1]?.prob ?? 0.5
    const currProb = evaluations[moveIndex]?.prob ?? 0.5
    const color = currentMoveData.color
    const delta = color === 'white' ? currProb - prevProb : prevProb - currProb
    return { category: classifyMove(prevProb, currProb, color), delta }
  }, [moveIndex, evaluations, currentMoveData])

  const nextMoveIsBrilliant = useMemo(() => {
    if (moveIndex >= totalMoves) return false
    const nextMove = selectedGame.moves[moveIndex]
    const prevProb = evaluations[moveIndex]?.prob ?? 0.5
    const currProb = evaluations[moveIndex + 1]?.prob ?? 0.5
    return classifyMove(prevProb, currProb, nextMove.color) === 'brilliant'
  }, [moveIndex, totalMoves, selectedGame.moves, evaluations])


  // Start/reset countdown when attempt mode activates
  useEffect(() => {
    if (!attemptMode) {
      setTimeLeft(null)
      setTimeExpired(false)
      return
    }
    const delay = countdownDelayRef.current
    const id = setTimeout(() => {
      const duration = selectedGame.moves[moveIndex]?.timeSeconds ?? 30
      setTimeLeft(duration)
      setTimeExpired(false)
    }, delay)
    return () => clearTimeout(id)
  }, [attemptMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Chained tick — decrement every second while timer is running
  useEffect(() => {
    if (timeLeft === null || timeLeft === 0 || attemptResult) return
    const id = setTimeout(() => {
      setTimeLeft(t => Math.max(0, t - 1))
      playTick()
    }, 1000)
    return () => clearTimeout(id)
  }, [timeLeft, attemptResult, playTick])

  // Detect expiry
  useEffect(() => {
    if (timeLeft === 0 && attemptMode) setTimeExpired(true)
  }, [timeLeft, attemptMode])

  // Reveal the correct move when time expires or the user picks a square
  const revealMove = useMemo(() => {
    if (!timeExpired && !attemptResult) return null
    if (moveIndex >= totalMoves) return null
    try {
      const chess = new Chess(fen)
      const result = chess.move(selectedGame.moves[moveIndex].san)
      if (result) return { from: result.from, to: result.to, fen: chess.fen() }
    } catch {}
    return null
  }, [timeExpired, attemptResult, moveIndex, totalMoves, selectedGame, fen])

  // Reset board when game changes
  const handleCancelAttempt = useCallback(() => {
    if (attemptTimerRef.current) clearTimeout(attemptTimerRef.current)
    if (revealTimerRef.current)  clearTimeout(revealTimerRef.current)
    if (attemptResult || timeExpired) {
      skipNextAnimRef.current = true
      setMoveIndex(i => Math.min(i + 1, totalMoves))
    }
    setAttemptMode(false)
    setSelectedSquare(null)
    setValidMoves([])
    setAttemptResult(null)
    setTimeLeft(null)
    setTimeExpired(false)
    setRevealAnimMove(null)
    setRevealFenReady(false)
    setBoardFlipped(false)
    setPiecesFlipped(false)
  }, [attemptResult, timeExpired, totalMoves])


  const handleSquareClick = useCallback((squareName, piece) => {
    if (!attemptMode || attemptResult === 'correct' || timeExpired) return
    const nextMove = selectedGame.moves[moveIndex]
    if (!nextMove) return
    const activeColorChar = nextMove.color === 'white' ? 'w' : 'b'

    if (selectedSquare) {
      if (squareName === selectedSquare) {
        setSelectedSquare(null)
        setValidMoves([])
        return
      }
      if (validMoves.includes(squareName)) {
        const chess = new Chess(fen)
        const result = chess.move({ from: selectedSquare, to: squareName, promotion: 'q' })
        if (result) {
          const isCorrect = result.san === nextMove.san
          if (isCorrect) {
            solvedTimeRef.current = timeLeft
            setAttemptResult('correct')
            setSelectedSquare(null)
            setValidMoves([])
            setTimeLeft(null)
            if (attemptTimerRef.current) clearTimeout(attemptTimerRef.current)
            // Animate piece immediately, then flip to post-move FEN
            play(result)
            setRevealAnimMove(result)
            attemptTimerRef.current = setTimeout(() => {
              setRevealFenReady(true)
              setRevealAnimMove(null)
            }, 350)
          } else {
            setAttemptResult('incorrect')
            setSelectedSquare(null)
            setValidMoves([])
            setTimeLeft(null)
            if (attemptTimerRef.current) clearTimeout(attemptTimerRef.current)
            // Phase 1: animate wrong piece forward
            setRevealAnimMove({ from: result.from, to: result.to, color: result.color, piece: result.piece, san: result.san, flags: result.flags })
            try {
              const chess2 = new Chess(fen)
              const correct = chess2.move(nextMove.san)
              if (correct) {
                // Phase 2: animate wrong piece back
                revealTimerRef.current = setTimeout(() => {
                  setRevealAnimMove({ from: result.to, to: result.from, color: result.color, piece: result.piece, san: '', flags: '' })
                  // Phase 3: animate correct piece
                  revealTimerRef.current = setTimeout(() => {
                    play(correct)
                    setRevealAnimMove(correct)
                    // Phase 4: show post-move FEN
                    revealTimerRef.current = setTimeout(() => {
                      setRevealFenReady(true)
                      setRevealAnimMove(null)
                    }, 380)
                  }, 280)
                }, 280)
              }
            } catch {}
          }
        }
        return
      }
      if (piece && piece.color === activeColorChar) {
        const chess = new Chess(fen)
        const legalMoves = chess.moves({ square: squareName, verbose: true })
        setSelectedSquare(squareName)
        setValidMoves(legalMoves.map(m => m.to))
        setAttemptResult(null)
        return
      }
      setSelectedSquare(null)
      setValidMoves([])
      return
    }

    if (piece && piece.color === activeColorChar) {
      const chess = new Chess(fen)
      const legalMoves = chess.moves({ square: squareName, verbose: true })
      setSelectedSquare(squareName)
      setValidMoves(legalMoves.map(m => m.to))
    }
  }, [attemptMode, attemptResult, timeExpired, selectedSquare, validMoves, selectedGame, moveIndex, fen, play, totalMoves])

  const handleGameSelect = useCallback((game) => {
    setSelectedGame(game)
    setMoveIndex(0)
    setAnimatingMove(null)
    prevIndex.current = 0
    setShowIntro(true)
    if (attemptTimerRef.current) clearTimeout(attemptTimerRef.current)
    if (revealTimerRef.current)  clearTimeout(revealTimerRef.current)
    setAttemptMode(false)
    setSelectedSquare(null)
    setValidMoves([])
    setAttemptResult(null)
    setTimeLeft(null)
    setTimeExpired(false)
    setRevealAnimMove(null)
    setRevealFenReady(false)
    setBoardFlipped(false)
    setOpenCardInline(null)
  }, [])

  // Sound + animation on forward step
  useEffect(() => {
    const isForward = moveIndex > 0 && moveIndex === prevIndex.current + 1
    if (isForward && !skipNextAnimRef.current) {
      const move = history[moveIndex].move
      play(move)
      if (move) {
        if (animTimerRef.current) clearTimeout(animTimerRef.current)
        setAnimatingMove(move)
        animTimerRef.current = setTimeout(() => setAnimatingMove(null), 200)
      }
    } else {
      // Clear any in-flight animation when jumping, going backward, or skipping anim
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
      setAnimatingMove(null)
    }
    skipNextAnimRef.current = false
    prevIndex.current = moveIndex
  }, [moveIndex, history, play])

  const flashNavBtn = useCallback((idx) => {
    setFlashBtn(idx)
    setTimeout(() => setFlashBtn(null), 160)
  }, [])

  const handleKey = useCallback(
    (e) => {
      if (attemptMode) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setMoveIndex((i) => Math.min(i + 1, totalMoves))
        flashNavBtn(2)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setMoveIndex((i) => Math.max(i - 1, 0))
        flashNavBtn(1)
      } else if (e.key === 'Home') {
        setMoveIndex(0)
        flashNavBtn(0)
      } else if (e.key === 'End') {
        setMoveIndex(totalMoves)
        flashNavBtn(3)
      }
    },
    [totalMoves, attemptMode, flashNavBtn]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const whiteTotal = selectedGame.moves
    .filter((m) => m.color === 'white')
    .reduce((s, m) => s + m.timeSeconds, 0)
  const blackTotal = selectedGame.moves
    .filter((m) => m.color === 'black')
    .reduce((s, m) => s + m.timeSeconds, 0)

  // Time control: use exact value from game data if available, otherwise estimate
  const timeControl = useMemo(() => {
    if (selectedGame.timeControlSeconds) return selectedGame.timeControlSeconds
    const maxTotal = Math.max(whiteTotal, blackTotal)
    const withBuffer = maxTotal * 1.25
    return Math.ceil(withBuffer / 300) * 300  // round up to nearest 5 min
  }, [selectedGame, whiteTotal, blackTotal])

  return (
    <div
      className={`app${lightMode ? ' light-mode' : ''}`}
      onMouseMove={e => {
        document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`)
        document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`)
      }}
    >
      <header className="app-header">
        <div className="header-selector-row">
          <div className="game-selector-row">
            <GameSelector
              games={gamesList}
              selectedGame={selectedGame}
              onSelect={handleGameSelect}
            />
            <button
              className="add-game-btn"
              onClick={() => setShowAddModal(true)}
              title="Import a Chess.com game"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <button
            ref={themeToggleRef}
            className={`theme-toggle${lightMode ? ' theme-toggle-light' : ''}${themeToggling ? ' theme-toggle-toggling' : ''}`}
            onClick={() => {
              if (themeToggling) return
              setThemeToggling(true)
              const next = !lightMode
              setLightMode(next)
              localStorage.setItem('lightMode', next ? '1' : '0')
              setTimeout(() => setThemeToggling(false), 450)
            }}
            title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <span className="tt-track">
              <span className="tt-knob">
                <img
                  src={lightMode ? '/pieces/wN.svg' : '/pieces/bN.svg'}
                  className="tt-piece"
                  alt=""
                />
              </span>
            </span>
          </button>
        </div>
        <div ref={headerMetaRef} className="header-meta">
          <span className="player white-player">
            <img src="/pieces/wK.svg" className="player-piece white-piece-icon" alt="White" />
            {selectedGame.white}{selectedGame.whiteRating && <span ref={whiteRatingRef} className="player-rating">({selectedGame.whiteRating})</span>}
          </span>
          <span className="vs">vs</span>
          <span className="player black-player">
            <img src="/pieces/bK.svg" className="player-piece black-piece-icon" alt="Black" />
            {selectedGame.black}{selectedGame.blackRating && <span ref={blackRatingRef} className="player-rating">({selectedGame.blackRating})</span>}
          </span>
          <span ref={eventTagRef} className="event-tag">{selectedGame.event}</span>
        </div>
      </header>

      <main className="app-main">
        {/* ── Left panel ── */}
        <div className="left-panel">
          <div className="panel-section-label">Aggregate Stats</div>
          <CollapsibleCard
            title="Average Board State"
            tooltip="Ternary plot: each move is placed by the board's balance of occupied squares, squares the side to move can reach (attacked), and uncontrolled squares (free). Coloured by move classification."
            lightMode={lightMode}
            open={openCard === 'mqvs'}
            onToggle={() => setOpenCard(c => c === 'mqvs' ? null : 'mqvs')}
          >
            <MoveQualityVsSquares
              moves={selectedGame.moves}
              evaluations={evaluations}
              history={history}
              moveIndex={moveIndex}
              lightMode={lightMode}
              onMoveSelect={setMoveIndex}
              open={openCard === 'mqvs'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Board Freedom"
            tooltip="How often each square was a legal move destination across the whole game. Green = rarely reachable, yellow = average, red = most reachable. Multiple pieces able to reach the same square in a single turn all add to the count."
            lightMode={lightMode}
            open={openCard === 'attack-heatmap'}
            onToggle={() => setOpenCard(c => c === 'attack-heatmap' ? null : 'attack-heatmap')}
          >
            <AttackHeatmap
              history={history}
              whitePlayer={selectedGame.white}
              blackPlayer={selectedGame.black}
              lightMode={lightMode}
              open={openCard === 'attack-heatmap'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Squares Moved"
            open={openCard === 'squares-moved'}
            onToggle={() => setOpenCard(c => c === 'squares-moved' ? null : 'squares-moved')}
          >
            <SquaresMoved history={history} lightMode={lightMode} open={openCard === 'squares-moved'} />
          </CollapsibleCard>
          <CollapsibleCard
            title="Most Valuable Piece"
            open={openCard === 'mvp'}
            onToggle={() => setOpenCard(c => c === 'mvp' ? null : 'mvp')}
          >
            <MostValuablePiece history={history} evaluations={evaluations} lightMode={lightMode} moveIndex={moveIndex} onPieceHover={setHoveredPieceSquare} onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)} open={openCard === 'mvp'} />
          </CollapsibleCard>
        </div>

        {/* ── Right panel ── */}
        <div className="right-panel">
          <div className="panel-section-label">Move-Level Stats</div>
          <CollapsibleCard
            title="Centre Vulnerability vs Move Quality"
            tooltip="X-axis: win % change (right = good, left = bad). Y-axis: how many opponent pieces were attacking the centre. Blunders shown in red — see if they cluster under heavy central pressure."
            lightMode={lightMode}
            open={openCard === 'move-quality'}
            onToggle={() => setOpenCard(c => c === 'move-quality' ? null : 'move-quality')}
          >
            <MoveScatterPlot
              moves={selectedGame.moves}
              evaluations={evaluations}
              history={history}
              moveIndex={moveIndex}
              whitePlayer={selectedGame.white}
              blackPlayer={selectedGame.black}
              onHoverMove={setHoveredMoveIndex}
              onLeaveMove={() => setHoveredMoveIndex(null)}
              onSelectMove={setMoveIndex}
              lightMode={lightMode}
              open={openCard === 'move-quality'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Centre Control vs Win Probability"
            open={openCard === 'center-prob'}
            onToggle={() => setOpenCard(c => c === 'center-prob' ? null : 'center-prob')}
          >
            <CenterProbPlot
              moves={selectedGame.moves}
              evaluations={evaluations}
              history={history}
              moveIndex={moveIndex}
              whitePlayer={selectedGame.white}
              blackPlayer={selectedGame.black}
              onHoverMove={setHoveredMoveIndex}
              onLeaveMove={() => setHoveredMoveIndex(null)}
              onSelectMove={setMoveIndex}
              lightMode={lightMode}
              open={openCard === 'center-prob'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Clock Pressure vs Move Quality"
            tooltip="Each dot is a move. X-axis: win % change (right = good, left = bad). Y-axis: clock time remaining. Dots near the bottom were played under time pressure — see if mistakes cluster there."
            lightMode={lightMode}
            open={openCard === 'clock-quality'}
            onToggle={() => setOpenCard(c => c === 'clock-quality' ? null : 'clock-quality')}
          >
            <ClockQualityPlot
              moves={selectedGame.moves}
              evaluations={evaluations}
              moveIndex={moveIndex}
              whitePlayer={selectedGame.white}
              blackPlayer={selectedGame.black}
              onHoverMove={setHoveredMoveIndex}
              onLeaveMove={() => setHoveredMoveIndex(null)}
              onSelectMove={setMoveIndex}
              lightMode={lightMode}
              open={openCard === 'clock-quality'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Accuracy"
            open={openCard === 'accuracy'}
            onToggle={() => setOpenCard(c => c === 'accuracy' ? null : 'accuracy')}
          >
            <AccuracySummary moves={selectedGame.moves} evaluations={evaluations} lightMode={lightMode}
              moveIndex={moveIndex} onSelectMove={setMoveIndex}
              onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)}
              open={openCard === 'accuracy'} />
          </CollapsibleCard>
        </div>

        {/* ── Main content ── */}
        <div className="main-content">
        <div className="board-and-clock" style={{ '--sq': squareSize + 'px' }}>
          <div className="board-col">
            <div className="board-top-row">
              <div className="move-badge">
                {attemptMode ? (
                  attemptResult === 'correct' ? (
                    <span className="attempt-correct">Amazing, you solved it in {solvedTimeRef.current} less seconds than {(selectedGame.moves[moveIndex]?.color === 'white' ? selectedGame.white : selectedGame.black)?.split(' ')[0]}!</span>
                  ) : (attemptResult === 'incorrect' || timeExpired) ? (
                    <span className="attempt-incorrect">Sorry, but the move {(selectedGame.moves[moveIndex]?.color === 'white' ? selectedGame.white : selectedGame.black)?.split(' ')[0]} played was {selectedGame.moves[moveIndex]?.san}</span>
                  ) : (
                    <span className="attempt-label">
                      Attempting move {moveIndex + 1}
                      <span className="attempt-label-dot">·</span>
                      {selectedGame.moves[moveIndex]?.color === 'white' ? "White" : "Black"}'s turn
                    </span>
                  )
                ) : moveIndex === 0 ? (
                  <span className="badge-start">Starting Position</span>
                ) : (
                  <>
                    <span className="badge-num">Move {moveIndex}</span>
                    <span className={`badge-san ${currentMoveData.color === 'white' ? 'white-move' : 'black-move'}`}>
                      {lastMove && (
                        <img
                          src={`/pieces/${lastMove.color}${lastMove.piece.toUpperCase()}.svg`}
                          className={`badge-piece-img ${lastMove.color === 'w' ? 'badge-piece-white' : 'badge-piece-black'}`}
                          alt={lastMove.piece}
                        />
                      )}
                      {currentMoveData.san}
                    </span>
                    <MoveClassIcon classification={moveClassification?.category} delta={moveClassification?.delta} lightMode={lightMode} />
                    <span className="badge-time">{currentMoveData.timeSeconds.toFixed(2)}s</span>
                  </>
                )}
              </div>
              <div className="attempt-controls">
                {attemptMode ? (
                  <>
                    <button className="cancel-btn" onClick={handleCancelAttempt}>
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{display:'block'}}>
                        <line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/>
                        <line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/>
                      </svg>
                      End
                    </button>
                  </>
                ) : nextMoveIsBrilliant ? (
                  <button className="attempt-btn" onClick={() => {
  const isBlack = selectedGame.moves[moveIndex]?.color === 'black'
  countdownDelayRef.current = isBlack ? 1050 : 0
  setBoardFlipped(isBlack)
  setPiecesFlipped(isBlack)
  setAttemptMode(true)
}}>
                    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 1a3.2 3.2 0 0 1 2 5.7V8H4V6.7A3.2 3.2 0 0 1 6 1z"/>
                      <line x1="4.3" y1="9.2" x2="7.7" y2="9.2"/>
                      <line x1="4.8" y1="10.4" x2="7.2" y2="10.4"/>
                      <line x1="5.2" y1="11.5" x2="6.8" y2="11.5"/>
                    </svg>
                    Predict Next Move
                  </button>
                ) : null}
              </div>
            </div>
            <div className="board-row">
              <EvalBar prob={evaluations[moveIndex]?.prob ?? 0.5} />
              <Chessboard
                squareSize={squareSize}
                fen={(() => {
                  const showReveal = timeExpired || (attemptResult && revealFenReady)
                  return showReveal && revealMove ? revealMove.fen : fen
                })()}
                lastMove={(() => {
                  const showReveal = timeExpired || (attemptResult && revealFenReady)
                  return showReveal && revealMove ? null : lastMove
                })()}
                animatingMove={revealAnimMove ?? animatingMove}
                interactive={attemptMode && !attemptResult && !timeExpired}
                selectedSquare={selectedSquare}
                validMoves={validMoves}
                onSquareClick={handleSquareClick}
                flipped={boardFlipped}
                piecesFlipped={piecesFlipped}
                highlightSquare={hoveredPieceSquare}
                revealSquares={(() => {
                  const showReveal = timeExpired || (attemptResult && revealFenReady)
                  return showReveal && revealMove ? [revealMove.from, revealMove.to] : null
                })()}
                revealSrc={(() => {
                  const showReveal = timeExpired || (attemptResult && revealFenReady)
                  return showReveal && revealMove ? revealMove.from : null
                })()}
                revealDest={(() => {
                  const showReveal = timeExpired || (attemptResult && revealFenReady)
                  return showReveal && revealMove ? revealMove.to : null
                })()}
              />
              <div className="eval-spacer" />
            </div>
          </div>

          <div className="clock-col">
            {squareSize === 60 && (
              <div className="nav-buttons">
                <button onClick={() => setMoveIndex(0)} disabled={attemptMode || moveIndex === 0} title="Start (Home)" className={flashBtn === 0 ? 'nav-btn-flash' : ''}>«</button>
                <button onClick={() => setMoveIndex((i) => Math.max(i - 1, 0))} disabled={attemptMode || moveIndex === 0} title="Prev (←)" className={flashBtn === 1 ? 'nav-btn-flash' : ''}>‹</button>
                <button onClick={() => setMoveIndex((i) => Math.min(i + 1, totalMoves))} disabled={attemptMode || moveIndex === totalMoves} title="Next (→)" className={flashBtn === 2 ? 'nav-btn-flash' : ''}>›</button>
                <button onClick={() => setMoveIndex(totalMoves)} disabled={attemptMode || moveIndex === totalMoves} title="End (End)" className={flashBtn === 3 ? 'nav-btn-flash' : ''}>»</button>
              </div>
            )}
            <ChessClock
              moves={selectedGame.moves}
              moveIndex={moveIndex}
              timeControl={timeControl}
              countdownSeconds={attemptMode && timeLeft !== null ? timeLeft : null}
              isCountdownExpired={timeExpired}
            />
          </div>
        </div>
        </div>{/* end .main-content */}

        <div className="timeline-section">
          <TimelineSlider
            moves={selectedGame.moves}
            moveIndex={moveIndex}
            onChange={attemptMode ? undefined : setMoveIndex}
            evaluations={evaluations}
            hoveredMoveIndex={hoveredMoveIndex}
            attemptProgress={(() => {
              if (!attemptMode || timeLeft === null) return null
              const dur = selectedGame.moves[moveIndex]?.timeSeconds ?? 30
              return dur > 0 ? 1 - timeLeft / dur : null
            })()}
            lightMode={lightMode}
          />
        </div>

        {squareSize !== 60 && (
          <div className="nav-buttons nav-buttons-below">
            <button onClick={() => setMoveIndex(0)} disabled={attemptMode || moveIndex === 0} title="Start (Home)" className={flashBtn === 0 ? 'nav-btn-flash' : ''}>«</button>
            <button onClick={() => setMoveIndex((i) => Math.max(i - 1, 0))} disabled={attemptMode || moveIndex === 0} title="Prev (←)" className={flashBtn === 1 ? 'nav-btn-flash' : ''}>‹</button>
            <button onClick={() => setMoveIndex((i) => Math.min(i + 1, totalMoves))} disabled={attemptMode || moveIndex === totalMoves} title="Next (→)" className={flashBtn === 2 ? 'nav-btn-flash' : ''}>›</button>
            <button onClick={() => setMoveIndex(totalMoves)} disabled={attemptMode || moveIndex === totalMoves} title="End (End)" className={flashBtn === 3 ? 'nav-btn-flash' : ''}>»</button>
          </div>
        )}

        <div className="stats-bar">
          <div className="stat">
            <span className="stat-dot white-dot" />
            <span>White: {Math.floor(whiteTotal / 60)}m {(whiteTotal % 60).toFixed(2)}s</span>
          </div>
          <div className="stat">
            <span className="stat-dot black-dot" />
            <span>Black: {Math.floor(blackTotal / 60)}m {(blackTotal % 60).toFixed(2)}s</span>
          </div>
          <div className="stat hint">← → keys or drag timeline</div>
        </div>

        {/* ── Inline panels (shown when left/right panels are hidden at ≤1655px) ── */}
        <div className="inline-panels">
          <div className="panel-section-label">Aggregate Stats</div>
          <CollapsibleCard
            title="Average Board State"
            tooltip="Ternary plot: each move is placed by the board's balance of occupied squares, squares the side to move can reach (attacked), and uncontrolled squares (free). Coloured by move classification."
            lightMode={lightMode}
            open={openCardInline === 'mqvs'}
            onToggle={() => setOpenCardInline(c => c === 'mqvs' ? null : 'mqvs')}
          >
            <MoveQualityVsSquares
              moves={selectedGame.moves} evaluations={evaluations} history={history}
              moveIndex={moveIndex} lightMode={lightMode} onMoveSelect={setMoveIndex}
              open={openCardInline === 'mqvs'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Board Freedom"
            tooltip="How often each square was a legal move destination across the whole game. Green = rarely reachable, yellow = average, red = most reachable. Multiple pieces able to reach the same square in a single turn all add to the count."
            lightMode={lightMode}
            open={openCardInline === 'attack-heatmap'}
            onToggle={() => setOpenCardInline(c => c === 'attack-heatmap' ? null : 'attack-heatmap')}
          >
            <AttackHeatmap
              history={history} whitePlayer={selectedGame.white} blackPlayer={selectedGame.black}
              lightMode={lightMode} open={openCardInline === 'attack-heatmap'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Squares Moved"
            open={openCardInline === 'squares-moved'}
            onToggle={() => setOpenCardInline(c => c === 'squares-moved' ? null : 'squares-moved')}
          >
            <SquaresMoved history={history} lightMode={lightMode} open={openCardInline === 'squares-moved'} />
          </CollapsibleCard>
          <CollapsibleCard
            title="Most Valuable Piece"
            open={openCardInline === 'mvp'}
            onToggle={() => setOpenCardInline(c => c === 'mvp' ? null : 'mvp')}
          >
            <MostValuablePiece
              history={history} evaluations={evaluations} lightMode={lightMode}
              moveIndex={moveIndex} onPieceHover={setHoveredPieceSquare}
              onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)}
              open={openCardInline === 'mvp'}
            />
          </CollapsibleCard>
          <div className="panel-section-label" style={{ marginTop: 8 }}>Move-Level Stats</div>
          <CollapsibleCard
            title="Centre Vulnerability vs Move Quality"
            tooltip="X-axis: win % change (right = good, left = bad). Y-axis: how many opponent pieces were attacking the centre. Blunders shown in red — see if they cluster under heavy central pressure."
            lightMode={lightMode}
            open={openCardInline === 'move-quality'}
            onToggle={() => setOpenCardInline(c => c === 'move-quality' ? null : 'move-quality')}
          >
            <MoveScatterPlot
              moves={selectedGame.moves} evaluations={evaluations} history={history}
              moveIndex={moveIndex} whitePlayer={selectedGame.white} blackPlayer={selectedGame.black}
              onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)}
              onSelectMove={setMoveIndex} lightMode={lightMode} open={openCardInline === 'move-quality'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Centre Control vs Win Probability"
            open={openCardInline === 'center-prob'}
            onToggle={() => setOpenCardInline(c => c === 'center-prob' ? null : 'center-prob')}
          >
            <CenterProbPlot
              moves={selectedGame.moves} evaluations={evaluations} history={history}
              moveIndex={moveIndex} whitePlayer={selectedGame.white} blackPlayer={selectedGame.black}
              onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)}
              onSelectMove={setMoveIndex} lightMode={lightMode} open={openCardInline === 'center-prob'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Clock Pressure vs Move Quality"
            tooltip="Each dot is a move. X-axis: win % change (right = good, left = bad). Y-axis: clock time remaining. Dots near the bottom were played under time pressure — see if mistakes cluster there."
            lightMode={lightMode}
            open={openCardInline === 'clock-quality'}
            onToggle={() => setOpenCardInline(c => c === 'clock-quality' ? null : 'clock-quality')}
          >
            <ClockQualityPlot
              moves={selectedGame.moves} evaluations={evaluations} moveIndex={moveIndex}
              whitePlayer={selectedGame.white} blackPlayer={selectedGame.black}
              onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)}
              onSelectMove={setMoveIndex} lightMode={lightMode} open={openCardInline === 'clock-quality'}
            />
          </CollapsibleCard>
          <CollapsibleCard
            title="Accuracy"
            open={openCardInline === 'accuracy'}
            onToggle={() => setOpenCardInline(c => c === 'accuracy' ? null : 'accuracy')}
          >
            <AccuracySummary
              moves={selectedGame.moves} evaluations={evaluations} lightMode={lightMode}
              moveIndex={moveIndex} onSelectMove={setMoveIndex}
              onHoverMove={setHoveredMoveIndex} onLeaveMove={() => setHoveredMoveIndex(null)}
              open={openCardInline === 'accuracy'}
            />
          </CollapsibleCard>
        </div>

        {showIntro && (
          <VsIntro
            key={selectedGame.id}
            game={selectedGame}
            onComplete={() => setShowIntro(false)}
            analysisProgress={analysisProgress}
          />
        )}

        {/* Hidden audio elements — browser loads & buffers these natively */}
        <audio ref={el => { if (el) sfxRef.current.move    = el }} src="/sounds/move-self.mp3"  preload="auto" style={{display:'none'}} />
        <audio ref={el => { if (el) sfxRef.current.capture = el }} src="/sounds/capture.mp3"    preload="auto" style={{display:'none'}} />
        <audio ref={el => { if (el) sfxRef.current.castle  = el }} src="/sounds/castle.mp3"     preload="auto" style={{display:'none'}} />
        <audio ref={el => { if (el) sfxRef.current.check   = el }} src="/sounds/move-check.mp3" preload="auto" style={{display:'none'}} />
        <audio ref={el => { if (el) sfxRef.current.promote = el }} src="/sounds/promote.mp3"    preload="auto" style={{display:'none'}} />
        <audio ref={tickRef} src="/sounds/clock-tick.wav" preload="auto" style={{display:'none'}} />
      </main>

      {showAddModal && (
        <AddGameModal
          onAdd={(game) => {
            setGamesList(prev => [...prev, game])
            handleGameSelect(game)
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
