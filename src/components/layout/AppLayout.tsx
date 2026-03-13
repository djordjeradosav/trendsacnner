import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  lastScan?: string | null;
  isLive?: boolean;
  scanning?: boolean;
  scanDone?: number;
  scanTotal?: number;
  onRunScan?: () => void;
}

export function AppLayout({
  children,
  lastScan,
  isLive,
  scanning,
  scanDone,
  scanTotal,
  onRunScan,
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
        />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
