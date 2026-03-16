import { timeframeOptions } from "@/hooks/useTimeframe";

interface TimeframeSelectorProps {
  selected: string;
  onChange: (tf: string) => void;
  disabled?: boolean;
}

export function TimeframeSelector({ selected, onChange, disabled }: TimeframeSelectorProps) {
  return (
    <div className="flex rounded-lg border border-border bg-muted p-0.5 gap-0.5">
      {timeframeOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={`px-4 py-1.5 rounded-md text-xs font-display font-semibold transition-colors disabled:opacity-50 ${
            selected === opt.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
