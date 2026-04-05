import { useState, useRef, useCallback, useMemo } from 'react'
import { classifyMove } from '../utils/evaluate'
import './TimelineSlider.css'

const CLASSIFICATION_COLORS = {
  brilliant: '#1dd1a1',
  great:     '#5599ff',
  best:      '#a29bfe',
  mistake:   '#ffa502',
  blunder:   '#ff4757',
}

const CLASSIFICATION_COLORS_LIGHT = {
  brilliant: '#15b88f',
  great:     '#c8960c',
  best:      '#92400e',
  mistake:   '#e07c00',
  blunder:   '#ff4757',
}

function buildLinearPath(points, W, H) {
  if (points.length < 2) return ''
  let d = `M ${(points[0].x * W).toFixed(2)} ${(points[0].y * H).toFixed(2)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${(points[i].x * W).toFixed(2)} ${(points[i].y * H).toFixed(2)}`
  }
  return d
}

function buildSegmentPath(points, segIdx, W, H) {
  const p1 = points[segIdx], p2 = points[segIdx + 1]
  return `M ${(p1.x*W).toFixed(2)} ${(p1.y*H).toFixed(2)} L ${(p2.x*W).toFixed(2)} ${(p2.y*H).toFixed(2)}`
}

function getPieceCode(move) {
  if (move.san.startsWith('O-O')) return (move.color === 'white' ? 'w' : 'b') + 'K'
  const pieceLetters = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' }
  const piece = pieceLetters[move.san[0]] || 'P'
  return (move.color === 'white' ? 'w' : 'b') + piece
}

export default function TimelineSlider({ moves, moveIndex, onChange, evaluations, hoveredMoveIndex, attemptProgress, lightMode, challengeMoveIndex }) {
  const trackRef = useRef(null)
  const isDragging = useRef(false)
  const [hoverState, setHoverState] = useState(null)

  const totalTime = useMemo(
    () => moves.reduce((s, m) => s + m.timeSeconds, 0),
    [moves]
  )

  const boundaryRatios = useMemo(() => {
    const ratios = [0]
    let cum = 0
    for (const m of moves) {
      cum += m.timeSeconds
      ratios.push(cum / totalTime)
    }
    return ratios
  }, [moves, totalTime])

  const centerRatios = useMemo(
    () => moves.map((_, i) => (boundaryRatios[i] + boundaryRatios[i + 1]) / 2),
    [moves, boundaryRatios]
  )

  const W = 1000, H = 100
  const probGraph = useMemo(() => {
    if (!evaluations || evaluations.length < 2) return null
    const points = evaluations.map((ev, i) => ({
      x: boundaryRatios[i],
      y: 1 - ev.prob,
    }))
    const fullPath = buildLinearPath(points, W, H)
    const whiteFill = fullPath + ` L ${W} ${H} L 0 ${H} Z`
    const segments = moves.map((move, i) => {
      const category = classifyMove(evaluations[i].prob, evaluations[i + 1].prob, move.color)
      const colors = lightMode ? CLASSIFICATION_COLORS_LIGHT : CLASSIFICATION_COLORS
      return {
        path: buildSegmentPath(points, i, W, H),
        color: colors[category],
      }
    })
    return { whiteFill, fullPath, segments }
  }, [evaluations, boundaryRatios, moves, lightMode])

  const baseHandleRatio = moveIndex === 0 ? 0 : centerRatios[moveIndex - 1]
  const handleRatio = useMemo(() => {
    if (attemptProgress === null || attemptProgress === undefined || !centerRatios[moveIndex]) return baseHandleRatio
    return baseHandleRatio + (centerRatios[moveIndex] - baseHandleRatio) * Math.min(1, attemptProgress)
  }, [attemptProgress, baseHandleRatio, centerRatios, moveIndex])

  const getBoundaryFromRatio = useCallback(
    (r) => {
      const clamped = Math.max(0, Math.min(1, r))
      for (let i = 0; i < moves.length; i++) {
        if (clamped < boundaryRatios[i + 1]) return i + 1
      }
      return moves.length
    },
    [moves.length, boundaryRatios]
  )

  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault()
      isDragging.current = true

      const update = (ev) => {
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))

        let hoveredIdx = moves.length - 1
        for (let i = 0; i < moves.length; i++) {
          if (ratio < boundaryRatios[i + 1]) { hoveredIdx = i; break }
        }

        onChange(getBoundaryFromRatio(ratio))
        setHoverState({ moveIdx: hoveredIdx, x: clientX - rect.left, trackWidth: rect.width })
      }

      update(e)

      const onMove = (ev) => { if (isDragging.current) update(ev) }
      const onUp = () => {
        isDragging.current = false
        setHoverState(null)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onUp)
    },
    [getBoundaryFromRatio, onChange, moves.length, boundaryRatios]
  )

  const handleKnobPointerDown = useCallback((e) => {
    e.stopPropagation()
    handlePointerDown(e)
  }, [handlePointerDown])

  const handleSegmentClick = useCallback(
    (segmentIndex) => { onChange(segmentIndex + 1) },
    [onChange]
  )

  const handleMouseMove = useCallback((e) => {
    if (isDragging.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    let hoveredIdx = moves.length - 1
    for (let i = 0; i < moves.length; i++) {
      if (ratio < boundaryRatios[i + 1]) { hoveredIdx = i; break }
    }
    setHoverState({ moveIdx: hoveredIdx, x, trackWidth: rect.width })
  }, [moves.length, boundaryRatios])

  const handleMouseLeave = useCallback(() => setHoverState(null), [])

  return (
    <div className="timeline-wrapper">
      <div className="timeline-labels">
        <span>Start</span>
        <span className="timeline-time-total">
          Total: {Math.floor(totalTime / 60)}m {(totalTime % 60).toFixed(2)}s
        </span>
        <span>End</span>
      </div>

      <div
        className="timeline-track"
        ref={trackRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Segments */}
        {moves.map((move, i) => {
          const widthPct = (move.timeSeconds / totalTime) * 100
          const isPlayed = i < moveIndex
          const isCurrent = i === moveIndex - 1
          const isHovered = hoveredMoveIndex === i + 1 && !isCurrent
          return (
            <div
              key={i}
              className={[
                'timeline-segment',
                move.color === 'white' ? 'seg-white' : 'seg-black',
                isPlayed   ? 'played'  : '',
                isCurrent  ? 'current' : '',
                isHovered  ? 'ext-hovered' : '',
              ].join(' ')}
              style={{ width: `${widthPct}%` }}
              onClick={() => handleSegmentClick(i)}
              title={`Move ${i + 1}: ${move.san} (${move.color}, ${move.timeSeconds.toFixed(2)}s)`}
            />
          )
        })}

        {/* Win probability overlay */}
        {probGraph && (
          <svg className="win-prob-overlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <line x1="0" y1="50" x2={W} y2="50" className="prob-midline" vectorEffect="non-scaling-stroke" />
            <path d={probGraph.whiteFill} className="prob-white-fill" />
            <path d={probGraph.fullPath} className="prob-curve" fill="none" vectorEffect="non-scaling-stroke" />
            {probGraph.segments.map((seg, i) => (
              <path
                key={i} d={seg.path} fill="none"
                stroke={seg.color} strokeWidth="1.5" strokeOpacity="0.85"
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1={handleRatio * W} y1="0" x2={handleRatio * W} y2={H}
              className="prob-playhead" vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* Handle */}
        <div
          className={`timeline-handle${attemptProgress != null ? ' timeline-handle-animate' : ''}`}
          style={{ left: `calc(${handleRatio * 100}% - 1px)` }}
        >
          <div className="handle-line" />
          <div
            className="handle-knob"
            onMouseDown={handleKnobPointerDown}
            onTouchStart={handleKnobPointerDown}
          />
        </div>

        {/* Challenge move indicator */}
        {challengeMoveIndex != null && challengeMoveIndex > 0 && challengeMoveIndex <= moves.length && (() => {
          const dotIdx = challengeMoveIndex - 1
          const midRatio = (boundaryRatios[dotIdx] + boundaryRatios[dotIdx + 1]) / 2
          return (
            <div
              className={`challenge-dot${lightMode ? ' challenge-dot-light' : ''}`}
              style={{ left: `${midRatio * 100}%` }}
            />
          )
        })()}

        {/* Hover tooltip */}
        {hoverState && (() => {
          const { moveIdx, x, trackWidth } = hoverState
          const move = moves[moveIdx]
          if (!move) return null

          const WINDOW = 3
          const start = Math.max(0, moveIdx - WINDOW)
          const end = Math.min(moves.length - 1, moveIdx + WINDOW)
          const vxLeft  = boundaryRatios[start] * W
          const vxRight = boundaryRatios[end + 1] * W

          const tooltipWidth = 248
          const tooltipLeft = Math.max(0, Math.min(x - tooltipWidth / 2, trackWidth - tooltipWidth))

          return (
            <div className="timeline-tooltip" style={{ left: tooltipLeft, width: tooltipWidth }}>
              {/* Zoomed mini timeline */}
              <svg
                className="tooltip-mini-timeline"
                viewBox={`${vxLeft} 0 ${vxRight - vxLeft} 100`}
                preserveAspectRatio="none"
                width="100%"
                height="52"
              >
                {/* Segment backgrounds */}
                {Array.from({ length: end - start + 1 }, (_, k) => {
                  const i = start + k
                  const rx1 = boundaryRatios[i] * W
                  const rx2 = boundaryRatios[i + 1] * W
                  return (
                    <rect
                      key={i} x={rx1} y={0} width={rx2 - rx1} height={100}
                      fill={moves[i].color === 'white' ? (lightMode ? '#e8d0a0' : '#c8c8e0') : (lightMode ? '#7a4c28' : '#2a2a4a')}
                      opacity={i === moveIdx ? 0.6 : 0.28}
                    />
                  )
                })}
                {/* Active segment — glow layer */}
                <rect
                  x={boundaryRatios[moveIdx] * W} y={0}
                  width={(boundaryRatios[moveIdx + 1] - boundaryRatios[moveIdx]) * W}
                  height={100} fill="none"
                  stroke="rgba(255,255,255,0.18)" strokeWidth="8"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Active segment — sharp white stroke */}
                <rect
                  x={boundaryRatios[moveIdx] * W} y={1}
                  width={(boundaryRatios[moveIdx + 1] - boundaryRatios[moveIdx]) * W}
                  height={98} fill="none"
                  stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Midline */}
                <line
                  x1={vxLeft} y1="50" x2={vxRight} y2="50"
                  stroke={lightMode ? 'rgba(120,80,20,0.3)' : 'rgba(120,120,180,0.3)'} strokeWidth="1"
                  strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
                />
                {/* Colored prob segments */}
                {probGraph && probGraph.segments.slice(start, end + 1).map((seg, k) => (
                  <path
                    key={k} d={seg.path} fill="none"
                    stroke={seg.color || (lightMode ? 'rgba(120,80,20,0.85)' : 'rgba(160,160,255,0.85)')}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {/* Playhead at band centre */}
                <line
                  x1={centerRatios[moveIdx] * W} y1="0"
                  x2={centerRatios[moveIdx] * W} y2="100"
                  stroke={lightMode ? '#b07d10' : '#7c7cff'} strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Move info */}
              <div className="tooltip-move-info">
                <img
                  src={`/pieces/${getPieceCode(move)}.svg`}
                  className="tooltip-piece"
                  alt={move.san}
                />
                <span className="tooltip-move-num">Move {moveIdx + 1}</span>
                <span className="tooltip-san">{move.san}</span>
                <span className="tooltip-time">{move.timeSeconds.toFixed(2)}s</span>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="timeline-move-markers">
        {moves.map((_, i) => (
          i % 2 === 0 && (
            <div
              key={i}
              className="move-number-marker"
              style={{ left: `${boundaryRatios[i] * 100}%` }}
            >
              {i / 2 + 1}
            </div>
          )
        ))}
      </div>
    </div>
  )
}
