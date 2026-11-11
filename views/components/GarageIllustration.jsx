export default function GarageIllustration({ className = "" }) {
  return (
    <svg className={`garage-illustration ${className}`} viewBox="0 0 800 380" fill="none" role="img" aria-label="Technical illustration of a graphite sports sedan">
      <defs>
        <linearGradient id="body-paint" x1="420" y1="100" x2="450" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#929a9b" /><stop offset=".25" stopColor="#495253" /><stop offset=".55" stopColor="#293031" /><stop offset=".8" stopColor="#151b1c" /><stop offset="1" stopColor="#383f40" /></linearGradient>
        <linearGradient id="glass-paint" x1="390" y1="110" x2="470" y2="210" gradientUnits="userSpaceOnUse"><stop stopColor="#465352" /><stop offset="1" stopColor="#101819" /></linearGradient>
        <radialGradient id="floor-glow"><stop stopColor="#c5e96b" stopOpacity=".14" /><stop offset="1" stopColor="#c5e96b" stopOpacity="0" /></radialGradient>
        <radialGradient id="wheel-paint"><stop stopColor="#697373" /><stop offset=".6" stopColor="#2c3434" /><stop offset="1" stopColor="#080d0e" /></radialGradient>
      </defs>
      <ellipse cx="425" cy="309" rx="350" ry="63" fill="url(#floor-glow)" />
      <ellipse cx="430" cy="298" rx="300" ry="20" fill="#050909" opacity=".8" />
      <g className="car-body">
        <path d="M97 242 112 216Q129 198 202 185L289 132Q314 114 366 111L490 114Q528 118 583 161L665 179Q703 188 716 220L721 251 696 269 143 280 103 265Z" fill="url(#body-paint)" stroke="#7a8583" strokeWidth="1.5" />
        <path d="m222 184 80-48q17-14 62-15l120 4q30 2 78 39l-188 14Z" fill="url(#glass-paint)" stroke="#9ba5a0" strokeOpacity=".5" />
        <path d="m365 122-24 59m128-56 32 46" stroke="#929c96" strokeWidth="5" />
        <path d="m286 134-76 58-89 26q98-6 209-14l235-26 99 7" stroke="#c5cfca" strokeOpacity=".5" />
        <path d="m333 206-3 52m172-77 11 76m-173-54 155-16m-122 20 17-2m104-13 17-2" stroke="#090e0f" strokeWidth="2" />
        <path d="M101 245q109 28 222 14l378-19M136 269l563-13" stroke="#9ba5a0" strokeOpacity=".25" />
        <path d="m114 221 89-15-18 15-69 13Z" fill="#d9e8dc" /><path d="m116 224 67-12" stroke="#efffe5" strokeWidth="3" />
        <path d="m673 190 27 15 6 12-26-8Z" fill="#c4e66d" />
        <path d="m112 248 84 5-14 11-65-8Z" fill="#090f10" />
        <path d="m315 174 21-10 15 4-2 11-29 3Z" fill="#626d6b" stroke="#9aa49c" />
        <path d="M206 276q-5-68 47-72 49-2 53 65m278-15q-6-62 36-63 44-2 51 55" fill="#0a1011" />
        {[{ x: 255, y: 267, radius: 44 }, { x: 625, y: 246, radius: 37 }].map(({ x, y, radius }) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={radius * .8} ry={radius} fill="#080d0f" stroke="#323a3b" strokeWidth="3" />
            <ellipse cx={x} cy={y} rx={radius * .58} ry={radius * .75} fill="url(#wheel-paint)" stroke="#85918b" strokeWidth="1.5" />
            {[0, 60, 120].map((angle) => <path key={angle} d={`M${x} ${y - radius * .65}V${y + radius * .65}`} transform={`rotate(${angle} ${x} ${y})`} stroke="#84918a" strokeWidth="4" />)}
            <circle cx={x} cy={y} r="7" fill="#abb4a9" />
          </g>
        ))}
      </g>
      <g stroke="#badd73" strokeOpacity=".35" strokeWidth="1"><path d="M100 318H718m-618-6v12m618-12v12M747 170v116m-6-116h12m-12 116h12" /><path d="M98 194v-47h85m474 2h66v37" strokeDasharray="3 5" /></g>
      <g fill="#87918b" fontFamily="monospace" fontSize="10" letterSpacing="2"><text x="338" y="339">BUILT TO BE UNDERSTOOD</text><text x="99" y="137">FIG. 01 / THE VEHICLE</text></g>
    </svg>
  );
}
