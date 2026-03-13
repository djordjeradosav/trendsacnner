import React, { Component, type ErrorInfo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.logError(error);
  }

  async logError(error: Error) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("error_logs").insert({
        user_id: user?.id ?? null,
        component: this.props.name,
        error_message: error.message?.slice(0, 1000) ?? "Unknown error",
      });
    } catch {
      // Silently fail — don't cascade
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-display text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {this.state.error?.message?.slice(0, 100) ?? "An unexpected error occurred"}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2 mt-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
