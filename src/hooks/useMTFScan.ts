import { useCallback, useState } from "react";
import { useScanStore } from "@/store/scanStore";
import { useScoresStore } from "@/store/scoresStore";
import { calcAllMTFAlignments, persistMTFAlignments } from "@/lib/mtfAlignment";

const MTF_TIMEFRAMES = ["5min", "30min", "1h", "4h"];

export function useMTFScan() {
  const [isMTFScanning, setIsMTFScanning] = useState(false);
  const [mtfProgress, setMtfProgress] = useState({ done: 0, total: MTF_TIMEFRAMES.length, currentTF: "" });
  const [mtfResult, setMtfResult] = useState<{ alignments: number; perfect: number; duration: number } | null>(null);

  const runMTFScan = useCallback(async () => {
    setIsMTFScanning(true);
    setMtfResult(null);
    const startTime = Date.now();

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // Run all 4 TF scans in parallel
    const promises = MTF_TIMEFRAMES.map(async (tf, i) => {
      setMtfProgress((p) => ({ ...p, currentTF: tf }));
      const url = `https://${projectId}.supabase.co/functions/v1/fast-scan?timeframe=${encodeURIComponent(tf)}`;

      try {
        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const dataLine = line.replace(/^data: /, "").trim();
            if (!dataLine) continue;
            try {
              const msg = JSON.parse(dataLine);
              if (msg.type === "complete") {
                setMtfProgress((p) => ({ ...p, done: p.done + 1 }));
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn(`MTF scan failed for ${tf}:`, err);
      }
    });

    await Promise.all(promises);

    // Wait a moment for realtime to sync scores to store, then calculate alignments
    await new Promise((r) => setTimeout(r, 1000));

    const alignments = calcAllMTFAlignments();
    await persistMTFAlignments(alignments);

    const perfect = alignments.filter((a) => a.label === "Perfect").length;
    const duration = Date.now() - startTime;

    setMtfResult({ alignments: alignments.length, perfect, duration });
    setIsMTFScanning(false);
    setMtfProgress({ done: 0, total: MTF_TIMEFRAMES.length, currentTF: "" });

    return { alignments, perfect, duration };
  }, []);

  return { runMTFScan, isMTFScanning, mtfProgress, mtfResult };
}
