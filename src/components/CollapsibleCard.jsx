import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import './CollapsibleCard.css'

export default function CollapsibleCard({ title, tooltip, children, open, onToggle, lightMode }) {
  const iconRef = useRef(null)
  const [tipPos, setTipPos] = useState(null)

  function handleEnter() {
    if (!iconRef.current) return
    const r = iconRef.current.getBoundingClientRect()
    setTipPos({ left: r.left + r.width / 2, top: r.bottom + 8 })
  }

  return (
    <div className={`ccard ${open ? 'ccard-open' : 'ccard-closed'}`}>
      <button className="ccard-header" onClick={onToggle}>
        <span className="ccard-title-row">
          <span className="ccard-title">{title}</span>
          {tooltip && (
            <span
              ref={iconRef}
              className="ccard-info"
              onMouseEnter={handleEnter}
              onMouseLeave={() => setTipPos(null)}
              onClick={e => e.stopPropagation()}
            >
              <svg className="ccard-info-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="8" r="1.2" fill="currentColor"/>
                <line x1="12" y1="11.5" x2="12" y2="16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          )}
        </span>
        <span className={`ccard-led ${open ? 'ccard-led-on' : ''}`} />
      </button>
      {open && <div className="ccard-body">{children}</div>}

      {tipPos && createPortal(
        <div
          className={`ccard-info-tip${lightMode ? ' ccard-info-tip-light' : ''}`}
          style={{ left: tipPos.left, top: tipPos.top }}
        >
          {tooltip}
        </div>,
        document.body
      )}
    </div>
  )
}
