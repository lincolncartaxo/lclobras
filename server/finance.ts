export type WorkFinanceRecord = {
  id: number;
  module: string;
  workId: number | null;
  amount: number | null;
};

export type WorkFinanceSettlement = {
  recordId: number;
  amount: number;
  paidByCentral: boolean;
};

export type WorkFinanceMetrics = {
  received: number;
  settledCosts: number;
  centralPaidCosts: number;
  cashBalance: number;
  totalCosts: number;
  profit: number;
};

const toCents = (value: number | null | undefined) =>
  Math.round(Number(value ?? 0) * 100);
const fromCents = (value: number) => value / 100;

/**
 * Computes a work's realized cash and contractual result. Central-paid
 * settlements remain ordinary work expenses and are counted exactly once.
 */
export function calculateWorkFinanceMetrics(
  contractAmount: number | null | undefined,
  workId: number,
  records: WorkFinanceRecord[],
  settlements: WorkFinanceSettlement[]
): WorkFinanceMetrics {
  const payables = records.filter(
    record => record.module === "contas-pagar" && record.workId === workId
  );
  const receivables = records.filter(
    record => record.module === "contas-receber" && record.workId === workId
  );
  const payableIds = new Set(payables.map(record => record.id));
  const receivableIds = new Set(receivables.map(record => record.id));

  let receivedCents = 0;
  let settledCostsCents = 0;
  let centralPaidCostsCents = 0;
  for (const settlement of settlements) {
    const amountCents = toCents(settlement.amount);
    if (receivableIds.has(settlement.recordId)) receivedCents += amountCents;
    if (payableIds.has(settlement.recordId)) {
      settledCostsCents += amountCents;
      if (settlement.paidByCentral) centralPaidCostsCents += amountCents;
    }
  }

  const totalCostsCents = payables.reduce(
    (total, payable) => total + toCents(payable.amount),
    0
  );
  const contractCents = toCents(contractAmount);

  return {
    received: fromCents(receivedCents),
    settledCosts: fromCents(settledCostsCents),
    centralPaidCosts: fromCents(centralPaidCostsCents),
    cashBalance: fromCents(receivedCents - settledCostsCents),
    totalCosts: fromCents(totalCostsCents),
    profit: fromCents(contractCents - totalCostsCents),
  };
}
