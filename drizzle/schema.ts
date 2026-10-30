import {
  boolean,
  decimal,
  type AnyMySqlColumn,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 128 }),
  passwordSalt: varchar("passwordSalt", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  operationalRole: mysqlEnum("operationalRole", [
    "administrativo",
    "almoxarife",
    "encarregado",
  ])
    .default("administrativo")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const businessRecords = mysqlTable(
  "business_records",
  {
    id: int("id").autoincrement().primaryKey(),
    module: varchar("module", { length: 48 }).notNull(),
    code: varchar("code", { length: 80 }),
    systemKey: varchar("systemKey", { length: 80 }),
    title: varchar("title", { length: 240 }).notNull(),
    workId: int("workId"),
    costCenterId: int("costCenterId"),
    supplierContractId: int("supplierContractId").references(
      (): AnyMySqlColumn => businessRecords.id,
      { onDelete: "restrict" }
    ),
    amount: decimal("amount", { precision: 14, scale: 2, mode: "number" }),
    quantity: decimal("quantity", { precision: 14, scale: 3, mode: "number" }),
    recordDate: varchar("recordDate", { length: 10 }),
    status: varchar("status", { length: 40 }).default("planejado").notNull(),
    responsible: varchar("responsible", { length: 180 }),
    details: text("details"),
    sourceModule: varchar("sourceModule", { length: 48 }),
    sourceRecordId: int("sourceRecordId"),
    orderCodeNormalized: varchar("orderCodeNormalized", { length: 80 }),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    moduleIndex: index("business_records_module_idx").on(table.module),
    workIndex: index("business_records_work_idx").on(table.workId),
    costCenterIndex: index("business_records_cost_center_idx").on(
      table.costCenterId
    ),
    codeIndex: index("business_records_code_idx").on(table.code),
    orderCodeUnique: uniqueIndex("business_records_order_code_uq").on(
      table.orderCodeNormalized
    ),
    systemKeyUnique: uniqueIndex("business_records_system_key_uq").on(
      table.systemKey
    ),
    supplierContractIndex: index("business_records_supplier_contract_idx").on(
      table.supplierContractId
    ),
    sourceUnique: uniqueIndex("business_records_source_uq").on(
      table.sourceModule,
      table.sourceRecordId
    ),
  })
);

export const stockOperationLocks = mysqlTable("stock_operation_locks", {
  lockKey: varchar("lockKey", { length: 64 }).primaryKey(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const recordAttachments = mysqlTable(
  "record_attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    recordId: int("recordId")
      .notNull()
      .references(() => businessRecords.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 240 }).notNull(),
    category: mysqlEnum("category", [
      "contrato",
      "assinatura_recebimento",
      "nota_fiscal_cliente",
      "outro",
    ])
      .default("outro")
      .notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    size: int("size").notNull(),
    objectKey: varchar("objectKey", { length: 500 }).notNull(),
    stablePath: varchar("stablePath", { length: 600 }).notNull().default(""),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    recordIndex: index("record_attachments_record_idx").on(table.recordId),
  })
);

export const recordSettlements = mysqlTable(
  "record_settlements",
  {
    id: int("id").autoincrement().primaryKey(),
    recordId: int("recordId")
      .notNull()
      .references(() => businessRecords.id, { onDelete: "cascade" }),
    amount: decimal("amount", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    settlementDate: varchar("settlementDate", { length: 10 }).notNull(),
    paidByCentral: boolean("paidByCentral").default(false).notNull(),
    reference: varchar("reference", { length: 240 }),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    recordIndex: index("record_settlements_record_idx").on(table.recordId),
  })
);

export const budgetItemProgress = mysqlTable(
  "budget_item_progress",
  {
    id: int("id").autoincrement().primaryKey(),
    budgetItemId: int("budgetItemId")
      .notNull()
      .references(() => businessRecords.id, { onDelete: "restrict" }),
    measurementDate: varchar("measurementDate", { length: 10 }).notNull(),
    physicalPercent: decimal("physicalPercent", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    approvedAmount: decimal("approvedAmount", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    itemDateUnique: uniqueIndex("budget_item_progress_period_uq").on(
      table.budgetItemId,
      table.measurementDate
    ),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type BusinessRecord = typeof businessRecords.$inferSelect;
export type InsertBusinessRecord = typeof businessRecords.$inferInsert;
export type RecordAttachment = typeof recordAttachments.$inferSelect;
export type InsertRecordAttachment = typeof recordAttachments.$inferInsert;
export type RecordSettlement = typeof recordSettlements.$inferSelect;
export type InsertRecordSettlement = typeof recordSettlements.$inferInsert;
export type BudgetItemProgress = typeof budgetItemProgress.$inferSelect;
export type InsertBudgetItemProgress = typeof budgetItemProgress.$inferInsert;
