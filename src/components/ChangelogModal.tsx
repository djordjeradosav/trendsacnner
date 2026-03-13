import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CHANGELOG = [
  {
    version: "1.0.0",
    date: "2026-03-13",
    changes: [
      "Launch: AI-powered market trend scanner",
      "73 pairs across Forex, Futures & Commodities",
      "Real-time heatmap with score engine (EMA, RSI, ADX, MACD)",
      "AI market briefs and pair analysis powered by Gemini",
      "Alert system with in-app notifications & webhooks",
      "Watchlist management",
      "Google OAuth & email/password authentication",
      "Mobile-responsive layout with bottom tab bar",
      "Virtualised heatmap grid for performance",
      "Supabase Realtime score updates",
    ],
  },
];

export function ChangelogModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-[10px] font-display text-muted-foreground hover:text-foreground transition-colors">
          v1.0.0
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Changelog</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {CHANGELOG.map((release) => (
            <div key={release.version}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-display font-bold text-primary">{release.version}</span>
                <span className="text-xs text-muted-foreground">{release.date}</span>
              </div>
              <ul className="space-y-1">
                {release.changes.map((c, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
