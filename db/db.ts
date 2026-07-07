import path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';

export interface DbAdapter {
  init(): Promise<void>;
  getUserByUsername(username: string): Promise<any>;
  createUser(id: string, username: string, password: string, role: string): Promise<void>;
  createProfile(id: string, userId: string, name: string, age: number, gender: string, relationship: string, isAuthorized: boolean): Promise<void>;
  getProfilesByUserId(userId: string): Promise<any[]>;
  authorizeProfile(profileId: string, isAuthorized: boolean): Promise<void>;
  getAllProfiles(): Promise<any[]>;
  getAllReports(): Promise<any[]>;
  createReport(id: string, profileId: string, patientName: string, data: unknown, previousReportData: unknown): Promise<void>;
  getReportsByProfileId(profileId: string): Promise<any[]>;
  createAppointment(id: string, profileId: string, patientName: string, reportId: string): Promise<void>;
  getAllAppointments(): Promise<any[]>;
  close(): Promise<void>;
}

class SqliteDbAdapter implements DbAdapter {
  private db: Database.Database;

  constructor(dbPath = path.join(process.cwd(), 'optiscann.db')) {
    this.db = new Database(dbPath);
  }

  async init(): Promise<void> {
    this.db.exec(`
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
  }

  async getUserByUsername(username: string): Promise<any> {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  async createUser(id: string, username: string, password: string, role: string): Promise<void> {
    this.db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)').run(id, username, password, role);
  }

  async createProfile(id: string, userId: string, name: string, age: number, gender: string, relationship: string, isAuthorized: boolean): Promise<void> {
    this.db.prepare('INSERT INTO profiles (id, user_id, name, age, gender, relationship, is_authorized) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, name, age, gender, relationship, isAuthorized ? 1 : 0);
  }

  async getProfilesByUserId(userId: string): Promise<any[]> {
    return this.db.prepare('SELECT * FROM profiles WHERE user_id = ?').all(userId) as any[];
  }

  async authorizeProfile(profileId: string, isAuthorized: boolean): Promise<void> {
    this.db.prepare('UPDATE profiles SET is_authorized = ? WHERE id = ?').run(isAuthorized ? 1 : 0, profileId);
  }

  async getAllProfiles(): Promise<any[]> {
    return this.db.prepare('SELECT * FROM profiles').all() as any[];
  }

  async getAllReports(): Promise<any[]> {
    return this.db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as any[];
  }

  async createReport(id: string, profileId: string, patientName: string, data: unknown, previousReportData: unknown): Promise<void> {
    this.db.prepare('INSERT INTO reports (id, profile_id, patient_name, data, previous_report_data) VALUES (?, ?, ?, ?, ?)')
      .run(id, profileId, patientName, JSON.stringify(data), previousReportData ? JSON.stringify(previousReportData) : null);
  }

  async getReportsByProfileId(profileId: string): Promise<any[]> {
    const rows = this.db.prepare('SELECT * FROM reports WHERE profile_id = ? ORDER BY created_at DESC').all(profileId) as any[];
    return rows.map((row) => ({ ...row, data: JSON.parse(row.data), previous_report_data: row.previous_report_data ? JSON.parse(row.previous_report_data) : null }));
  }

  async createAppointment(id: string, profileId: string, patientName: string, reportId: string): Promise<void> {
    this.db.prepare('INSERT INTO appointments (id, profile_id, patient_name, report_id, status) VALUES (?, ?, ?, ?, ?)')
      .run(id, profileId, patientName, reportId, 'pending');
  }

  async getAllAppointments(): Promise<any[]> {
    return this.db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all() as any[];
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

class PostgresDbAdapter implements DbAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user'
      );
    `);
    await this.pool.query(`
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
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        patient_name TEXT,
        data TEXT,
        previous_report_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(profile_id) REFERENCES profiles(id)
      );
    `);
    await this.pool.query(`
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
  }

  async getUserByUsername(username: string): Promise<any> {
    const result = await this.pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] ?? null;
  }

  async createUser(id: string, username: string, password: string, role: string): Promise<void> {
    await this.pool.query('INSERT INTO users (id, username, password, role) VALUES ($1, $2, $3, $4)', [id, username, password, role]);
  }

  async createProfile(id: string, userId: string, name: string, age: number, gender: string, relationship: string, isAuthorized: boolean): Promise<void> {
    await this.pool.query('INSERT INTO profiles (id, user_id, name, age, gender, relationship, is_authorized) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, userId, name, age, gender, relationship, isAuthorized]);
  }

  async getProfilesByUserId(userId: string): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async authorizeProfile(profileId: string, isAuthorized: boolean): Promise<void> {
    await this.pool.query('UPDATE profiles SET is_authorized = $1 WHERE id = $2', [isAuthorized, profileId]);
  }

  async getAllProfiles(): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM profiles');
    return result.rows;
  }

  async getAllReports(): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    return result.rows;
  }

  async createReport(id: string, profileId: string, patientName: string, data: unknown, previousReportData: unknown): Promise<void> {
    await this.pool.query('INSERT INTO reports (id, profile_id, patient_name, data, previous_report_data) VALUES ($1, $2, $3, $4, $5)', [id, profileId, patientName, JSON.stringify(data), previousReportData ? JSON.stringify(previousReportData) : null]);
  }

  async getReportsByProfileId(profileId: string): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM reports WHERE profile_id = $1 ORDER BY created_at DESC', [profileId]);
    return result.rows.map((row) => ({ ...row, data: JSON.parse(row.data), previous_report_data: row.previous_report_data ? JSON.parse(row.previous_report_data) : null }));
  }

  async createAppointment(id: string, profileId: string, patientName: string, reportId: string): Promise<void> {
    await this.pool.query('INSERT INTO appointments (id, profile_id, patient_name, report_id, status) VALUES ($1, $2, $3, $4, $5)', [id, profileId, patientName, reportId, 'pending']);
  }

  async getAllAppointments(): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM appointments ORDER BY created_at DESC');
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabaseAdapter(): DbAdapter {
  const dbType = process.env.DB_TYPE?.toLowerCase();
  const connectionString = process.env.DATABASE_URL;

  if (dbType === 'postgres' || dbType === 'postgresql' || connectionString?.includes('postgres')) {
    if (!connectionString) {
      throw new Error('DATABASE_URL is required when using PostgreSQL');
    }
    return new PostgresDbAdapter(connectionString);
  }

  return new SqliteDbAdapter(process.env.DATABASE_PATH || path.join(process.cwd(), 'optiscann.db'));
}
