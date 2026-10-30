import { createHash, type Hash } from "node:crypto";
import mysql from "mysql2/promise";
import type { ConnectionOptions, RowDataPacket } from "mysql2";
import {
  assertDistinctMysqlEndpoints,
  MysqlEndpointError,
} from "./mysql-endpoint";

type DbConnection = Awaited<ReturnType<typeof mysql.createConnection>>;
type QueryRow = RowDataPacket & Record<string, unknown>;

class SafeMigrationError extends Error {}

const BATCH_SIZE = 200;
const MIGRATION_TABLE_PATTERN = /^_*drizzle_migrations$/i;
const REQUIRED_CONFIRMATIONS = [
  "--confirm-empty-target",
  "--confirm-source-write-freeze",
  "--confirm-exclusive-target",
] as const;

function safeIdentifier(identifier: string): string {
  return `\`${identifier.replaceAll("`", "``")}\``;
}

function connectionOptions(connectionString: string): ConnectionOptions {
  return {
    uri: connectionString,
    dateStrings: true,
    jsonStrings: true,
    timezone: "Z",
    connectTimeout: 15_000,
  };
}

function isMigrationTable(tableName: string): boolean {
  return MIGRATION_TABLE_PATTERN.test(tableName);
}

async function queryRows(
  connection: DbConnection,
  sql: string,
  values?: unknown[]
): Promise<QueryRow[]> {
  const [result] = await connection.query(sql, values as any[] | undefined);
  if (!Array.isArray(result)) {
    throw new SafeMigrationError("A database metadata query returned an unexpected result.");
  }
  return result as QueryRow[];
}

async function listAllTables(connection: DbConnection): Promise<string[]> {
  const rows = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`
  );
  return rows.map(row => String(row.tableName));
}

function applicationTables(allTables: string[]): string[] {
  return allTables.filter(tableName => !isMigrationTable(tableName));
}

async function tableRowCount(
  connection: DbConnection,
  tableName: string
): Promise<number> {
  const rows = await queryRows(
    connection,
    `SELECT COUNT(*) AS rowCount FROM ${safeIdentifier(tableName)}`
  );
  return Number(rows[0]?.rowCount ?? 0);
}

async function tableColumns(
  connection: DbConnection,
  tableName: string
): Promise<string[]> {
  const rows = await queryRows(
    connection,
    `SHOW COLUMNS FROM ${safeIdentifier(tableName)}`
  );
  return rows.map(row => String(row.Field));
}

async function primaryKeyColumns(
  connection: DbConnection,
  tableName: string
): Promise<string[]> {
  const rows = await queryRows(
    connection,
    `SELECT COLUMN_NAME AS columnName,
            ORDINAL_POSITION AS ordinalPosition
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION`,
    [tableName]
  );
  return rows.map(row => String(row.columnName));
}

function normalizedMetadata(
  rows: QueryRow[],
  applicationTableSet: Set<string>
): Array<Record<string, string | null>> {
  return rows
    .filter(row => applicationTableSet.has(String(row.tableName)))
    .map(row => {
      const normalized: Record<string, string | null> = {};
      for (const key of Object.keys(row).sort()) {
        const value = row[key];
        normalized[key] = value === null || value === undefined ? null : String(value);
      }
      return normalized;
    });
}

async function schemaFingerprint(
  connection: DbConnection,
  applicationTableSet: Set<string>
): Promise<string> {
  const tables = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName,
            ENGINE AS engine,
            TABLE_COLLATION AS tableCollation
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`
  );
  const columns = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName,
            ORDINAL_POSITION AS ordinalPosition,
            COLUMN_NAME AS columnName,
            COLUMN_TYPE AS columnType,
            DATA_TYPE AS dataType,
            IS_NULLABLE AS isNullable,
            COLUMN_DEFAULT AS columnDefault,
            EXTRA AS extra,
            CHARACTER_SET_NAME AS characterSetName,
            COLLATION_NAME AS collationName,
            COLUMN_COMMENT AS columnComment
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const generatedColumn = columns.find(
    row =>
      applicationTableSet.has(String(row.tableName)) &&
      /generated/i.test(String(row.extra ?? ""))
  );
  if (generatedColumn) {
    throw new SafeMigrationError(
      `Generated column found in ${String(generatedColumn.tableName)}; this copy tool does not write generated columns.`
    );
  }
  const indexes = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName,
            INDEX_NAME AS indexName,
            NON_UNIQUE AS nonUnique,
            SEQ_IN_INDEX AS sequenceInIndex,
            COLUMN_NAME AS columnName,
            COLLATION AS collation,
            SUB_PART AS subPart,
            INDEX_TYPE AS indexType,
            COMMENT AS comment,
            INDEX_COMMENT AS indexComment
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
  );
  const constraints = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName,
            CONSTRAINT_NAME AS constraintName,
            CONSTRAINT_TYPE AS constraintType
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, CONSTRAINT_NAME`
  );
  const foreignKeys = await queryRows(
    connection,
    `SELECT k.TABLE_NAME AS tableName,
            k.CONSTRAINT_NAME AS constraintName,
            k.COLUMN_NAME AS columnName,
            k.ORDINAL_POSITION AS ordinalPosition,
            k.REFERENCED_TABLE_SCHEMA AS referencedSchema,
            k.REFERENCED_TABLE_NAME AS referencedTable,
            k.REFERENCED_COLUMN_NAME AS referencedColumn,
            r.UPDATE_RULE AS updateRule,
            r.DELETE_RULE AS deleteRule,
            r.MATCH_OPTION AS matchOption
       FROM information_schema.KEY_COLUMN_USAGE k
       LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND r.TABLE_NAME = k.TABLE_NAME
        AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE()
        AND k.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`
  );

  const definition = JSON.stringify({
    tables: normalizedMetadata(tables, applicationTableSet),
    columns: normalizedMetadata(columns, applicationTableSet),
    indexes: normalizedMetadata(indexes, applicationTableSet),
    constraints: normalizedMetadata(constraints, applicationTableSet),
    foreignKeys: normalizedMetadata(foreignKeys, applicationTableSet),
  });
  return createHash("sha256").update(definition).digest("hex");
}

async function assertInnoDbTables(
  connection: DbConnection,
  tableNames: string[],
  label: string
): Promise<void> {
  const rows = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName, ENGINE AS engine
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'`
  );
  const engines = new Map(
    rows.map(row => [String(row.tableName), String(row.engine ?? "")])
  );
  for (const tableName of tableNames) {
    if (engines.get(tableName)?.toLowerCase() !== "innodb") {
      throw new SafeMigrationError(
        `${label} table ${tableName} is not InnoDB; a consistent transactional copy cannot be guaranteed.`
      );
    }
  }
}

function valueForInsert(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").replace(/Z$/, "");
  }
  if (value !== null && typeof value === "object" && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function valueForDigest(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) {
    return { type: "buffer", value: value.toString("base64") };
  }
  if (value instanceof Date) {
    return { type: "date", value: value.toISOString() };
  }
  if (typeof value === "object") {
    return { type: "object", value: JSON.stringify(value) };
  }
  return { type: typeof value, value: String(value) };
}

function updateRowDigest(hash: Hash, row: QueryRow, columns: string[]): void {
  hash.update(JSON.stringify(columns.map(column => valueForDigest(row[column]))));
  hash.update("\n");
}

interface ForeignKeyColumn {
  tableName: string;
  columnName: string;
  constraintName: string;
  referencedTable: string;
  referencedColumn: string;
  ordinalPosition: number;
}

async function listForeignKeyGroups(
  connection: DbConnection,
  applicationTableSet: Set<string>
): Promise<ForeignKeyColumn[][]> {
  const rows = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName,
            COLUMN_NAME AS columnName,
            CONSTRAINT_NAME AS constraintName,
            REFERENCED_TABLE_NAME AS referencedTable,
            REFERENCED_COLUMN_NAME AS referencedColumn,
            ORDINAL_POSITION AS ordinalPosition,
            REFERENCED_TABLE_SCHEMA AS referencedSchema,
            DATABASE() AS currentSchema
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`
  );
  const grouped = new Map<string, ForeignKeyColumn[]>();
  for (const row of rows) {
    const tableName = String(row.tableName);
    const referencedTable = String(row.referencedTable);
    if (
      String(row.referencedSchema) !== String(row.currentSchema) ||
      !applicationTableSet.has(tableName) ||
      !applicationTableSet.has(referencedTable)
    ) {
      throw new SafeMigrationError(
        "A foreign key points outside the application schema; copy stopped."
      );
    }
    const constraintName = String(row.constraintName);
    const key = `${tableName}\u0000${constraintName}`;
    const columns = grouped.get(key) ?? [];
    columns.push({
      tableName,
      columnName: String(row.columnName),
      constraintName,
      referencedTable,
      referencedColumn: String(row.referencedColumn),
      ordinalPosition: Number(row.ordinalPosition),
    });
    grouped.set(key, columns);
  }
  return [...grouped.values()];
}

async function assertForeignKeysValid(
  connection: DbConnection,
  foreignKeyGroups: ForeignKeyColumn[][]
): Promise<void> {
  for (const group of foreignKeyGroups) {
    const ordered = [...group].sort(
      (left, right) => left.ordinalPosition - right.ordinalPosition
    );
    const first = ordered[0];
    if (!first) continue;
    const join = ordered
      .map(
        column =>
          `child.${safeIdentifier(column.columnName)} = parent.${safeIdentifier(column.referencedColumn)}`
      )
      .join(" AND ");
    const notNull = ordered
      .map(column => `child.${safeIdentifier(column.columnName)} IS NOT NULL`)
      .join(" AND ");
    const rows = await queryRows(
      connection,
      `SELECT COUNT(*) AS orphanCount
         FROM ${safeIdentifier(first.tableName)} child
         LEFT JOIN ${safeIdentifier(first.referencedTable)} parent ON ${join}
        WHERE ${notNull}
          AND parent.${safeIdentifier(first.referencedColumn)} IS NULL`
    );
    const orphanCount = Number(rows[0]?.orphanCount ?? 0);
    if (orphanCount > 0) {
      throw new SafeMigrationError(
        `Foreign-key validation failed for ${first.tableName}.${first.constraintName}; copy rolled back.`
      );
    }
  }
}

async function sourceAutoIncrementValues(
  connection: DbConnection,
  applicationTableSet: Set<string>
): Promise<Map<string, string>> {
  const rows = await queryRows(
    connection,
    `SELECT TABLE_NAME AS tableName, AUTO_INCREMENT AS nextValue
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'`
  );
  return new Map(
    rows
      .filter(row => applicationTableSet.has(String(row.tableName)) && row.nextValue != null)
      .map(row => [String(row.tableName), String(row.nextValue)])
  );
}

async function preserveAutoIncrementValues(
  target: DbConnection,
  tableNames: string[],
  sourceValues: Map<string, string>
): Promise<void> {
  for (const tableName of tableNames) {
    const nextValue = sourceValues.get(tableName);
    if (!nextValue || !/^\d+$/.test(nextValue)) continue;
    if (BigInt(nextValue) <= 1n) continue;
    await target.query(
      `ALTER TABLE ${safeIdentifier(tableName)} AUTO_INCREMENT = ${nextValue}`
    );
  }
}

async function copyTable(
  source: DbConnection,
  target: DbConnection,
  tableName: string,
  columns: string[],
  primaryKeys: string[],
  expectedCount: number
): Promise<string> {
  const quotedTable = safeIdentifier(tableName);
  const quotedColumns = columns.map(safeIdentifier).join(", ");
  const orderBy = primaryKeys.map(safeIdentifier).join(", ");
  const sourceHash = createHash("sha256");
  let offset = 0;
  let copied = 0;

  while (true) {
    const rows = await queryRows(
      source,
      `SELECT ${quotedColumns}
         FROM ${quotedTable}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
      [BATCH_SIZE, offset]
    );
    if (rows.length === 0) break;
    const values = rows.map(row => {
      updateRowDigest(sourceHash, row, columns);
      return columns.map(column => valueForInsert(row[column]));
    });
    await target.query(
      `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES ?`,
      [values]
    );
    copied += rows.length;
    offset += rows.length;
  }

  if (copied !== expectedCount) {
    throw new SafeMigrationError(
      `Source row count changed or copy failed for ${tableName}; destination transaction rolled back.`
    );
  }
  return sourceHash.digest("hex");
}

async function digestTable(
  connection: DbConnection,
  tableName: string,
  columns: string[],
  primaryKeys: string[]
): Promise<string> {
  const quotedTable = safeIdentifier(tableName);
  const quotedColumns = columns.map(safeIdentifier).join(", ");
  const orderBy = primaryKeys.map(safeIdentifier).join(", ");
  const hash = createHash("sha256");
  let offset = 0;
  while (true) {
    const rows = await queryRows(
      connection,
      `SELECT ${quotedColumns}
         FROM ${quotedTable}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
      [BATCH_SIZE, offset]
    );
    if (rows.length === 0) break;
    for (const row of rows) updateRowDigest(hash, row, columns);
    offset += rows.length;
  }
  return hash.digest("hex");
}

function reportFailure(error: unknown): void {
  if (error instanceof SafeMigrationError) {
    console.error(error.message);
  } else {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "database_error")
        : "database_error";
    console.error(
      `HostGator copy failed (${code}). No DSN or row contents were printed. The source is unchanged; inspect the destination before any retry.`
    );
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const missingConfirmations = REQUIRED_CONFIRMATIONS.filter(
    confirmation => !process.argv.includes(confirmation)
  );
  if (missingConfirmations.length) {
    throw new SafeMigrationError(
      `Refusing to copy. Required confirmations: ${missingConfirmations.join(", ")}.`
    );
  }

  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.APP_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new SafeMigrationError(
      "Both DATABASE_URL (source) and APP_DATABASE_URL (target) are required."
    );
  }
  try {
    assertDistinctMysqlEndpoints(sourceUrl, targetUrl);
  } catch (error) {
    if (error instanceof MysqlEndpointError) {
      throw new SafeMigrationError(error.message);
    }
    throw new SafeMigrationError("Unable to validate that source and destination differ.");
  }

  let source: DbConnection | undefined;
  let target: DbConnection | undefined;
  let sourceTransactionStarted = false;
  let targetTransactionStarted = false;
  try {
    source = await mysql.createConnection(connectionOptions(sourceUrl));
    target = await mysql.createConnection(connectionOptions(targetUrl));
    await source.query("SET SESSION time_zone = '+00:00'");
    await target.query("SET SESSION time_zone = '+00:00'");

    await source.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await source.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    sourceTransactionStarted = true;

    const sourceAllTables = await listAllTables(source);
    const targetAllTables = await listAllTables(target);
    const sourceTables = applicationTables(sourceAllTables);
    const targetTables = applicationTables(targetAllTables);
    if (sourceTables.length === 0) {
      throw new SafeMigrationError("The source database contains no application tables.");
    }

    const sourceSet = new Set(sourceTables);
    const targetSet = new Set(targetTables);
    const missingOnTarget = sourceTables.filter(table => !targetSet.has(table));
    const extraOnTarget = targetTables.filter(table => !sourceSet.has(table));
    if (missingOnTarget.length || extraOnTarget.length) {
      throw new SafeMigrationError(
        `Source and destination table sets differ. Missing target tables: ${missingOnTarget.join(", ") || "none"}; extra target tables: ${extraOnTarget.join(", ") || "none"}. Apply the checked-in migrations first.`
      );
    }

    await assertInnoDbTables(source, sourceTables, "Source");
    await assertInnoDbTables(target, targetTables, "Destination");
    const sourceFingerprint = await schemaFingerprint(source, sourceSet);
    const targetFingerprint = await schemaFingerprint(target, targetSet);
    if (sourceFingerprint !== targetFingerprint) {
      throw new SafeMigrationError(
        "Source and destination structures differ (columns, types, defaults, indexes, constraints, collations or foreign keys). No rows were copied; apply matching migrations and retry."
      );
    }

    const sourceCounts = new Map<string, number>();
    for (const tableName of sourceTables) {
      sourceCounts.set(tableName, await tableRowCount(source, tableName));
    }
    for (const tableName of targetTables) {
      const count = await tableRowCount(target, tableName);
      if (count !== 0) {
        throw new SafeMigrationError(
          `Destination table ${tableName} is not empty; no rows were copied.`
        );
      }
    }

    const foreignKeyGroups = await listForeignKeyGroups(target, targetSet);
    const autoIncrementValues = await sourceAutoIncrementValues(source, sourceSet);
    await preserveAutoIncrementValues(target, targetTables, autoIncrementValues);

    await target.query("SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await target.query("SET FOREIGN_KEY_CHECKS = 0");
    await target.beginTransaction();
    targetTransactionStarted = true;

    // Recheck under the target transaction; the separate confirmation flag also requires
    // that no other client writes to HostGator during this one-time operation.
    for (const tableName of targetTables) {
      if ((await tableRowCount(target, tableName)) !== 0) {
        throw new SafeMigrationError(
          `Destination table ${tableName} became non-empty; the copy was rolled back.`
        );
      }
    }

    const tableHashes = new Map<string, string>();
    for (const tableName of sourceTables) {
      const columns = await tableColumns(source, tableName);
      const primaryKeys = await primaryKeyColumns(source, tableName);
      if (primaryKeys.length === 0) {
        throw new SafeMigrationError(
          `Source table ${tableName} has no primary key; deterministic batch copy is not supported.`
        );
      }
      const hash = await copyTable(
        source,
        target,
        tableName,
        columns,
        primaryKeys,
        sourceCounts.get(tableName) ?? 0
      );
      tableHashes.set(tableName, hash);
    }

    for (const tableName of sourceTables) {
      const columns = await tableColumns(source, tableName);
      const primaryKeys = await primaryKeyColumns(target, tableName);
      const copiedCount = await tableRowCount(target, tableName);
      const sourceCount = sourceCounts.get(tableName) ?? 0;
      if (copiedCount !== sourceCount) {
        throw new SafeMigrationError(
          `Row count validation failed for ${tableName}; destination transaction rolled back.`
        );
      }
      const copiedHash = await digestTable(target, tableName, columns, primaryKeys);
      if (copiedHash !== tableHashes.get(tableName)) {
        throw new SafeMigrationError(
          `Row-value fingerprint validation failed for ${tableName}; destination transaction rolled back.`
        );
      }
      console.log(`${tableName}: ${copiedCount} rows and row values verified`);
    }

    await assertForeignKeysValid(target, foreignKeyGroups);
    await target.query("SET FOREIGN_KEY_CHECKS = 1");
    await source.commit();
    sourceTransactionStarted = false;
    await target.commit();
    targetTransactionStarted = false;
    console.log(
      `Copy completed for ${sourceTables.length} application tables. The source was not modified; keep its writes frozen until the approved cutover.`
    );
  } catch (error) {
    if (target && targetTransactionStarted) {
      await target.rollback().catch(() => undefined);
    }
    if (source && sourceTransactionStarted) {
      await source.rollback().catch(() => undefined);
    }
    throw error;
  } finally {
    if (target) {
      await target.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => undefined);
      await target.end().catch(() => undefined);
    }
    if (source) await source.end().catch(() => undefined);
  }
}

void main().catch(reportFailure);
