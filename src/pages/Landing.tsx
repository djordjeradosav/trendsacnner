import { Link, Navigate } from "react-router-dom";
import { Radar, TrendingUp, Zap, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">TrendScanner</span>
          <span className="text-[10px] font-display font-semibold px-1.5 py-0.5 rounded bg-primary/20 text-primary">AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            
            Get started free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-display">
              <Zap className="w-3 h-3" />
              AI-Powered Market Intelligence
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground leading-tight">TrendScanner AI

            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              AI-powered market trend scanner. Analyze 70+ forex, commodity, and futures pairs with real-time technical indicators and intelligent scoring.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
              
              Get started free
            </Link>
            <Link
              to="/login"
              className="px-8 py-3 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-accent transition-colors">
              
              Sign in
            </Link>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
            {[
            { icon: TrendingUp, title: "Smart Scoring", desc: "Composite scores from EMA, RSI, MACD, ADX" },
            { icon: Zap, title: "AI Analysis", desc: "Per-pair AI insights with bias & key levels" },
            { icon: Shield, title: "Custom Alerts", desc: "Score thresholds, trend flips, webhook delivery" }].
            map(({ icon: Icon, title, desc }) =>
            <div key={title} className="rounded-lg border border-border bg-card p-4 text-left space-y-2">
                <Icon className="w-5 h-5 text-primary" />
                <h3 className="font-display font-semibold text-sm text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>);

}