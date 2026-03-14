import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireAuth } from "@/hooks/useAuth";
import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ResetPasswordPage from "./pages/ResetPassword";
import Index from "./pages/Index";
import SettingsPage from "./pages/Settings";
import ScannerPage from "./pages/Scanner";
import PairDetail from "./pages/PairDetail";
import WatchlistPage from "./pages/Watchlist";
import AlertsPage from "./pages/Alerts";
import NewsPage from "./pages/News";
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
          <Route path="/pair/:symbol" element={<RequireAuth><PairDetail /></RequireAuth>} />
          <Route path="/watchlist" element={<RequireAuth><WatchlistPage /></RequireAuth>} />
          <Route path="/alerts" element={<RequireAuth><AlertsPage /></RequireAuth>} />
          <Route path="/news" element={<RequireAuth><NewsPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
