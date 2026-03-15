import { CURRENCY_COLORS } from "@/hooks/useEconomicCalendar";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

interface Props {
  impactFilter: string;
  setImpactFilter: (v: string) => void;
  currencyFilters: string[];
  toggleCurrency: (c: string) => void;
}

export function CalendarFilters({ impactFilter, setImpactFilter, currencyFilters, toggleCurrency }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
      {/* Impact filter */}
      {["All", "High Impact Only"].map((f) => (
        <button
          key={f}
          onClick={() => setImpactFilter(f)}
          className="px-3 py-1 rounded text-xs font-mono transition-colors border"
          style={{
            background: impactFilter === f ? "hsl(var(--secondary))" : "transparent",
            borderColor: impactFilter === f ? "hsl(var(--border))" : "transparent",
            color: impactFilter === f ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          }}
        >
          {f}
        </button>
      ))}

      <span className="w-px h-5 bg-border mx-1" />

      {/* Currency filters */}
      {CURRENCIES.map((cur) => {
        const active = currencyFilters.includes(cur);
        const color = CURRENCY_COLORS[cur] || "hsl(var(--muted-foreground))";
        return (
          <button
            key={cur}
            onClick={() => toggleCurrency(cur)}
            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors border"
            style={{
              background: active ? color : "transparent",
              borderColor: active ? color : "hsl(var(--border))",
              color: active ? "#fff" : color,
            }}
          >
            {cur}
          </button>
        );
      })}
    </div>
  );
}
