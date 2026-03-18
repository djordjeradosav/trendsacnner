import React from "react";

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatK(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(0) + "k";
}

export function formatPct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(decimals) + "%";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", year: "2-digit",
  });
}

export function filterByRange<T extends { release_date: string }>(data: T[], range: string): T[] {
  if (range === "all") return [...data];
  const cutoff = new Date();
  if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  if (range === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  if (range === "2y") cutoff.setFullYear(cutoff.getFullYear() - 2);
  return data.filter((d) => new Date(d.release_date) >= cutoff);
}

const beatMissCfg: Record<string, { bg: string; color: string; label: string }> = {
  beat:    { bg: "hsl(155 100% 10%)", color: "hsl(150 100% 50%)", label: "BEAT" },
  miss:    { bg: "hsl(0 60% 10%)",    color: "hsl(0 100% 61%)",   label: "MISS" },
  inline:  { bg: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", label: "IN-LINE" },
  pending: { bg: "hsl(var(--secondary))", color: "#3d5a70", label: "PENDING" },
};

export function BeatMissBadge({ beatMiss }: { beatMiss: string | null | undefined }) {
  const s = beatMissCfg[beatMiss ?? "pending"] ?? beatMissCfg.pending;
  return React.createElement("span", {
    className: "inline-block text-[10px] font-medium rounded px-2 py-0.5",
    style: { background: s.bg, color: s.color },
  }, s.label);
}
