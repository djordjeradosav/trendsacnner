import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Radar, LineChart, Bell, Star, Settings, LogOut, Menu, X, Calendar, Newspaper,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Scanner", icon: Radar, path: "/scanner" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
  { label: "News", icon: Newspaper, path: "/news" },
  { label: "Pair Detail", icon: LineChart, path: "/pair" },
  { label: "Alerts", icon: Bell, path: "/alerts" },
  { label: "Watchlist", icon: Star, path: "/watchlist" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="md:hidden p-2 text-muted-foreground">
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Slide-in panel */}
          <div className="fixed inset-y-0 right-0 z-[100] w-[280px] max-w-[85vw] bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-200 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-primary" />
                <span className="font-display font-bold text-foreground">TrendScan AI</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {email && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted-foreground font-body">Signed in as</p>
                <p className="text-sm text-foreground font-display truncate">{email}</p>
              </div>
            )}

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/" && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-border">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
