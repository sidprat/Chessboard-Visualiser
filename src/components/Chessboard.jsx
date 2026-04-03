import { useMemo, useRef, useLayoutEffect } from 'react'
import { Chess } from 'chess.js'
import './Chessboard.css'

const PIECE_IMAGES = {
  wK: '/pieces/wK.svg', wQ: '/pieces/wQ.svg', wR: '/pieces/wR.svg',
  wB: '/pieces/wB.svg', wN: '/pieces/wN.svg', wP: '/pieces/wP.svg',
  bK: '/pieces/bK.svg', bQ: '/pieces/bQ.svg', bR: '/pieces/bR.svg',
  bB: '/pieces/bB.svg', bN: '/pieces/bN.svg', bP: '/pieces/bP.svg',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']
const SQUARE_SIZE = 60


function squareToCoords(square) {
  const fileIdx = square.charCodeAt(0) - 97
  const rankIdx = 8 - parseInt(square[1])
  return { x: fileIdx * SQUARE_SIZE, y: rankIdx * SQUARE_SIZE }
}

function Piece({ pieceKey }) {
  return <img src={PIECE_IMAGES[pieceKey]} alt={pieceKey} className="chess-piece-img" />
}

export default function Chessboard({ fen, lastMove, animatingMove, interactive, selectedSquare, validMoves, onSquareClick, revealSquares, revealSrc, revealDest, flipped, piecesFlipped, highlightSquare }) {
  const board = useMemo(() => {
    try { return new Chess(fen).board() }
    catch { return new Chess().board() }
  }, [fen])

  const overlayRef  = useRef(null)
  const rafRef      = useRef(null)
  const frameRef    = useRef(null)
  const cursorRef   = useRef(null)

  useLayoutEffect(() => {
    if (!animatingMove || !overlayRef.current) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const from = squareToCoords(animatingMove.from)
    const to   = squareToCoords(animatingMove.to)
    const el   = overlayRef.current

    el.style.transition = 'none'
    el.style.transform  = `translate(${from.x}px, ${from.y}px)`

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (!el) return
        el.style.transition = 'transform 0.16s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        el.style.transform  = `translate(${to.x}px, ${to.y}px)`
      })
    })

    return () => cancelAnimationFrame(rafRef.current)
  }, [animatingMove])

  const animatingTo = animatingMove?.to ?? null

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
    <div
      ref={frameRef}
      className={`board-outer-frame${flipped ? ' flipped' : ''}${piecesFlipped ? ' pieces-flipped' : ''}`}
      onMouseMove={e => {
        const rect = frameRef.current?.getBoundingClientRect()
        if (!rect || !cursorRef.current) return
        let x = e.clientX - rect.left
        let y = e.clientY - rect.top
        if (flipped) { x = rect.width - x; y = rect.height - y }
        cursorRef.current.style.background =
          `radial-gradient(circle 180px at ${x}px ${y}px, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 50%, transparent 72%)`
        cursorRef.current.style.opacity = '1'
      }}
      onMouseLeave={() => { if (cursorRef.current) cursorRef.current.style.opacity = '0' }}
    >
      <div className="board-edge board-edge-h">
        {FILES.map(f => <span key={f} className="board-coord">{f}</span>)}
      </div>

      <div className="board-middle-row">
        <div className="board-edge board-edge-v">
          {RANKS.map(r => <span key={r} className="board-coord">{r}</span>)}
        </div>

        <div className="board-well">
          <div className={`chessboard${interactive ? ' attempt-active' : ''}`}>
            {board.map((row, rankIdx) =>
              row.map((square, fileIdx) => {
                const isLight    = (rankIdx + fileIdx) % 2 === 0
                const squareName = FILES[fileIdx] + RANKS[rankIdx]
                const isLastMove = lastMove && (lastMove.from === squareName || lastMove.to === squareName)
                const pieceKey   = square ? square.color + square.type.toUpperCase() : null
                const hideForAnim = animatingTo === squareName || animatingMove?.from === squareName
                const isSelected  = interactive && selectedSquare === squareName
                const isValidMove = interactive && validMoves?.includes(squareName)
                const isReveal     = revealSquares?.includes(squareName)
                const isRevealSrc  = revealSrc === squareName
                const isRevealDest = revealDest === squareName
                const isMvp        = highlightSquare === squareName

                return (
                  <div
                    key={squareName}
                    className={[
                      'square',
                      isLight    ? 'light'       : 'dark',
                      isLastMove ? 'highlight'   : '',
                      isSelected ? 'sq-selected' : '',
                      isValidMove ? 'sq-valid'   : '',
                      isReveal     ? 'sq-reveal'      : '',
                      isRevealSrc  ? 'sq-reveal-src'  : '',
                      isRevealDest ? 'sq-reveal-dest' : '',
                      isMvp        ? 'sq-mvp'         : '',
                    ].join(' ')}
                    onClick={interactive ? () => onSquareClick?.(squareName, square) : undefined}
                  >
                    {pieceKey && !hideForAnim && <Piece pieceKey={pieceKey} />}
                    {isValidMove && <div className="valid-move-dot" />}
                  </div>
                )
              })
            )}

            {animatingMove && (
              <div ref={overlayRef} className="piece-overlay">
                <img
                  src={PIECE_IMAGES[animatingMove.color + animatingMove.piece.toUpperCase()]}
                  alt={animatingMove.piece}
                  className="chess-piece-img"
                />
              </div>
            )}
          </div>
        </div>

        <div className="board-edge board-edge-v">
          {RANKS.map(r => <span key={r} className="board-coord">{r}</span>)}
        </div>
      </div>

      <div className="board-edge board-edge-h">
        {FILES.map(f => <span key={f} className="board-coord">{f}</span>)}
      </div>

      {/* Cursor reflection overlay */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none', zIndex: 30,
          opacity: 0,
          mixBlendMode: 'screen',
        }}
      />
    </div>
    </div>
  )
}
