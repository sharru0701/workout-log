import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

const MIGRATION_TABLE_NAME = "__drizzle_migrations";
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type MigrationLedgerTableRow = {
  schema_name: string;
  table_name: string;
};

export type MigrationLedgerSnapshot = {
  tableQualifiedName: string | null;
  appliedCount: number;
  latestAppliedAt: string | null;
  latestAppliedHash: string | null;
};

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function findMigrationTable() {
  const row = await db.execute<MigrationLedgerTableRow>(sql`
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    inner join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and c.relname = ${MIGRATION_TABLE_NAME}
    order by
      case n.nspname
        when 'drizzle' then 0
        when 'public' then 1
        else 2
      end,
      n.nspname asc
    limit 1
  `);

  return row.rows[0] ?? null;
}

export async function readMigrationLedgerSnapshot(): Promise<MigrationLedgerSnapshot> {
  const migrationTable = await findMigrationTable();
  if (!migrationTable) {
    return {
      tableQualifiedName: null,
      appliedCount: 0,
      latestAppliedAt: null,
      latestAppliedHash: null,
    };
  }

  const qualifiedTableName = `${quoteIdentifier(migrationTable.schema_name)}.${quoteIdentifier(migrationTable.table_name)}`;

  const [appliedCountRow, latestAppliedRow] = await Promise.all([
    db.execute<{ count: number | string }>(sql.raw(`select count(*)::int as count from ${qualifiedTableName}`)),
    db.execute<{ created_at: string | null; hash: string | null }>(
      sql.raw(`select created_at, hash from ${qualifiedTableName} order by created_at desc limit 1`),
    ),
  ]);

  const latestApplied = latestAppliedRow.rows[0];

  return {
    tableQualifiedName: `${migrationTable.schema_name}.${migrationTable.table_name}`,
    appliedCount: parseNumber(appliedCountRow.rows[0]?.count, 0),
    latestAppliedAt: latestApplied?.created_at ?? null,
    latestAppliedHash: latestApplied?.hash ?? null,
  };
}
