import { TIMEFRAME_GROUPS, TIMEFRAME_CONFIG, formatRefreshInterval } from "@/config/timeframes";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface TimeframeSelectorProps {
  selected: string;
  onChange: (tf: string) => void;
  disabled?: boolean;
}

export function TimeframeSelector({ selected, onChange, disabled }: TimeframeSelectorProps) {
  return (
    <div className="flex items-end gap-0 rounded-lg border border-border bg-muted/50 p-1">
      {TIMEFRAME_GROUPS.map((group, gi) => (
        <div key={group.key} className="flex items-end">
          {gi > 0 && (
            <div className="w-px h-6 bg-border/60 mx-0.5 self-center" />
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-display font-semibold uppercase tracking-widest text-muted-foreground/70 leading-none">
              {group.label}
            </span>
            <div className="flex gap-0.5">
              {group.timeframes.map((tf) => {
                const config = TIMEFRAME_CONFIG[tf];
                const isActive = selected === tf;
                return (
                  <Tooltip key={tf}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onChange(tf)}
                        disabled={disabled}
                        className="w-[44px] h-[32px] rounded-md text-xs font-display font-semibold transition-all duration-150 disabled:opacity-50 border"
                        style={{
                          backgroundColor: isActive ? `${config.color}20` : "transparent",
                          borderColor: isActive ? config.color : "transparent",
                          color: isActive ? config.color : "hsl(var(--muted-foreground))",
                          fontWeight: isActive ? 600 : 400,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = `${config.color}12`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        {config.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs font-body max-w-[200px]">
                      <p className="font-semibold">{config.description}</p>
                      <p className="text-muted-foreground">
                        Auto-refresh: every {formatRefreshInterval(config.refreshInterval)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
