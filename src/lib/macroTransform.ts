/**
 * Transforms FRED index values (CPI, Core CPI, PCE, Core PCE) into MoM % changes.
 * FRED stores these as price index levels (e.g. 315.5), not percentages.
 * Traders care about the month-over-month change, not the raw index.
 */

const INDEX_INDICATORS = new Set(["CPI", "CORE_CPI", "PCE", "CORE_PCE"]);

export function needsMomTransform(indicator: string): boolean {
  return INDEX_INDICATORS.has(indicator);
}

export function transformToMom<T extends { actual: number | null; previous: number | null; release_date: string }>(
  indicator: string,
  data: T[]
): T[] {
  if (!INDEX_INDICATORS.has(indicator)) return data;

  // Check if already transformed (values should be small percentages, not 100+)
  const hasIndexValues = data.some((d) => d.actual != null && Math.abs(d.actual) > 10);
  if (!hasIndexValues) return data; // already MoM percentages

  // Sort ASC by date for sequential computation
  const asc = [...data].sort(
    (a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
  );

  const transformed = asc.map((row, i) => {
    const prev = asc[i - 1];
    const momChange =
      prev && row.actual != null && prev.actual != null
        ? ((row.actual - prev.actual) / prev.actual) * 100
        : null;

    const prevPrev = asc[i - 2];
    const prevMom =
      prev && prevPrev && prev.actual != null && prevPrev.actual != null
        ? ((prev.actual - prevPrev.actual) / prevPrev.actual) * 100
        : null;

    return {
      ...row,
      actual: momChange != null ? parseFloat(momChange.toFixed(4)) : null,
      previous: prevMom != null ? parseFloat(prevMom.toFixed(4)) : null,
      unit: "%MoM",
    };
  });

  // Filter out rows where we couldn't compute MoM, then reverse back to DESC
  return transformed.filter((r) => r.actual != null).reverse();
}
