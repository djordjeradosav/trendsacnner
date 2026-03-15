import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Radar, Bell, Star, Calendar } from "lucide-react";
import { hapticTap } from "@/lib/haptics";

const tabs = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Scanner", icon: Radar, path: "/scanner" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
  { label: "Alerts", icon: Bell, path: "/alerts" },
  { label: "Watchlist", icon: Star, path: "/watchlist" },
];

export function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border flex items-center justify-around h-14 safe-area-bottom">
      {tabs.map((tab) => {
        const isActive =
          location.pathname === tab.path ||
          (tab.path !== "/" && location.pathname.startsWith(tab.path));
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-display font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
