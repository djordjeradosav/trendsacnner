const options = [
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "ALL", value: "all" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function DateRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors border"
          style={{
            background: value === opt.value ? "hsl(155 100% 10%)" : "transparent",
            color: value === opt.value ? "hsl(var(--bullish))" : "hsl(var(--muted-foreground))",
            borderColor: value === opt.value ? "hsl(var(--bullish))" : "hsl(var(--border))",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
