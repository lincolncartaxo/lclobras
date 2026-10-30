export type BudgetProgressInput = {
  contractAmount: number;
  physicalPercent: number;
  approvedAmount: number;
};

export type BudgetProgressMetrics = {
  contractAmount: number;
  physicalPercent: number;
  physicalValue: number;
  approvedAmount: number;
  financialPercent: number;
  varianceAmount: number;
  variancePercentagePoints: number;
};

const toCents = (value: number) =>
  Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) : 0;
const fromCents = (value: number) => value / 100;
const roundPercent = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateBudgetProgressMetrics(
  input: BudgetProgressInput
): BudgetProgressMetrics {
  const contractCents = Math.max(0, toCents(input.contractAmount));
  const physicalPercent = Number.isFinite(input.physicalPercent)
    ? roundPercent(input.physicalPercent)
    : 0;
  const approvedCents = Math.max(0, toCents(input.approvedAmount));
  const physicalCents = Math.round((contractCents * physicalPercent) / 100);
  const financialPercent =
    contractCents > 0
      ? roundPercent((approvedCents / contractCents) * 100)
      : 0;

  return {
    contractAmount: fromCents(contractCents),
    physicalPercent,
    physicalValue: fromCents(physicalCents),
    approvedAmount: fromCents(approvedCents),
    financialPercent,
    varianceAmount: fromCents(approvedCents - physicalCents),
    variancePercentagePoints: roundPercent(financialPercent - physicalPercent),
  };
}

export function calculateBudgetProgressTotals(
  items: BudgetProgressInput[]
): Omit<BudgetProgressMetrics, "physicalPercent" | "financialPercent"> & {
  physicalPercent: number;
  financialPercent: number;
} {
  const metrics = items.map(calculateBudgetProgressMetrics);
  const contractCents = metrics.reduce(
    (total, item) => total + toCents(item.contractAmount),
    0
  );
  const physicalCents = metrics.reduce(
    (total, item) => total + toCents(item.physicalValue),
    0
  );
  const approvedCents = metrics.reduce(
    (total, item) => total + toCents(item.approvedAmount),
    0
  );
  const physicalPercent =
    contractCents > 0
      ? roundPercent((physicalCents / contractCents) * 100)
      : 0;
  const financialPercent =
    contractCents > 0
      ? roundPercent((approvedCents / contractCents) * 100)
      : 0;

  return {
    contractAmount: fromCents(contractCents),
    physicalValue: fromCents(physicalCents),
    approvedAmount: fromCents(approvedCents),
    varianceAmount: fromCents(approvedCents - physicalCents),
    variancePercentagePoints: roundPercent(financialPercent - physicalPercent),
    physicalPercent,
    financialPercent,
  };
}

export function selectProgressSnapshotAtOrBefore<
  T extends { measurementDate: string },
>(snapshots: readonly T[], targetDate: string): T | null {
  let selected: T | null = null;
  for (const snapshot of snapshots) {
    if (
      snapshot.measurementDate <= targetDate &&
      (!selected || snapshot.measurementDate > selected.measurementDate)
    ) {
      selected = snapshot;
    }
  }
  return selected;
}
