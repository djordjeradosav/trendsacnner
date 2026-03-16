interface ScoreSparklineProps {
  scores: number[];
  width?: number;
  height?: number;
  trend: string;
}

export function ScoreSparkline({ scores, width = 56, height = 18, trend }: ScoreSparklineProps) {
  if (!scores || scores.length < 2) return null;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const pad = 2;
  const innerH = height - pad * 2;
  const innerW = width - pad * 2;

  const points = scores
    .map((score, i) => {
      const x = pad + (i / (scores.length - 1)) * innerW;
      const y = pad + innerH - ((score - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color =
    trend === "bullish" ? "hsl(142 70% 45%)" : trend === "bearish" ? "hsl(0 70% 50%)" : "hsl(220 10% 45%)";

  const lastX = pad + innerW;
  const lastY = pad + innerH - ((scores[scores.length - 1] - min) / range) * innerH;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="transition-opacity group-hover:opacity-100 opacity-80"
    >
      <polygon
        points={`${pad},${height - pad} ${points} ${lastX.toFixed(1)},${height - pad}`}
        fill={color}
        opacity="0.15"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="1.5" fill={color} />
    </svg>
  );
}
