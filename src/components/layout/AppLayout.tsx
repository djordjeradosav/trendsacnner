import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";
import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { useChatContext } from "@/hooks/useChatContext";

interface AppLayoutProps {
  children: React.ReactNode;
  lastScan?: string | null;
  isLive?: boolean;
  scanning?: boolean;
  scanDone?: number;
  scanTotal?: number;
  onRunScan?: () => void;
  timeUntilNextScan?: number | null;
  isAutoScanEnabled?: boolean;
  autoScanAgo?: number | null;
  timeframe?: string;
}

export function AppLayout({
  children,
  lastScan,
  isLive,
  scanning,
  scanDone,
  scanTotal,
  onRunScan,
  timeUntilNextScan,
  isAutoScanEnabled,
  autoScanAgo,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen">
      <AppSidebar />
      <div className="ml-[220px] flex flex-col min-h-screen">
        <TopHeader
          lastScan={lastScan}
          isLive={isLive}
          scanning={scanning}
          scanDone={scanDone}
          scanTotal={scanTotal}
          onRunScan={onRunScan}
          timeUntilNextScan={timeUntilNextScan}
          isAutoScanEnabled={isAutoScanEnabled}
          autoScanAgo={autoScanAgo}
        />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
