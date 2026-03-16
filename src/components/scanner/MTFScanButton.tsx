import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMTFScan } from "@/hooks/useMTFScan";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export function MTFScanButton() {
  const { runMTFScan, isMTFScanning, mtfProgress, mtfResult } = useMTFScan();
  const { toast } = useToast();

  useEffect(() => {
    if (mtfResult) {
      toast({
        title: "MTF Scan Complete",
        description: `${mtfResult.alignments} pairs · ${mtfResult.perfect} perfect alignments · ${(mtfResult.duration / 1000).toFixed(1)}s`,
      });
    }
  }, [mtfResult]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => runMTFScan()}
      disabled={isMTFScanning}
      className="gap-2 text-xs font-display"
    >
      {isMTFScanning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          MTF {mtfProgress.done}/{mtfProgress.total}
          {mtfProgress.currentTF && <span className="text-muted-foreground">· {mtfProgress.currentTF}</span>}
        </>
      ) : (
        <>
          <Layers className="w-3.5 h-3.5" />
          MTF Scan
        </>
      )}
    </Button>
  );
}
