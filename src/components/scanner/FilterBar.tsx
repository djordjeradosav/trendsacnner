import { Search } from "lucide-react";
import { PairCategory } from "@/data/mockPairs";

const tabs: Array<{ label: string; value: PairCategory | "All" }> = [
  { label: "All", value: "All" },
  { label: "Forex", value: "Forex" },
  { label: "Futures", value: "Futures" },
  { label: "Commodities", value: "Commodities" },
];

interface FilterBarProps {
  activeTab: PairCategory | "All";
  onTabChange: (tab: PairCategory | "All") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function FilterBar({ activeTab, onTabChange, searchQuery, onSearchChange }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex rounded-lg border border-border bg-muted p-0.5 gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search symbol..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}
