import { CURRENCY_COLORS, getFlag } from "@/hooks/useEconomicCalendar";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

interface Props {
  impactFilter: string;
  setImpactFilter: (v: string) => void;
  currencyFilters: string[];
  toggleCurrency: (c: string) => void;
}

const IMPACT_OPTIONS = [
  { label: "All", value: "All" },
  { label: "High Impact", value: "High Impact Only", color: "#ef4444", bars: 3 },
  { label: "Medium+", value: "Medium+", color: "#f59e0b", bars: 2 },
];

export function CalendarFilters({ impactFilter, setImpactFilter, currencyFilters, toggleCurrency }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3 shrink-0 px-1">
      {/* Impact filter */}
      <span className="text-[10px] font-semibold uppercase tracking-wider mr-1 text-muted-foreground">
        Impact:
      </span>
      {IMPACT_OPTIONS.map((opt) => {
        const active = impactFilter === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setImpactFilter(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors border ${
              active
                ? "bg-accent border-border text-foreground"
                : "bg-transparent border-transparent text-muted-foreground"
            }`}
          >
            {opt.bars && (
              <span className="flex gap-[1px]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-[4px] h-3 rounded-[1px] ${i >= opt.bars! ? "bg-border" : ""}`}
                    style={i < opt.bars! ? { background: opt.color } : undefined}
                  />
                ))}
              </span>
            )}
            {opt.label}
          </button>
        );
      })}

      <span className="w-px h-5 mx-2 bg-border" />

      {/* Currency filters */}
      <span className="text-[10px] font-semibold uppercase tracking-wider mr-1 text-muted-foreground">
        Currency:
      </span>
      {CURRENCIES.map((cur) => {
        const active = currencyFilters.includes(cur);
        const color = CURRENCY_COLORS[cur] || "hsl(var(--muted-foreground))";
        return (
          <button
            key={cur}
            onClick={() => toggleCurrency(cur)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors"
            style={{
              background: active ? color : "transparent",
              border: `1px solid ${active ? color : "hsl(var(--border))"}`,
              color: active ? "hsl(var(--primary-foreground))" : color,
            }}
          >
            <span className="text-[12px]">{getFlag(cur)}</span>
            {cur}
          </button>
        );
      })}
    </div>
  );
}
