import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { count } from "drizzle-orm";
import {
  businessRecords,
  recordAttachments,
  recordSettlements,
  stockOperationLocks,
  type InsertBusinessRecord,
  type InsertRecordAttachment,
  type InsertRecordSettlement,
  type BusinessRecord,
  type InsertUser,
  type User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      const normalized = user[field] ?? null;
      Object.assign(values, { [field]: normalized });
      updateSet[field] = normalized;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.operationalRole !== undefined) {
    values.operationalRole = user.operationalRole;
    updateSet.operationalRole = user.operationalRole;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function listBusinessRecords(module?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (module)
    return db
      .select()
      .from(businessRecords)
      .where(eq(businessRecords.module, module))
      .orderBy(desc(businessRecords.updatedAt));
  return db
    .select()
    .from(businessRecords)
    .orderBy(desc(businessRecords.updatedAt));
}

export async function getBusinessRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(businessRecords)
    .where(eq(businessRecords.id, id))
    .limit(1);
  return result[0];
}

export async function insertBusinessRecord(record: InsertBusinessRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(businessRecords).values({
    ...record,
    orderCodeNormalized:
      record.module === "pedidos" && record.code
        ? normalizeOrderCode(record.code)
        : null,
  });
  return Number(
    (result as unknown as [{ insertId: number }])[0]?.insertId ?? 0
  );
}

export function normalizeOrderCode(code: string) {
  return code.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeStockMaterial(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function normalizeStockUnit(value: unknown) {
  return String(value ?? "un")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

type StockCandidate = {
  module: string;
  workId?: number | null;
  costCenterId?: number | null;
  quantity?: number | null;
  status?: string;
  details?: string | null;
};

type StockKey = {
  hash: string;
  workId: number;
  costCenterId: number;
  material: string;
  unit: string;
};

function stockKey(record: StockCandidate): StockKey | null {
  if (
    record.module !== "almoxarifado-entrada" &&
    record.module !== "almoxarifado-retirada"
  )
    return null;
  if (!record.workId || !record.costCenterId) return null;
  let details: Record<string, unknown> = {};
  try {
    details = record.details ? JSON.parse(record.details) : {};
  } catch {
    details = {};
  }
  const material = normalizeStockMaterial(details.material);
  const unit = normalizeStockUnit(details.unidade);
  if (!material || !unit) return null;
  const identity = `${record.workId}\u001f${record.costCenterId}\u001f${material}\u001f${unit}`;
  return {
    hash: createHash("sha256").update(identity).digest("hex"),
    workId: record.workId,
    costCenterId: record.costCenterId,
    material,
    unit,
  };
}

export class InsufficientStockError extends Error {
  constructor(
    readonly available: number,
    readonly unit: string,
    readonly removesExistingStock: boolean
  ) {
    super(
      removesExistingStock
        ? `A alteração/cancelamento deixaria retiradas sem cobertura. Saldo que restaria: ${Math.max(0, available).toFixed(3)} ${unit}.`
        : `Estoque insuficiente. Saldo disponível: ${Math.max(0, available).toFixed(3)} ${unit}.`
    );
  }
}

async function persistStockMovement(
  record: Partial<InsertBusinessRecord>,
  existingId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.transaction(async tx => {
    let previous: BusinessRecord | undefined;
    if (existingId) {
      const rows = await tx
        .select()
        .from(businessRecords)
        .where(eq(businessRecords.id, existingId))
        .for("update");
      previous = rows[0];
      if (!previous) throw new Error("Stock movement not found");
    }

    const nextRecord = existingId
      ? ({ ...previous, ...record } as InsertBusinessRecord)
      : (record as InsertBusinessRecord);
    const previousKey = previous ? stockKey(previous) : null;
    const nextKey = stockKey(nextRecord);
    const keys = new Map<string, StockKey>();
    if (previousKey) keys.set(previousKey.hash, previousKey);
    if (nextKey) keys.set(nextKey.hash, nextKey);
    const orderedKeys = [...keys.values()].sort((a, b) =>
      a.hash.localeCompare(b.hash)
    );

    for (const key of orderedKeys) {
      await tx
        .insert(stockOperationLocks)
        .values({ lockKey: key.hash })
        .onDuplicateKeyUpdate({ set: { lockKey: key.hash } });
      await tx
        .select({ lockKey: stockOperationLocks.lockKey })
        .from(stockOperationLocks)
        .where(eq(stockOperationLocks.lockKey, key.hash))
        .for("update");
    }

    for (const key of orderedKeys) {
      const scopedRecords = await tx
        .select()
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.workId, key.workId),
            eq(businessRecords.costCenterId, key.costCenterId),
            inArray(businessRecords.module, [
              "almoxarifado-entrada",
              "almoxarifado-retirada",
            ])
          )
        )
        .for("update");
      const available = scopedRecords
        .filter(
          row =>
            row.id !== existingId &&
            row.status !== "cancelado" &&
            stockKey(row)?.hash === key.hash
        )
        .reduce(
          (balance, row) =>
            balance +
            (row.module === "almoxarifado-entrada" ? 1 : -1) *
              Number(row.quantity ?? 0),
          0
        );
      const addsNewMovement =
        nextKey?.hash === key.hash && nextRecord.status !== "cancelado";
      const projected =
        available +
        (addsNewMovement
          ? (nextRecord.module === "almoxarifado-entrada" ? 1 : -1) *
            Number(nextRecord.quantity ?? 0)
          : 0);
      if (projected < -0.0005) {
        const removedExistingEntry =
          previousKey?.hash === key.hash &&
          previous?.module === "almoxarifado-entrada" &&
          previous.status !== "cancelado" &&
          !addsNewMovement;
        throw new InsufficientStockError(
          available,
          key.unit,
          removedExistingEntry
        );
      }
    }

    const values = {
      ...nextRecord,
      orderCodeNormalized:
        nextRecord.module === "pedidos" && nextRecord.code
          ? normalizeOrderCode(nextRecord.code)
          : null,
    };
    if (existingId) {
      await tx
        .update(businessRecords)
        .set(values)
        .where(eq(businessRecords.id, existingId));
      return existingId;
    }
    const result = await tx.insert(businessRecords).values(values);
    return Number(
      (result as unknown as [{ insertId: number }])[0]?.insertId ?? 0
    );
  });
}

export async function insertStockMovement(record: InsertBusinessRecord) {
  return persistStockMovement(record);
}

export async function updateStockMovement(
  id: number,
  record: Partial<InsertBusinessRecord>
) {
  return persistStockMovement(record, id);
}

export async function updateBusinessRecord(
  id: number,
  record: Partial<InsertBusinessRecord>
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = { ...record };
  if (record.module === "pedidos" && record.code !== undefined) {
    Object.assign(values, {
      orderCodeNormalized: record.code ? normalizeOrderCode(record.code) : null,
    });
  }
  await db
    .update(businessRecords)
    .set(values)
    .where(eq(businessRecords.id, id));
}

export async function deleteBusinessRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.transaction(async tx => {
    const records = await tx
      .select({ id: businessRecords.id })
      .from(businessRecords)
      .where(eq(businessRecords.id, id))
      .for("update");
    if (!records[0]) return;
    const settlements = await tx
      .select({ id: recordSettlements.id })
      .from(recordSettlements)
      .where(eq(recordSettlements.recordId, id))
      .for("update");
    if (settlements.length) throw new RecordHasSettlementsError();
    await tx.delete(businessRecords).where(eq(businessRecords.id, id));
  });
}

export class RecordHasSettlementsError extends Error {}

export class SettledAmountExceededError extends Error {}

export async function updateFinancialRecordSafely(
  id: number,
  record: Partial<InsertBusinessRecord>
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.transaction(async tx => {
    const accounts = await tx
      .select()
      .from(businessRecords)
      .where(eq(businessRecords.id, id))
      .for("update");
    if (!accounts[0]) throw new Error("Financial record not found");
    const settlements = await tx
      .select({ amount: recordSettlements.amount })
      .from(recordSettlements)
      .where(eq(recordSettlements.recordId, id))
      .for("update");
    const settledCents = Math.round(
      settlements.reduce((sum, row) => sum + Number(row.amount), 0) * 100
    );
    if (
      record.amount != null &&
      Math.round(Number(record.amount) * 100) < settledCents
    )
      throw new SettledAmountExceededError(
        "O valor da conta não pode ser inferior ao total já baixado."
      );
    if (
      settledCents > 0 &&
      ((record.workId !== undefined && record.workId !== accounts[0].workId) ||
        (record.costCenterId !== undefined &&
          record.costCenterId !== accounts[0].costCenterId) ||
        (record.supplierContractId !== undefined &&
          record.supplierContractId !== accounts[0].supplierContractId))
    )
      throw new SettledAmountExceededError(
        "A conta com baixas não pode ser reclassificada para outra obra, centro de custo ou contrato."
      );
    await tx
      .update(businessRecords)
      .set(record)
      .where(eq(businessRecords.id, id));
  });
}

export async function listBusinessUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      operationalRole: users.operationalRole,
      openId: users.openId,
    })
    .from(users)
    .orderBy(asc(users.name));
  return rows.map(({ openId, ...person }) => ({
    ...person,
    isOwner: openId === ENV.ownerOpenId,
  }));
}

export async function setUserOperationalRole(
  id: number,
  operationalRole: User["operationalRole"]
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ operationalRole }).where(eq(users.id, id));
}

export class UserAccountRoleChangeError extends Error {
  constructor(
    readonly reason:
      | "not_found"
      | "self_change"
      | "last_admin"
      | "owner_required"
  ) {
    const messages = {
      not_found: "Usuário não encontrado.",
      self_change: "Um administrador não pode alterar o próprio papel de aplicação.",
      last_admin: "Não é possível rebaixar o último superusuário admin.",
      owner_required: "A conta proprietária do projeto deve permanecer como superusuário admin.",
    };
    super(messages[reason]);
    this.name = "UserAccountRoleChangeError";
  }
}

export async function setUserAccountRoleSafely(
  id: number,
  role: User["role"],
  actorId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const accountRows = await tx
      .select({ id: users.id, role: users.role, openId: users.openId })
      .from(users)
      .orderBy(asc(users.id))
      .for("update");
    const target = accountRows.find(account => account.id === id);
    if (!target) throw new UserAccountRoleChangeError("not_found");
    if (target.openId === ENV.ownerOpenId && role !== "admin") {
      throw new UserAccountRoleChangeError("owner_required");
    }
    if (target.id === actorId && target.role !== role) {
      throw new UserAccountRoleChangeError("self_change");
    }
    if (
      target.role === "admin" &&
      role === "user" &&
      accountRows.filter(account => account.role === "admin").length <= 1
    ) {
      throw new UserAccountRoleChangeError("last_admin");
    }
    if (target.role !== role) {
      await tx.update(users).set({ role }).where(eq(users.id, id));
    }
    return { previousRole: target.role, role };
  });
}

export async function getAdminDashboardCounts() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [moduleRows, userRows, attachmentRows, settlementRows] =
    await Promise.all([
      db
        .select({ module: businessRecords.module, total: count() })
        .from(businessRecords)
        .groupBy(businessRecords.module),
      db
        .select({ role: users.role, total: count() })
        .from(users)
        .groupBy(users.role),
      db.select({ total: count() }).from(recordAttachments),
      db.select({ total: count() }).from(recordSettlements),
    ]);
  const moduleCounts = Object.fromEntries(
    moduleRows.map(row => [row.module, Number(row.total)])
  );
  const userCount = userRows.reduce((sum, row) => sum + Number(row.total), 0);
  return {
    moduleCounts,
    totalRecords: Object.values(moduleCounts).reduce(
      (sum, total) => sum + total,
      0
    ),
    userCount,
    adminCount: Number(
      userRows.find(row => row.role === "admin")?.total ?? 0
    ),
    attachmentCount: Number(attachmentRows[0]?.total ?? 0),
    settlementCount: Number(settlementRows[0]?.total ?? 0),
  };
}

export async function insertRecordAttachment(
  attachment: InsertRecordAttachment
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(recordAttachments).values(attachment);
  return Number(
    (result as unknown as [{ insertId: number }])[0]?.insertId ?? 0
  );
}

export async function listRecordAttachments(recordId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select({
      id: recordAttachments.id,
      recordId: recordAttachments.recordId,
      fileName: recordAttachments.fileName,
      category: recordAttachments.category,
      contentType: recordAttachments.contentType,
      size: recordAttachments.size,
      createdAt: recordAttachments.createdAt,
    })
    .from(recordAttachments)
    .where(eq(recordAttachments.recordId, recordId))
    .orderBy(desc(recordAttachments.createdAt));
}

export async function getRecordAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(recordAttachments)
    .where(eq(recordAttachments.id, id))
    .limit(1);
  return result[0];
}

export class SettlementExceedsBalanceError extends Error {
  constructor(readonly remaining: number) {
    super(
      `O valor excede o saldo em aberto de R$ ${Math.max(0, remaining).toFixed(2)}.`
    );
  }
}

export async function insertRecordSettlementSafely(
  settlement: InsertRecordSettlement
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const accounts = await tx
      .select()
      .from(businessRecords)
      .where(eq(businessRecords.id, settlement.recordId))
      .for("update");
    const account = accounts[0];
    if (
      !account ||
      (account.module !== "contas-pagar" && account.module !== "contas-receber")
    )
      throw new Error("Financial record not found");
    const settlements = await tx
      .select({ amount: recordSettlements.amount })
      .from(recordSettlements)
      .where(eq(recordSettlements.recordId, settlement.recordId))
      .for("update");
    const settledCents = Math.round(
      settlements.reduce((sum, row) => sum + Number(row.amount), 0) * 100
    );
    const openCents =
      Math.round(Number(account.amount ?? 0) * 100) - settledCents;
    const requestedCents = Math.round(Number(settlement.amount) * 100);
    if (requestedCents > openCents)
      throw new SettlementExceedsBalanceError(openCents / 100);
    const result = await tx.insert(recordSettlements).values(settlement);
    const id = Number(
      (result as unknown as [{ insertId: number }])[0]?.insertId ?? 0
    );
    return { id, remaining: (openCents - requestedCents) / 100 };
  });
}

export async function listRecordSettlements(recordId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(recordSettlements)
    .where(eq(recordSettlements.recordId, recordId))
    .orderBy(
      desc(recordSettlements.settlementDate),
      desc(recordSettlements.id)
    );
}

export async function listAllRecordSettlements() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(recordSettlements)
    .orderBy(
      desc(recordSettlements.settlementDate),
      desc(recordSettlements.id)
    );
}
