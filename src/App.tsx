import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { RequireAuth } from "@/hooks/useAuth";
import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ResetPasswordPage from "./pages/ResetPassword";
import Index from "./pages/Index";
import SettingsPage from "./pages/Settings";
import ScannerPage from "./pages/Scanner";
import ScanHistoryPage from "./pages/ScanHistory";
import HistoryPage from "./pages/History";
import PairDetail from "./pages/PairDetail";
import WatchlistPage from "./pages/Watchlist";
import AlertsPage from "./pages/Alerts";
import NewsPage from "./pages/News";
import CalendarPage from "./pages/CalendarPage";
import MacroNFP from "./pages/MacroNFP";
import MacroPage from "./pages/MacroPage";
import SeasonalityPage from "./pages/Seasonality";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<RequireAuth><Index /></RequireAuth>} />
            <Route path="/scanner" element={<RequireAuth><ScannerPage /></RequireAuth>} />
            <Route path="/scan-history" element={<RequireAuth><ScanHistoryPage /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
            <Route path="/pair/:symbol" element={<RequireAuth><PairDetail /></RequireAuth>} />
            <Route path="/watchlist" element={<RequireAuth><WatchlistPage /></RequireAuth>} />
            <Route path="/alerts" element={<RequireAuth><AlertsPage /></RequireAuth>} />
            <Route path="/news" element={<RequireAuth><NewsPage /></RequireAuth>} />
            <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/macro" element={<RequireAuth><MacroPage /></RequireAuth>} />
            <Route path="/macro/nfp" element={<RequireAuth><MacroNFP /></RequireAuth>} />
            <Route path="/seasonality" element={<RequireAuth><SeasonalityPage /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
