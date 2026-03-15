import { Radar, Loader2, X } from "lucide-react";
import { ScanProgress } from "@/components/scanner/ScanProgress";
import { hapticHeavy } from "@/lib/haptics";

interface MobileScanFABProps {
  scanning: boolean;
  scanDone: number;
  scanTotal: number;
  currentSymbol?: string;
  onRunScan?: () => void;
  onCancel?: () => void;
}

export function MobileScanFAB({ scanning, scanDone, scanTotal, currentSymbol, onRunScan, onCancel }: MobileScanFABProps) {
  return (
    <>
      {/* FAB */}
      <button
        onClick={onRunScan}
        disabled={scanning}
        className="fixed bottom-20 left-4 z-50 md:hidden w-12 h-12 rounded-full bg-accent text-foreground border border-border shadow-lg flex items-center justify-center disabled:opacity-60 active:scale-95 transition-transform"
      >
        {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radar className="w-5 h-5" />}
      </button>

      {/* Bottom sheet scan progress */}
      {scanning && (
        <div className="fixed bottom-14 left-0 right-0 z-50 md:hidden bg-card border-t border-border p-4 animate-in slide-in-from-bottom duration-200 safe-area-bottom">
          <ScanProgress done={scanDone} total={scanTotal} currentSymbol={currentSymbol ?? ""} onCancel={onCancel} />
        </div>
      )}
    </>
  );
}
