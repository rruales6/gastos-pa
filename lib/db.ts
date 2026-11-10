type Row = Record<string, any>;
type QueryFn = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS months (
    ym TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'abierto',
    note TEXT,
    closed_by TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS incomes (
    id SERIAL PRIMARY KEY,
    ym TEXT NOT NULL REFERENCES months(ym) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    received_by TEXT NOT NULL,
    received BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    ym TEXT NOT NULL REFERENCES months(ym) ON DELETE CASCADE,
    date DATE,
    concept TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    paid_by TEXT NOT NULL,
    note TEXT,
    recurring BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS transfers (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    from_person TEXT NOT NULL,
    to_person TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    ym TEXT REFERENCES months(ym) ON DELETE SET NULL,
    note TEXT,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS activity (
    id SERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    who TEXT NOT NULL,
    action TEXT NOT NULL
  )`,
];

// Mes inicial: noviembre 2026, con los ingresos fijos de papá.
const FIRST_MONTH = "2026-11";
const DEFAULT_INCOMES = [
  { concept: "Jubilación", amount: 409 },
  { concept: "Erika", amount: 120 },
];

const g = globalThis as unknown as { __db?: Promise<QueryFn> };

async function connect(): Promise<QueryFn> {
  let q: QueryFn;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    q = async (text, params = []) => (await sql.query(text, params)) as Row[];
  } else {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
      throw new Error("Falta DATABASE_URL: conecta una base Neon en Vercel → Storage.");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite("./.pglite");
    q = async (text, params = []) => (await db.query<Row>(text, params)).rows;
  }

  for (const stmt of SCHEMA) await q(stmt);

  const [{ n }] = await q(`SELECT count(*)::int AS n FROM months`);
  if (n === 0) {
    await q(`INSERT INTO months (ym) VALUES ($1) ON CONFLICT DO NOTHING`, [FIRST_MONTH]);
    for (const inc of DEFAULT_INCOMES) {
      await q(
        `INSERT INTO incomes (ym, concept, amount, received_by, created_by) VALUES ($1,$2,$3,'ricardo','sistema')`,
        [FIRST_MONTH, inc.concept, inc.amount],
      );
    }
  }
  return q;
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!g.__db) g.__db = connect().catch((e) => { g.__db = undefined; throw e; });
  const q = await g.__db;
  return (await q(text, params)) as T[];
}

export async function logActivity(who: string, action: string) {
  await query(`INSERT INTO activity (who, action) VALUES ($1, $2)`, [who, action]);
}
