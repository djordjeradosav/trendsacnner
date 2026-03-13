import { Radar, Loader2, X } from "lucide-react";
import { ScanProgress } from "@/components/scanner/ScanProgress";

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
        className="fixed bottom-20 right-4 z-50 md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-60 active:scale-95 transition-transform"
      >
        {scanning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Radar className="w-6 h-6" />}
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
