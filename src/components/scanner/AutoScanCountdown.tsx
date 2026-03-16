import { useEffect, useRef, useState } from "react";

interface AutoScanCountdownProps {
  timeUntilNextScan: number | null;
  isAutoScanEnabled: boolean;
  isScanning: boolean;
  /** Total interval in ms for the current scan setting */
  intervalMs: number | null;
}

export function AutoScanCountdown({
  timeUntilNextScan,
  isAutoScanEnabled,
  isScanning,
  intervalMs,
}: AutoScanCountdownProps) {
  const [flash, setFlash] = useState(false);
  const prevRemaining = useRef<number | null>(null);

  // Flash when countdown hits 0
  useEffect(() => {
    if (
      prevRemaining.current !== null &&
      prevRemaining.current > 0 &&
      timeUntilNextScan !== null &&
      timeUntilNextScan <= 0
    ) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
    prevRemaining.current = timeUntilNextScan;
  }, [timeUntilNextScan]);

  if (!isAutoScanEnabled || isScanning) return null;

  const remainingMs = timeUntilNextScan ?? 0;
  const totalMs = intervalMs ?? 1;
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));

  // Format display
  let display: string;
  if (totalSec >= 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    display = `${m}:${String(s).padStart(2, "0")}`;
  } else if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    display = `${m}:${String(s).padStart(2, "0")}`;
  } else {
    display = `${totalSec}`;
  }

  // SVG circle params
  const size = 24;
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);

  // Color based on remaining fraction
  let strokeColor = "hsl(var(--primary))";
  if (fraction < 0.25) strokeColor = "hsl(0 70% 50%)";
  else if (fraction < 0.5) strokeColor = "hsl(38 92% 50%)";

  return (
    <div className="flex items-center gap-1.5" title={`Next auto-scan in ${display}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={flash ? "white" : strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* Center text */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[7px] font-mono tabular-nums"
          style={{ color: flash ? "white" : strokeColor }}
        >
          {totalSec <= 99 ? display : ""}
        </span>
      </div>
      {totalSec > 99 && (
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
          {display}
        </span>
      )}
    </div>
  );
}
