import { query } from "./db";
import { summarize, type Expense, type Income, type Month, type MonthSummary, type Transfer } from "./calc";

const INCOME_COLS = `id, ym, concept, amount::float8 AS amount, received_by, received, created_by`;
const EXPENSE_COLS = `id, ym, to_char(date,'YYYY-MM-DD') AS date, concept, amount::float8 AS amount,
  paid_by, note, recurring, created_by`;
const TRANSFER_COLS = `id, to_char(date,'YYYY-MM-DD') AS date, from_person, to_person,
  amount::float8 AS amount, ym, note, confirmed, created_by`;

export async function getMonths(): Promise<Month[]> {
  return query<Month>(`SELECT ym, status, note FROM months ORDER BY ym DESC`);
}

export async function getMonth(ym: string): Promise<Month | null> {
  const rows = await query<Month>(`SELECT ym, status, note FROM months WHERE ym = $1`, [ym]);
  return rows[0] ?? null;
}

export type MonthFull = Month & {
  incomes: Income[];
  expenses: Expense[];
  transfers: Transfer[];
  summary: MonthSummary;
};

/** Carga todos los meses con sus movimientos (pocos datos: 3 hermanos, ~10 gastos/mes). */
export async function getAll(): Promise<{ months: MonthFull[]; transfers: Transfer[] }> {
  const [months, incomes, expenses, transfers] = await Promise.all([
    getMonths(),
    query<Income>(`SELECT ${INCOME_COLS} FROM incomes ORDER BY id`),
    query<Expense>(`SELECT ${EXPENSE_COLS} FROM expenses ORDER BY date NULLS LAST, id`),
    query<Transfer>(`SELECT ${TRANSFER_COLS} FROM transfers ORDER BY date DESC, id DESC`),
  ]);
  const full = months.map((m) => {
    const inc = incomes.filter((i) => i.ym === m.ym);
    const exp = expenses.filter((e) => e.ym === m.ym);
    const tr = transfers.filter((t) => t.ym === m.ym);
    return { ...m, incomes: inc, expenses: exp, transfers: tr, summary: summarize(inc, exp, tr) };
  });
  return { months: full, transfers };
}

export type ActivityRow = { id: number; at: string; who: string; action: string };

export async function getActivity(limit = 200): Promise<ActivityRow[]> {
  return query<ActivityRow>(
    `SELECT id, to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at, who, action
     FROM activity ORDER BY id DESC LIMIT $1`,
    [limit],
  );
}
