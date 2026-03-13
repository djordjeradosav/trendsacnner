import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  lastScan?: string | null;
  isLive?: boolean;
}

export function AppLayout({ children, lastScan, isLive }: AppLayoutProps) {
  return (
    <div className="min-h-screen">
      <AppSidebar />
      <div className="ml-[220px] flex flex-col min-h-screen">
        <TopHeader lastScan={lastScan} isLive={isLive} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
