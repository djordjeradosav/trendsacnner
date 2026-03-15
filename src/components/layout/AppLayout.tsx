import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";
import { MobileTabBar } from "./MobileTabBar";
import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { useChatContext } from "@/hooks/useChatContext";
import { MobileScanFAB } from "./MobileScanFAB";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface AppLayoutProps {
  children: React.ReactNode;
  lastScan?: string | null;
  isLive?: boolean;
  scanning?: boolean;
  scanDone?: number;
  scanTotal?: number;
  onRunScan?: () => void;
  onCancelScan?: () => void;
  timeUntilNextScan?: number | null;
  isAutoScanEnabled?: boolean;
  autoScanAgo?: number | null;
  timeframe?: string;
  currentSymbol?: string;
}

export function AppLayout({
  children,
  lastScan,
  isLive,
  scanning,
  scanDone,
  scanTotal,
  onRunScan,
  onCancelScan,
  timeUntilNextScan,
  isAutoScanEnabled,
  autoScanAgo,
  timeframe = "1h",
  currentSymbol,
}: AppLayoutProps) {
  const chatContext = useChatContext(timeframe);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="md:ml-[220px] flex flex-col min-h-screen pb-14 md:pb-0">
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
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar />

      {/* Mobile scan FAB */}
      {onRunScan && (
        <MobileScanFAB
          scanning={!!scanning}
          scanDone={scanDone ?? 0}
          scanTotal={scanTotal ?? 0}
          currentSymbol={currentSymbol}
          onRunScan={onRunScan}
          onCancel={onCancelScan}
        />
      )}

      <ChatAssistant scanContext={chatContext} />
    </div>
  );
}
