interface CompassProps {
  angle: number; // camera azimuth in degrees
  sunAzimuth: number | null;
  angleSouth: number;
}

export default function Compass({ angle, sunAzimuth, angleSouth }: CompassProps) {
  const rotation = angle + angleSouth + 180;
  const RAD = Math.PI / 180;

  const cardinals: { label: string; deg: number; color: string; sw: number; fontSize: number }[] = [
    { label: "N", deg: 0, color: "#FF3B30", sw: 2.5, fontSize: 11 },
    { label: "E", deg: 90, color: "rgba(255,255,255,0.65)", sw: 1.2, fontSize: 8 },
    { label: "S", deg: 180, color: "rgba(255,255,255,0.45)", sw: 1.2, fontSize: 8 },
    { label: "W", deg: 270, color: "rgba(255,255,255,0.65)", sw: 1.2, fontSize: 8 },
  ];

  return (
    <div style={{
      position: "absolute", right: 12, top: 32,
      width: 72, height: 72, borderRadius: 36,
      background: "rgba(10,15,25,0.92)", border: "1px solid rgba(255,255,255,0.08)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    }}>
      <svg width="66" height="66" viewBox="-33 -33 66 66" style={{ transform: `rotate(${-rotation}deg)`, transition: "transform 0.1s ease-out" }}>
        {/* Outer ring */}
        <circle r="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* Minor ticks at 45, 135, 225, 315 */}
        {[45, 135, 225, 315].map((d) => (
          <line key={d}
            x1={Math.sin(d * RAD) * 26} y1={-Math.cos(d * RAD) * 26}
            x2={Math.sin(d * RAD) * 30} y2={-Math.cos(d * RAD) * 30}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
        ))}

        {/* Cardinal ticks + labels */}
        {cardinals.map((c) => (
          <g key={c.label}>
            <line
              x1={Math.sin(c.deg * RAD) * 24} y1={-Math.cos(c.deg * RAD) * 24}
              x2={Math.sin(c.deg * RAD) * 30} y2={-Math.cos(c.deg * RAD) * 30}
              stroke={c.color} strokeWidth={c.sw} />
            <text
              x={Math.sin(c.deg * RAD) * 18} y={-Math.cos(c.deg * RAD) * 18}
              textAnchor="middle" dominantBaseline="central"
              fill={c.color} fontSize={c.fontSize} fontWeight="700"
            >{c.label}</text>
          </g>
        ))}

        {/* Needle */}
        <line x1="0" y1="0" x2="0" y2="-13" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="0" x2="0" y2="11" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

        {/* Sun dot */}
        {sunAzimuth !== null && (
          <circle
            cx={Math.sin(sunAzimuth * RAD) * 22}
            cy={-Math.cos(sunAzimuth * RAD) * 22}
            r="4" fill="#FFC107" stroke="#FFA000" strokeWidth="0.8" />
        )}

        {/* Center dot */}
        <circle r="2.5" fill="rgba(255,255,255,0.8)" />
      </svg>
    </div>
  );
}
