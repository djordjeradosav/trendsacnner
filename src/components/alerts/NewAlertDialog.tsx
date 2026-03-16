import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Gauge, RefreshCw, TrendingUp, Search, Bell, Webhook, Check, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Pair {
  id: string;
  symbol: string;
  name: string;
  category: string;
}

interface NewAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type RuleType = "score_threshold" | "trend_flip" | "strong_trend_scan" | "mtf_alignment";
type Step = 1 | 2 | 3;

const RULE_TYPES: { type: RuleType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: "score_threshold", label: "Score Threshold", desc: "Alert when a pair's score crosses a level", icon: <Gauge className="w-6 h-6" /> },
  { type: "trend_flip", label: "Trend Flip", desc: "Alert when a pair flips bullish or bearish", icon: <RefreshCw className="w-6 h-6" /> },
  { type: "strong_trend_scan", label: "Strong Trend Scan", desc: "Alert when any pair in a category scores high", icon: <TrendingUp className="w-6 h-6" /> },
  { type: "mtf_alignment", label: "MTF Alignment", desc: "Alert when a pair reaches perfect multi-timeframe alignment", icon: <Layers className="w-6 h-6" /> },
];

export function NewAlertDialog({ open, onOpenChange, onCreated }: NewAlertDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [ruleType, setRuleType] = useState<RuleType | null>(null);

  // Step 2 state
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairSearch, setPairSearch] = useState("");
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [direction, setDirection] = useState("above");
  const [threshold, setThreshold] = useState(70);
  const [flipType, setFlipType] = useState("to_bullish");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Step 3 state
  const [channels, setChannels] = useState<string[]>(["in_app"]);
  const [webhookUrl, setWebhookUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      supabase.from("pairs").select("id, symbol, name, category").eq("is_active", true).order("symbol").then(({ data }) => {
        if (data) setPairs(data);
      });
    }
  }, [open]);

  const reset = () => {
    setStep(1);
    setRuleType(null);
    setSelectedPairId(null);
    setDirection("above");
    setThreshold(70);
    setFlipType("to_bullish");
    setCategoryFilter("all");
    setChannels(["in_app"]);
    setWebhookUrl("");
    setPairSearch("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const selectedPair = pairs.find((p) => p.id === selectedPairId);
  const filteredPairs = pairs.filter((p) =>
    p.symbol.toLowerCase().includes(pairSearch.toLowerCase()) ||
    p.name.toLowerCase().includes(pairSearch.toLowerCase())
  );

  const getDescription = () => {
    if (ruleType === "score_threshold") {
      const pairLabel = selectedPair ? selectedPair.symbol : "any pair";
      return `Notify when ${pairLabel} score crosses ${direction} ${threshold}`;
    }
    if (ruleType === "trend_flip") {
      const pairLabel = selectedPair ? selectedPair.symbol : "any pair";
      const flipLabel = flipType === "to_bullish" ? "bullish" : flipType === "to_bearish" ? "bearish" : "bullish or bearish";
      return `Notify when ${pairLabel} flips to ${flipLabel}`;
    }
    if (ruleType === "strong_trend_scan") {
      const catLabel = categoryFilter === "all" ? "any" : categoryFilter;
      return `Notify when any ${catLabel} pair scores above ${threshold}`;
    }
    if (ruleType === "mtf_alignment") {
      const pairLabel = selectedPair ? selectedPair.symbol : "any pair";
      return `Notify when ${pairLabel} reaches perfect MTF alignment (4/4 timeframes)`;
    }
    return "";
  };

  const handleSave = async () => {
    if (!ruleType) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const rule: any = {
        user_id: user.id,
        rule_type: ruleType,
        pair_id: ruleType !== "strong_trend_scan" && ruleType !== "mtf_alignment" ? selectedPairId : (ruleType === "mtf_alignment" ? selectedPairId : null),
        direction: ruleType === "score_threshold" ? direction : ruleType === "trend_flip" ? flipType : ruleType === "mtf_alignment" ? "perfect" : "above",
        threshold: ruleType === "trend_flip" ? 0 : ruleType === "mtf_alignment" ? 4 : threshold,
        category_filter: ruleType === "strong_trend_scan" ? categoryFilter : "all",
        webhook_url: channels.includes("webhook") ? webhookUrl : null,
        description: getDescription(),
        is_active: true,
      };

      const { error } = await supabase.from("alert_rules").insert(rule);
      if (error) throw error;

      toast({ title: "Alert created", description: getDescription() });
      handleClose(false);
      onCreated();
    } catch (err) {
      toast({ title: "Failed to create alert", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep((s) => (s - 1) as Step)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step === 1 ? "New Alert Rule" : step === 2 ? "Configure Rule" : "Notification Channel"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {step === 1 ? "Choose what type of alert you want" : step === 2 ? "Set the conditions" : "How should we notify you?"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Rule type */}
        {step === 1 && (
          <div className="grid gap-3 mt-2">
            {RULE_TYPES.map((rt) => (
              <button
                key={rt.type}
                onClick={() => { setRuleType(rt.type); setStep(2); }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border border-border text-left transition-colors hover:bg-accent/50",
                  ruleType === rt.type && "border-primary bg-primary/5"
                )}
              >
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-primary shrink-0">
                  {rt.icon}
                </div>
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">{rt.label}</p>
                  <p className="text-xs text-muted-foreground">{rt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && ruleType === "score_threshold" && (
          <div className="space-y-5 mt-2">
            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Pair</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pair..."
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                <button
                  onClick={() => setSelectedPairId(null)}
                  className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors", !selectedPairId && "bg-accent text-foreground")}
                >
                  Any pair
                </button>
                {filteredPairs.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPairId(p.id)}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors", selectedPairId === p.id && "bg-accent text-foreground")}
                  >
                    <span className="font-display font-medium">{p.symbol}</span>
                    <span className="text-muted-foreground ml-2">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Direction</label>
              <Tabs value={direction} onValueChange={setDirection}>
                <TabsList className="w-full">
                  <TabsTrigger value="above" className="flex-1 text-xs">Crosses Above</TabsTrigger>
                  <TabsTrigger value="below" className="flex-1 text-xs">Crosses Below</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Threshold: {threshold}</label>
              <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={0} max={100} step={1} />
            </div>

            <PreviewBanner description={getDescription()} />

            <Button className="w-full" onClick={() => setStep(3)}>Next</Button>
          </div>
        )}

        {step === 2 && ruleType === "trend_flip" && (
          <div className="space-y-5 mt-2">
            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Pair</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search pair..." value={pairSearch} onChange={(e) => setPairSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                <button onClick={() => setSelectedPairId(null)} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/50", !selectedPairId && "bg-accent text-foreground")}>Any pair</button>
                {filteredPairs.slice(0, 20).map((p) => (
                  <button key={p.id} onClick={() => setSelectedPairId(p.id)} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/50", selectedPairId === p.id && "bg-accent text-foreground")}>
                    <span className="font-display font-medium">{p.symbol}</span>
                    <span className="text-muted-foreground ml-2">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Flip Type</label>
              <Tabs value={flipType} onValueChange={setFlipType}>
                <TabsList className="w-full">
                  <TabsTrigger value="to_bullish" className="flex-1 text-xs">To Bullish</TabsTrigger>
                  <TabsTrigger value="to_bearish" className="flex-1 text-xs">To Bearish</TabsTrigger>
                  <TabsTrigger value="any" className="flex-1 text-xs">Any Flip</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <PreviewBanner description={getDescription()} />
            <Button className="w-full" onClick={() => setStep(3)}>Next</Button>
          </div>
        )}

        {step === 2 && ruleType === "strong_trend_scan" && (
          <div className="space-y-5 mt-2">
            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                  <SelectItem value="commodity">Commodities</SelectItem>
                  <SelectItem value="futures">Futures</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Score Threshold: {threshold}</label>
              <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={0} max={100} step={1} />
            </div>

            <PreviewBanner description={getDescription()} />
            <Button className="w-full" onClick={() => setStep(3)}>Next</Button>
          </div>
        )}

        {step === 2 && ruleType === "mtf_alignment" && (
          <div className="space-y-5 mt-2">
            <div>
              <label className="text-xs font-display text-muted-foreground mb-2 block">Pair (optional)</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search pair..." value={pairSearch} onChange={(e) => setPairSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                <button onClick={() => setSelectedPairId(null)} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/50", !selectedPairId && "bg-accent text-foreground")}>Any pair</button>
                {filteredPairs.slice(0, 20).map((p) => (
                  <button key={p.id} onClick={() => setSelectedPairId(p.id)} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/50", selectedPairId === p.id && "bg-accent text-foreground")}>
                    <span className="font-display font-medium">{p.symbol}</span>
                    <span className="text-muted-foreground ml-2">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs text-foreground font-display font-medium">⭐ High Priority Alert</p>
              <p className="text-[11px] text-muted-foreground mt-1">Triggers when 5M, 30M, 1H, and 4H all agree on direction — the highest confidence signal.</p>
            </div>

            <PreviewBanner description={getDescription()} />
            <Button className="w-full" onClick={() => setStep(3)}>Next</Button>
          </div>
        )}

        {/* Step 3: Channels */}
        {step === 3 && (
          <div className="space-y-5 mt-2">
            <div className="grid gap-3">
              <button
                onClick={() => setChannels((c) => c.includes("in_app") ? c.filter((x) => x !== "in_app") : [...c, "in_app"])}
                className={cn("flex items-center gap-3 p-3 rounded-lg border text-left transition-colors", channels.includes("in_app") ? "border-primary bg-primary/5" : "border-border")}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-display font-semibold text-foreground">In-App Notification</p>
                  <p className="text-xs text-muted-foreground">See alerts in the notification panel</p>
                </div>
                {channels.includes("in_app") && <Check className="w-5 h-5 text-primary" />}
              </button>

              <button
                onClick={() => setChannels((c) => c.includes("webhook") ? c.filter((x) => x !== "webhook") : [...c, "webhook"])}
                className={cn("flex items-center gap-3 p-3 rounded-lg border text-left transition-colors", channels.includes("webhook") ? "border-primary bg-primary/5" : "border-border")}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Webhook className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-display font-semibold text-foreground">Webhook</p>
                  <p className="text-xs text-muted-foreground">Send a POST request to a URL</p>
                </div>
                {channels.includes("webhook") && <Check className="w-5 h-5 text-primary" />}
              </button>
            </div>

            {channels.includes("webhook") && (
              <Input
                placeholder="https://your-webhook.url/endpoint"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="text-sm"
              />
            )}

            <PreviewBanner description={getDescription()} />

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving || channels.length === 0 || (channels.includes("webhook") && !webhookUrl.trim())}
            >
              {saving ? "Creating..." : "Create Alert Rule"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBanner({ description }: { description: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 border border-border px-4 py-3">
      <p className="text-[11px] font-display text-muted-foreground mb-1">This alert will fire when:</p>
      <p className="text-sm text-foreground font-medium">{description}</p>
    </div>
  );
}
