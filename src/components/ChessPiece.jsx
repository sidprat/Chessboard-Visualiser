// Orthographic chess pieces — slight top-front viewing angle, 60×60 viewBox.
// Color classes: pc-a (top/lightest) · pc-b (front face) · pc-c (shadow/side)
//               pc-hi (diffuse highlight) · pc-shine (specular) · pc-detail (engraving)
import './ChessPiece.css'

// ─── Shared base structure ────────────────────────────────────────────────────
// Drawn back-to-front (painter's algorithm).
// Base disc: rx=13, cy=53.  Waist: rx=9, cy=48.
function Base() {
  return (
    <>
      {/* Base cylinder wall */}
      <path className="pc-c"
        d="M 17,53 L 17,57 Q 30,60.5 43,57 L 43,53 Q 30,56.5 17,53 Z" />
      {/* Base top face */}
      <ellipse cx="30" cy="53" rx="13" ry="3.5" className="pc-b" />
      {/* Step (conical frustum connecting base to waist) */}
      <path className="pc-c"
        d="M 17,53 L 21,48.5 L 39,48.5 L 43,53 Q 30,56.5 17,53 Z" />
      {/* Waist top face */}
      <ellipse cx="30" cy="48.5" rx="9" ry="2.4" className="pc-b" />
    </>
  )
}

// ─── PAWN ─────────────────────────────────────────────────────────────────────
function Pawn() {
  return (
    <g>
      <Base />
      {/* Body — tapered cylinder from waist to neck */}
      <path className="pc-b"
        d="M 21,48.5 C 18,43 18,38 20,34.5 Q 24,32 30,32 Q 36,32 40,34.5 C 42,38 42,43 39,48.5 Z" />
      <path className="pc-c"
        d="M 21,48.5 C 18,43 18.5,41.5 20.5,40 Q 25,42.5 30,43 Q 35,42.5 39.5,40 C 41.5,41.5 42,43 39,48.5 Z" />
      <path className="pc-detail" d="M 22,40.5 Q 30,44 38,40.5" strokeWidth="1" />
      {/* Body top face */}
      <ellipse cx="30" cy="34.5" rx="8.5" ry="2.2" className="pc-a" />
      {/* Neck collar */}
      <path className="pc-c"
        d="M 21.5,34.5 L 19.5,38 L 40.5,38 L 38.5,34.5 Z" />
      <ellipse cx="30" cy="38" rx="8" ry="2.1" className="pc-b" />
      {/* Head — sphere, viewed from slight above */}
      <path className="pc-b"
        d="M 19.5,38 C 17,33.5 17,26 19.5,21 Q 24,17 30,17 Q 36,17 40.5,21 C 43,26 43,33.5 40.5,38 Z" />
      <path className="pc-c"
        d="M 19.5,38 C 17,33.5 17.5,30.5 20,28.5 Q 24.5,30.5 30,31 Q 35.5,30.5 40,28.5 C 42.5,30.5 43,33.5 40.5,38 Z" />
      {/* Head top cap — sphere lit from above */}
      <ellipse cx="30" cy="21.5" rx="10.5" ry="6.5" className="pc-a" />
      <ellipse cx="27.5" cy="18.5" rx="6"   ry="4"   className="pc-hi" />
      <ellipse cx="25.5" cy="16.5" rx="3"   ry="2.2" className="pc-shine" />
    </g>
  )
}

// ─── ROOK ─────────────────────────────────────────────────────────────────────
function Rook() {
  return (
    <g>
      <Base />
      {/* Tower body */}
      <path className="pc-b"
        d="M 21,48.5 L 21,22.5 L 39,22.5 L 39,48.5 Z" />
      {/* Tower body left shadow strip */}
      <path className="pc-c"
        d="M 21,48.5 L 21,22.5 L 25.5,22.5 L 25.5,48.5 Z" />
      {/* Tower body top face */}
      <ellipse cx="30" cy="22.5" rx="9" ry="2.3" className="pc-a" />
      {/* Engraving bands */}
      <path className="pc-detail" d="M 21,43 L 39,43" strokeWidth="0.8" />
      <path className="pc-detail" d="M 21,36 L 39,36" strokeWidth="0.8" />
      {/* Gallery / platform (wider section) */}
      <path className="pc-c"
        d="M 21,22.5 L 15.5,19 L 44.5,19 L 39,22.5 Z" />
      <ellipse cx="30" cy="19" rx="14.5" ry="3.6" className="pc-b" />
      {/* Battlement base edge highlight */}
      <path className="pc-hi"
        d="M 15.5,19 A 14.5,3.6 0 0,0 44.5,19 Q 43.5,16.5 30,15.5 Q 16.5,16.5 15.5,19 Z" />
      {/* Three merlons */}
      {[
        { x: 16.5, tw: 7 },
        { x: 26.5, tw: 7 },
        { x: 36.5, tw: 7 },
      ].map(({ x, tw }, i) => (
        <g key={i}>
          <path className="pc-b"
            d={`M ${x},19 L ${x},9 L ${x + tw},9 L ${x + tw},19 Z`} />
          {/* Left shadow strip on merlon */}
          <path className="pc-c"
            d={`M ${x},19 L ${x},9 L ${x + 2.2},9 L ${x + 2.2},19 Z`} />
          {/* Merlon top face */}
          <ellipse cx={x + tw / 2} cy="9.5" rx={tw / 2} ry="1.2" className="pc-a" />
          <ellipse cx={x + tw / 2 - 0.8} cy="8.5" rx={tw / 2 - 1.5} ry="0.8" className="pc-hi" />
        </g>
      ))}
      {/* Gap shadows (between merlons) */}
      <rect x="24"   y="10.5" width="2.5" height="8.5" className="pc-c" />
      <rect x="34"   y="10.5" width="2.5" height="8.5" className="pc-c" />
    </g>
  )
}

// ─── BISHOP ───────────────────────────────────────────────────────────────────
function Bishop() {
  return (
    <g>
      <Base />
      {/* Body */}
      <path className="pc-b"
        d="M 21,48.5 C 18.5,43 18,35 20,30 Q 23.5,26.5 30,26.5 Q 36.5,26.5 40,30 C 42,35 41.5,43 39,48.5 Z" />
      <path className="pc-c"
        d="M 21,48.5 C 18.5,43 19,40.5 21,38.5 Q 25,41 30,41.5 Q 35,41 39,38.5 C 41,40.5 41.5,43 39,48.5 Z" />
      <path className="pc-detail" d="M 21,39.5 Q 30,43 39,39.5" strokeWidth="0.9" />
      <path className="pc-detail" d="M 21.5,33  Q 30,36 38.5,33" strokeWidth="0.8" />
      {/* Body top */}
      <ellipse cx="30" cy="30" rx="8.5" ry="2.2" className="pc-a" />
      {/* Collar ring */}
      <path className="pc-c"
        d="M 21.5,30 L 18,33.5 L 42,33.5 L 38.5,30 Z" />
      <ellipse cx="30" cy="33.5" rx="11" ry="2.8" className="pc-b" />
      <path className="pc-hi"
        d="M 19,33.5 A 11,2.8 0 0,0 41,33.5 Q 38.5,31.5 30,31 Q 21.5,31.5 19,33.5 Z" />
      {/* Mitre body */}
      <path className="pc-b"
        d="M 19,33.5 C 19,31 21,24.5 23.5,18.5 C 25.5,13.5 28,9.5 30,7.5 C 32,9.5 34.5,13.5 36.5,18.5 C 39,24.5 41,31 41,33.5 A 11,2.8 0 0,1 19,33.5 Z" />
      {/* Mitre left shadow face */}
      <path className="pc-c"
        d="M 19,33.5 C 19,31 20.5,25.5 22.5,20 Q 26,25 30,27 Q 26,22.5 23.5,18.5 C 22,14 20.5,10 19.5,7.5 Q 20.5,7 22,7.5 C 24,11 26.5,16 28,20.5 Q 29,23.5 30,27 L 30,27 C 29,24.5 27,19.5 25.5,14 Q 27.5,9 30,7.5 C 30,7.5 28,10 27,14.5 Q 24.5,23 22,32 L 19,33.5 Z"
        opacity="0.5" />
      {/* Mitre slit */}
      <path className="pc-c"
        d="M 28.5,12.5 Q 30,10.5 31.5,12.5 Q 30.5,16 30,18.5 Q 29.5,16 28.5,12.5 Z" />
      {/* Mitre top */}
      <ellipse cx="30" cy="10" rx="5" ry="4.5" className="pc-a" />
      {/* Ball finial */}
      <circle cx="30" cy="7" r="3.2" className="pc-b" />
      <ellipse cx="29.2" cy="5.5" rx="2" ry="1.6" className="pc-hi" />
      <ellipse cx="28.5" cy="4.8" rx="1.1" ry="0.9" className="pc-shine" />
    </g>
  )
}

// ─── KNIGHT ───────────────────────────────────────────────────────────────────
// Slightly-turned horse head — 3/4 front facing right.
function Knight() {
  return (
    <g>
      <Base />
      {/* Chest / neck column */}
      <path className="pc-b"
        d="M 21,48.5 C 19,44 18.5,39 20,35 C 21.5,31.5 24,29 27,28 L 33,28 C 36,29 38.5,31.5 40,35 C 41.5,39 41,44 39,48.5 Z" />
      <path className="pc-c"
        d="M 21,48.5 C 19,44 19.5,42 21.5,40.5 Q 25.5,42.5 30,43 Q 34.5,42.5 38.5,40.5 C 40.5,42 41,44 39,48.5 Z" />
      <path className="pc-detail" d="M 22,41.5 Q 30,44.5 38,41.5" strokeWidth="0.9" />
      {/* Chest top */}
      <ellipse cx="30" cy="35" rx="9" ry="2.3" className="pc-a" />
      {/* Neck */}
      <path className="pc-b"
        d="M 23,35 C 21,32 20.5,27.5 22,24 Q 25,21 30,21 Q 35,21 38,24 C 39.5,27.5 39,32 37,35 Z" />
      {/* Head main form — viewed 3/4 from above */}
      <path className="pc-b"
        d="M 20,24 C 18,20.5 17.5,14.5 19.5,10.5 Q 22.5,7 28,6.5 Q 33,6 37,8 Q 40.5,10.5 41.5,14 C 42.5,18 41,22.5 38,25.5 Q 34.5,27.5 30,28 Q 25,28 22,26 Z" />
      {/* Head right shadow */}
      <path className="pc-c"
        d="M 20,24 C 18,20.5 18,17 20,14 Q 23.5,16 30,17 Q 36.5,16 40,14 C 42,17 42.5,20.5 41.5,24 Q 38,27 33,28 Q 26.5,28 22,26 Z" />
      {/* Forehead top cap */}
      <ellipse cx="29.5" cy="10" rx="9" ry="5.5" className="pc-a" />
      {/* Ears */}
      <path className="pc-b"  d="M 22.5,10.5 L 20.5,5.5 Q 21,4.5 22.5,5 L 26,10 Z" />
      <path className="pc-a"  d="M 23,10.5 L 21.5,6.5 L 25.5,10 Z" />
      <path className="pc-b"  d="M 36.5,10.5 L 38.5,5.5 Q 38,4.5 36.5,5 L 33,10 Z" />
      <path className="pc-a"  d="M 36,10.5 L 37.5,6.5 L 33.5,10 Z" />
      {/* Mane */}
      <path className="pc-c"
        d="M 22,25 C 19.5,22 19,18 20,14 L 22.5,16 C 21.5,19.5 22,23 23.5,25.5 Z" />
      {/* Eye */}
      <ellipse cx="36.5" cy="14.5" rx="3.2" ry="2.5" className="pc-c" />
      <ellipse cx="36.5" cy="14.5" rx="1.6" ry="1.4" className="pc-shine" />
      {/* Eye socket highlight */}
      <ellipse cx="35.5" cy="13.5" rx="1.2" ry="0.9" className="pc-hi" opacity="0.7" />
      {/* Muzzle */}
      <path className="pc-c"
        d="M 23,22.5 Q 26.5,25 30,25.5 Q 34,25 37,23 Q 37.5,25 37,26.5 Q 33.5,28 30,28.5 Q 26,28 23.5,26.5 Q 23,25 23,22.5 Z" />
      {/* Nostrils */}
      <ellipse cx="27.5" cy="25.5" rx="2" ry="1.4" className="pc-b" />
      <ellipse cx="33.5" cy="24.5" rx="1.8" ry="1.3" className="pc-b" />
      {/* Forehead highlight */}
      <ellipse cx="28" cy="8.5" rx="5"   ry="3"   className="pc-hi" />
      <ellipse cx="26" cy="7.5" rx="2.5" ry="1.6" className="pc-shine" />
    </g>
  )
}

// ─── QUEEN ────────────────────────────────────────────────────────────────────
function Queen() {
  return (
    <g>
      <Base />
      {/* Body */}
      <path className="pc-b"
        d="M 21,48.5 C 19,44 18.5,37 20,32 Q 23.5,28 30,28 Q 36.5,28 40,32 C 41.5,37 41,44 39,48.5 Z" />
      <path className="pc-c"
        d="M 21,48.5 C 19,44 19.5,42 21.5,40 Q 25.5,42.5 30,43 Q 34.5,42.5 38.5,40 C 40.5,42 41,44 39,48.5 Z" />
      <path className="pc-detail" d="M 21,41 Q 30,44.5 39,41"   strokeWidth="0.9" />
      <path className="pc-detail" d="M 20.5,35 Q 30,38 39.5,35" strokeWidth="0.8" />
      {/* Body top */}
      <ellipse cx="30" cy="32" rx="8.5" ry="2.2" className="pc-a" />
      {/* Crown band */}
      <path className="pc-c"
        d="M 21.5,32 L 15,35.5 L 45,35.5 L 38.5,32 Z" />
      <ellipse cx="30" cy="35.5" rx="15" ry="3.8" className="pc-b" />
      <path className="pc-hi"
        d="M 15,35.5 A 15,3.8 0 0,0 45,35.5 Q 43,33 30,32.5 Q 17,33 15,35.5 Z" />
      {/* Crown bowl */}
      <path className="pc-b"
        d="M 15,35.5 C 15,33.5 17,29 19.5,26 Q 24,23 30,23 Q 36,23 40.5,26 C 43,29 45,33.5 45,35.5 A 15,3.8 0 0,1 15,35.5 Z" />
      <path className="pc-c"
        d="M 15,35.5 C 15,33.5 16.5,31 18.5,29 Q 23.5,31 30,31.5 Q 36.5,31 41.5,29 C 43.5,31 45,33.5 45,35.5 A 15,3.8 0 0,1 15,35.5 Z" />
      {/* Crown rim highlight */}
      <ellipse cx="30" cy="26" rx="9" ry="5.5" className="pc-a" />
      {/* Five orbs — outer pair lower, inner pair mid, center tallest */}
      {/* Left outer */}
      <circle cx="17.5" cy="25"  r="4"   className="pc-b" />
      <ellipse cx="16.5" cy="23" rx="2.2" ry="1.6" className="pc-hi" />
      <ellipse cx="15.8" cy="22.2" rx="1.1" ry="0.8" className="pc-shine" />
      {/* Left inner */}
      <circle cx="23.5" cy="21.5" r="4"   className="pc-b" />
      <ellipse cx="22.5" cy="19.5" rx="2.2" ry="1.6" className="pc-hi" />
      <ellipse cx="21.8" cy="18.8" rx="1.1" ry="0.8" className="pc-shine" />
      {/* Center — tallest */}
      <circle cx="30"   cy="19.5" r="4.8" className="pc-b" />
      <ellipse cx="28.5" cy="17"  rx="2.8" ry="2"   className="pc-hi" />
      <ellipse cx="27.5" cy="15.8" rx="1.5" ry="1.1" className="pc-shine" />
      {/* Right inner */}
      <circle cx="36.5" cy="21.5" r="4"   className="pc-b" />
      <ellipse cx="35.5" cy="19.5" rx="2.2" ry="1.6" className="pc-hi" />
      <ellipse cx="34.8" cy="18.8" rx="1.1" ry="0.8" className="pc-shine" />
      {/* Right outer */}
      <circle cx="42.5" cy="25"  r="4"   className="pc-b" />
      <ellipse cx="41.5" cy="23" rx="2.2" ry="1.6" className="pc-hi" />
      <ellipse cx="40.8" cy="22.2" rx="1.1" ry="0.8" className="pc-shine" />
    </g>
  )
}

// ─── KING ─────────────────────────────────────────────────────────────────────
function King() {
  return (
    <g>
      <Base />
      {/* Body — tallest piece */}
      <path className="pc-b"
        d="M 21,48.5 C 19,44 18,36 19.5,30.5 Q 23,26.5 30,26.5 Q 37,26.5 40.5,30.5 C 42,36 41,44 39,48.5 Z" />
      <path className="pc-c"
        d="M 21,48.5 C 19,44 19.5,41.5 21.5,40 Q 25.5,42.5 30,43 Q 34.5,42.5 38.5,40 C 40.5,41.5 41,44 39,48.5 Z" />
      <path className="pc-detail" d="M 21,40.5 Q 30,44 39,40.5" strokeWidth="0.9" />
      <path className="pc-detail" d="M 20.5,34  Q 30,37 39.5,34" strokeWidth="0.8" />
      {/* Body top */}
      <ellipse cx="30" cy="30.5" rx="8.5" ry="2.2" className="pc-a" />
      {/* Crown band */}
      <path className="pc-c"
        d="M 21.5,30.5 L 15,34 L 45,34 L 38.5,30.5 Z" />
      <ellipse cx="30" cy="34" rx="15" ry="3.8" className="pc-b" />
      <path className="pc-hi"
        d="M 15,34 A 15,3.8 0 0,0 45,34 Q 43,31.5 30,31 Q 17,31.5 15,34 Z" />
      {/* Crown bowl */}
      <path className="pc-b"
        d="M 15,34 C 15,32 16.5,28 19,25.5 Q 23.5,22.5 30,22.5 Q 36.5,22.5 41,25.5 C 43.5,28 45,32 45,34 A 15,3.8 0 0,1 15,34 Z" />
      <path className="pc-c"
        d="M 15,34 C 15,32 16.5,30 18.5,28 Q 23.5,30 30,30.5 Q 36.5,30 41.5,28 C 43.5,30 45,32 45,34 A 15,3.8 0 0,1 15,34 Z" />
      {/* Crown rim */}
      <ellipse cx="30" cy="25.5" rx="9.5" ry="5.5" className="pc-a" />
      {/* Cross — vertical shaft */}
      <path className="pc-b"
        d="M 27,25.5 L 27,11 Q 27,9.5 30,9.5 Q 33,9.5 33,11 L 33,25.5 Z" />
      <path className="pc-c"
        d="M 27,25.5 L 27,11 Q 27,9.5 28,9.5 L 28,25.5 Z" />
      <ellipse cx="30" cy="11.5" rx="3" ry="1.2" className="pc-a" />
      {/* Cross — horizontal bar */}
      <path className="pc-b"
        d="M 21,17 Q 21,15 23.5,15 L 36.5,15 Q 39,15 39,17 L 39,20.5 Q 39,22.5 36.5,22.5 L 23.5,22.5 Q 21,22.5 21,20.5 Z" />
      <path className="pc-c"
        d="M 21,17 Q 21,15 23.5,15 L 36.5,15 Q 39,15 39,17 L 39,18 Q 36.5,16.5 30,16 Q 23.5,16.5 21,18 Z" />
      <ellipse cx="30" cy="15.5" rx="9" ry="1.4" className="pc-a" />
      {/* Cross vertical highlight */}
      <rect x="27.8" y="10" width="1.8" height="15" rx="0.8" className="pc-hi" opacity="0.65" />
      {/* Cross horizontal highlight */}
      <rect x="21.5" y="15.5" width="17" height="1.8" rx="0.8" className="pc-hi" opacity="0.65" />
    </g>
  )
}

// ─── Piece map + component ────────────────────────────────────────────────────
const SHAPES = { P: Pawn, B: Bishop, R: Rook, Q: Queen, K: King, N: Knight }

export default function ChessPiece({ type, color }) {
  const Shape = SHAPES[type] || Pawn
  return (
    <svg
      viewBox="0 0 60 60"
      className={`chess-piece chess-piece-${color}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Shape />
    </svg>
  )
}
