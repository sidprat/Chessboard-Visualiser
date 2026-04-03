import './EvalBar.css'

// prob is white win probability [0..1]
export default function EvalBar({ prob = 0.5 }) {
  const whitePct = Math.round(prob * 100)
  const blackPct = 100 - whitePct

  return (
    <div className="eval-bar-wrap">
      <div className="eval-bar">
        <div className="eval-bar-black" style={{ height: `${blackPct}%` }} />
        <div
          className="eval-bar-divider"
          style={{ top: `${blackPct}%` }}
        />
        <div className="eval-bar-white" style={{ height: `${whitePct}%` }} />
      </div>
      <span className="eval-label">{whitePct}%</span>
    </div>
  )
}
