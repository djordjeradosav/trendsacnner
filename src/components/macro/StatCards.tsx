import React from "react";

interface StatCard {
  label: string;
  value: string;
  subLabel?: string;
  color?: string;
  badge?: React.ReactNode;
}

export function StatCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-lg p-3.5 bg-card border border-border"
        >
          <p className="text-[11px] font-medium text-muted-foreground">
            {card.label}
          </p>
          <p
            className="text-lg font-bold mt-1 font-mono"
            style={{ color: card.color ?? "hsl(var(--foreground))" }}
          >
            {card.value}
          </p>
          {card.subLabel && (
            <p className="text-[10px] mt-0.5" style={{ color: "#3d5a70" }}>
              {card.subLabel}
            </p>
          )}
          {card.badge && <div className="mt-1">{card.badge}</div>}
        </div>
      ))}
    </div>
  );
}
