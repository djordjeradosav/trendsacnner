import { useState, useMemo } from "react";
import { StatCards } from "@/components/scanner/StatCards";
import { FilterBar } from "@/components/scanner/FilterBar";
import { HeatmapGrid } from "@/components/scanner/HeatmapGrid";
import { Leaderboards } from "@/components/scanner/Leaderboards";
import { EmptyState } from "@/components/scanner/EmptyState";
import { mockPairs, PairCategory } from "@/data/mockPairs";

const Index = () => {
  const [hasScanned, setHasScanned] = useState(true);
  const [activeTab, setActiveTab] = useState<PairCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPairs = useMemo(() => {
    let result = mockPairs;
    if (activeTab !== "All") {
      result = result.filter((p) => p.category === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.symbol.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeTab, searchQuery]);

  if (!hasScanned) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <EmptyState onRunScan={() => setHasScanned(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-foreground">Market Scanner</h1>
        <span className="text-xs text-muted-foreground font-display">
          Last scan: 2 min ago
        </span>
      </div>

      <StatCards pairs={filteredPairs} />

      <FilterBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <HeatmapGrid pairs={filteredPairs} />

      <Leaderboards pairs={mockPairs} />
    </div>
  );
};

export default Index;
