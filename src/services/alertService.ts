import { supabase } from "@/integrations/supabase/client";

interface ScoreData {
  pair_id: string;
  symbol: string;
  category: string;
  score: number;
  trend: string;
}

/**
 * Checks all active alert rules against latest scores and creates notifications.
 * Called after every scan completes.
 */
export async function checkAlertRules(scores: ScoreData[]): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: rules } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!rules || rules.length === 0) return 0;

  // Build lookup maps
  const scoreMap = new Map<string, ScoreData>();
  scores.forEach((s) => scoreMap.set(s.pair_id, s));

  let notificationsCreated = 0;

  for (const rule of rules) {
    const matches: ScoreData[] = [];

    if (rule.rule_type === "score_threshold") {
      const candidates = rule.pair_id ? [scoreMap.get(rule.pair_id)].filter(Boolean) as ScoreData[] : Array.from(scoreMap.values());
      for (const s of candidates) {
        if (rule.direction === "above" && s.score >= rule.threshold) {
          matches.push(s);
        } else if (rule.direction === "below" && s.score <= rule.threshold) {
          matches.push(s);
        }
      }
    } else if (rule.rule_type === "trend_flip") {
      const candidates = rule.pair_id ? [scoreMap.get(rule.pair_id)].filter(Boolean) as ScoreData[] : Array.from(scoreMap.values());
      for (const s of candidates) {
        if (rule.direction === "to_bullish" && s.trend === "bullish") matches.push(s);
        else if (rule.direction === "to_bearish" && s.trend === "bearish") matches.push(s);
        else if (rule.direction === "any" && (s.trend === "bullish" || s.trend === "bearish")) matches.push(s);
      }
    } else if (rule.rule_type === "strong_trend_scan") {
      const candidates = Array.from(scoreMap.values()).filter((s) =>
        rule.category_filter === "all" || s.category.toLowerCase() === rule.category_filter?.toLowerCase()
      );
      for (const s of candidates) {
        if (s.score >= rule.threshold) matches.push(s);
      }
    }

    // Create notifications for matches (limit to first 5 per rule per scan)
    for (const match of matches.slice(0, 5)) {
      const message = buildMessage(rule, match);
      let inserted = false;
      let notifId: string | null = null;

      // Attempt insert with one retry
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data, error } = await supabase.from("alert_notifications").insert({
            rule_id: rule.id,
            pair_id: match.pair_id,
            message,
            score_at_trigger: match.score,
            trend_at_trigger: match.trend,
          }).select("id").single();

          if (error) throw error;
          notifId = data.id;
          inserted = true;
          break;
        } catch (err) {
          if (attempt === 0) {
            console.warn("Notification insert failed, retrying once:", err);
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      // If both attempts failed, insert with delivery_failed flag
      if (!inserted) {
        try {
          await supabase.from("alert_notifications").insert({
            rule_id: rule.id,
            pair_id: match.pair_id,
            message,
            score_at_trigger: match.score,
            trend_at_trigger: match.trend,
            delivery_failed: true,
          });
        } catch (err) {
          console.warn("Failed to insert notification even with failure flag:", err);
          continue;
        }
      }

      // Update last_triggered_at
      await supabase.from("alert_rules").update({ last_triggered_at: new Date().toISOString() }).eq("id", rule.id);
      notificationsCreated++;

      // Fire webhook if configured (with retry)
      if (rule.webhook_url) {
        let webhookOk = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(rule.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rule_type: rule.rule_type, symbol: match.symbol, score: match.score, trend: match.trend, message }),
            });
            if (res.ok) { webhookOk = true; break; }
          } catch {
            if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
          }
        }
        // Mark delivery_failed if webhook failed
        if (!webhookOk && notifId) {
          await supabase.from("alert_notifications").update({ delivery_failed: true }).eq("id", notifId);
        }
      }
    }
  }

  return notificationsCreated;
}

function buildMessage(rule: any, match: ScoreData): string {
  if (rule.rule_type === "score_threshold") {
    return `${match.symbol} score ${rule.direction === "above" ? "crossed above" : "crossed below"} ${rule.threshold} (current: ${Math.round(match.score)})`;
  }
  if (rule.rule_type === "trend_flip") {
    return `${match.symbol} flipped to ${match.trend}`;
  }
  if (rule.rule_type === "strong_trend_scan") {
    return `${match.symbol} (${match.category}) scored ${Math.round(match.score)} — above ${rule.threshold} threshold`;
  }
  return `Alert triggered for ${match.symbol}`;
}
