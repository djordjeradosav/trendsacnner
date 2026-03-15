import { useEffect, useState, useCallback, useRef } from "react";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Check, Loader2, ChevronDown } from "lucide-react";

interface Props {
  event: EconomicEvent;
}

const TEMPLATES: Record<string, string> = {
  "Pre-event checklist": `□ Check current trend score
□ Review last 3 actuals vs forecast
□ Check DXY direction
□ Note key levels on chart
□ Set alert 15 min before`,
  "Post-event notes": `Actual: 
Reaction: 
Pairs moved: 
Notes: `,
  "Trading plan": `Bias: 
Entry trigger: 
Stop: 
Target: 
R:R: `,
};

export function NotesTab({ event }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [previousNotes, setPreviousNotes] = useState<{ date: string; content: string }[]>([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing note
  useEffect(() => {
    if (!user) return;
    supabase
      .from("event_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("event_name", event.event_name)
      .eq("currency", event.currency || "")
      .eq("scheduled_at", event.scheduled_at)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setContent((data as any).content || "");
      });

    // Load previous notes for same event type
    supabase
      .from("event_notes")
      .select("content, scheduled_at")
      .eq("user_id", user.id)
      .eq("event_name", event.event_name)
      .eq("currency", event.currency || "")
      .neq("scheduled_at", event.scheduled_at)
      .order("scheduled_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setPreviousNotes(
          ((data as any[]) || []).map((d) => ({
            date: new Date(d.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            content: d.content,
          }))
        );
      });
  }, [user, event.event_name, event.currency, event.scheduled_at]);

  const saveNote = useCallback(
    async (text: string) => {
      if (!user) return;
      setSaveState("saving");
      await supabase.from("event_notes").upsert(
        {
          user_id: user.id,
          event_name: event.event_name,
          currency: event.currency || "",
          scheduled_at: event.scheduled_at,
          content: text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_name,currency,scheduled_at" }
      );
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    },
    [user, event]
  );

  const handleChange = (text: string) => {
    setContent(text);
    setSaveState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(text), 1500);
  };

  const insertTemplate = (name: string) => {
    const tpl = TEMPLATES[name];
    if (!tpl) return;
    const newContent = content ? content + "\n\n" + tpl : tpl;
    handleChange(newContent);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Textarea with save indicator */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Write your notes about this event..."
          className="w-full min-h-[200px] px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-[12px] resize-y"
          style={{ fontFamily: "var(--font-display)" }}
        />
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {saveState === "saving" && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          {saveState === "saved" && (
            <span className="text-[9px] flex items-center gap-1" style={{ color: "hsl(var(--bullish))" }}>
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Templates */}
      <div>
        <span className="text-[10px] text-muted-foreground mr-2">Insert template:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {Object.keys(TEMPLATES).map((name) => (
            <button
              key={name}
              onClick={() => insertTemplate(name)}
              className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Previous notes */}
      {previousNotes.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowPrevious(!showPrevious)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
          >
            <span className="text-[11px] text-foreground">Notes from previous releases ({previousNotes.length})</span>
            <ChevronDown
              className="w-3.5 h-3.5 text-muted-foreground transition-transform"
              style={{ transform: showPrevious ? "rotate(180deg)" : "rotate(0)" }}
            />
          </button>
          {showPrevious && (
            <div className="border-t border-border">
              {previousNotes.map((n, i) => (
                <div key={i} className="px-3 py-2 border-b border-border last:border-b-0">
                  <div className="text-[9px] text-muted-foreground mb-1">{n.date}</div>
                  <pre className="text-[11px] text-foreground whitespace-pre-wrap" style={{ fontFamily: "var(--font-display)" }}>
                    {n.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
