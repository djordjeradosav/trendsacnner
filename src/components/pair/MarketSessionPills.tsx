const SESSION_CURRENCIES: Record<string, string[]> = {
  London: ["EUR", "GBP", "CHF"],
  "New York": ["USD", "CAD"],
  Tokyo: ["JPY"],
  Sydney: ["AUD", "NZD"],
};

function isSessionOpen(session: string): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  switch (session) {
    case "London": return utcH >= 7 && utcH < 16;
    case "New York": return utcH >= 13 && utcH < 22;
    case "Tokyo": return utcH >= 0 && utcH < 9;
    case "Sydney": return utcH >= 21 || utcH < 6;
    default: return false;
  }
}

interface Props {
  symbol: string;
}

export function MarketSessionPills({ symbol }: Props) {
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3, 6);
  const pairCurrencies = [base, quote];

  const relevant = Object.entries(SESSION_CURRENCIES)
    .filter(([, currencies]) => currencies.some((c) => pairCurrencies.includes(c)))
    .map(([session]) => session);

  if (relevant.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {relevant.map((session) => {
        const open = isSessionOpen(session);
        return (
          <span
            key={session}
            className={`text-[10px] font-display px-2 py-0.5 rounded-full border ${
              open
                ? "bg-bullish/10 text-bullish border-bullish/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {session} {open ? "OPEN" : "CLOSED"}
          </span>
        );
      })}
    </div>
  );
}
