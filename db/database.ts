import Database from "better-sqlite3";
import { Pool } from "pg";

export type DatabaseMode = "sqlite" | "postgres";

export interface AppDatabase {
  mode: DatabaseMode;
  exec(sql: string): Promise<void>;
  prepare(sql: string): {
    get(params?: unknown[] | unknown): Promise<any>;
    all(params?: unknown[] | unknown): Promise<any[]>;
    run(params?: unknown[] | unknown): Promise<{ changes: number; lastInsertRowid?: number | bigint }>;
  };
  close(): Promise<void>;
}

const isPostgresConfigured = () => Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));

const normalizeParams = (params?: unknown[] | unknown) => {
  if (params === undefined) {
    return [];
  }

  return Array.isArray(params) ? params : [params];
};

const normalizeSqlForPostgres = (sql: string, params: unknown[] | unknown) => {
  const values = normalizeParams(params);
  let index = 0;
  const convertedSql = sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });

  return { sql: convertedSql, params: values };
};

class SqliteStatement {
  constructor(private statement: any) {}

  async get(params?: unknown[] | unknown) {
    return this.statement.get(...normalizeParams(params));
  }

  async all(params?: unknown[] | unknown) {
    return this.statement.all(...normalizeParams(params));
  }

  async run(params?: unknown[] | unknown) {
    return this.statement.run(...normalizeParams(params));
  }
}

class PostgresStatement {
  constructor(private pool: Pool, private sql: string) {}

  async get(params?: unknown[] | unknown) {
    const { sql, params: values } = normalizeSqlForPostgres(this.sql, params);
    const result = await this.pool.query(sql, values);
    return result.rows[0];
  }

  async all(params?: unknown[] | unknown) {
    const { sql, params: values } = normalizeSqlForPostgres(this.sql, params);
    const result = await this.pool.query(sql, values);
    return result.rows;
  }

  async run(params?: unknown[] | unknown) {
    const { sql, params: values } = normalizeSqlForPostgres(this.sql, params);
    const result = await this.pool.query(sql, values);
    return { changes: result.rowCount ?? 0, lastInsertRowid: undefined };
  }
}

export const createDatabase = async (): Promise<AppDatabase> => {
  if (isPostgresConfigured()) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });

    return {
      mode: "postgres",
      async exec(sql: string) {
        await pool.query(sql);
      },
      prepare(sql: string) {
        return new PostgresStatement(pool, sql) as any;
      },
      async close() {
        await pool.end();
      },
    };
  }

  const databasePath = process.env.SQLITE_DB_PATH || "optiscann.db";
  const sqliteDb = new Database(databasePath);

  return {
    mode: "sqlite",
    async exec(sql: string) {
      sqliteDb.exec(sql);
    },
    prepare(sql: string) {
      return new SqliteStatement(sqliteDb.prepare(sql)) as any;
    },
    async close() {
      sqliteDb.close();
    },
  };
};

export const initializeDatabase = async (db: AppDatabase) => {
  if (db.mode === "postgres") {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user'
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        age INTEGER,
        gender TEXT,
        relationship TEXT,
        is_authorized BOOLEAN DEFAULT FALSE,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        patient_name TEXT,
        data TEXT,
        previous_report_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(profile_id) REFERENCES profiles(id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        patient_name TEXT,
        report_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(profile_id) REFERENCES profiles(id)
      );
    `);
    return;
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      age INTEGER,
      gender TEXT,
      relationship TEXT,
      is_authorized BOOLEAN DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      patient_name TEXT,
      data TEXT,
      previous_report_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(profile_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      patient_name TEXT,
      report_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(profile_id) REFERENCES profiles(id)
    );
  `);
};
