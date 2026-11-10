import { ADMIN, PEOPLE, type PersonId } from "./people";

export type Income = {
  id: number; ym: string; concept: string; amount: number;
  received_by: PersonId; received: boolean; created_by: string;
};
export type Expense = {
  id: number; ym: string; date: string | null; concept: string; amount: number;
  paid_by: PersonId; note: string | null; recurring: boolean; created_by: string;
};
export type Transfer = {
  id: number; date: string; from_person: PersonId; to_person: PersonId; amount: number;
  ym: string | null; note: string | null; confirmed: boolean; created_by: string;
};
export type Month = { ym: string; status: "abierto" | "cerrado"; note: string | null };

export const EPS = 0.005;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
const N = PEOPLE.length;

export type PersonMonth = {
  paid: number;      // lo que pagó de su bolsillo en gastos
  held: number;      // ingresos de papá que recibió (jubilación, Erika…)
  heldUsed: number;  // parte de esos ingresos que se usó para cubrir gastos
  share: number;     // cuota que le toca del excedente
  net: number;       // paid - heldUsed - share  (>0 le deben, <0 debe)
  sent: number;      // transferencias enviadas asociadas al mes
  received: number;  // transferencias recibidas asociadas al mes
  pending: number;   // net + sent - received
};

export type MonthSummary = {
  total: number;
  incomeTotal: number;
  excess: number;    // total - ingresos (negativo = sobrante)
  surplus: number;   // ingresos no usados: quedan guardados para papá
  share: number;
  people: Record<PersonId, PersonMonth>;
  settled: boolean;
};

export function summarize(incomes: Income[], expenses: Expense[], transfers: Transfer[]): MonthSummary {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const incomeTotal = incomes.reduce((s, i) => s + i.amount, 0);
  const excess = total - incomeTotal;
  // Cuota redondeada al centavo; el centavo sobrante lo absorbe Ricardo (gestor).
  const share = round2(Math.max(0, excess) / N);
  const surplus = Math.max(0, -excess);
  // Si sobra, solo se usa la parte de los ingresos que cubre los gastos.
  const usedRatio = incomeTotal > 0 ? Math.min(1, total / incomeTotal) : 0;

  const people = {} as Record<PersonId, PersonMonth>;
  for (const p of PEOPLE) {
    const paid = expenses.filter((e) => e.paid_by === p.id).reduce((s, e) => s + e.amount, 0);
    const held = incomes.filter((i) => i.received_by === p.id).reduce((s, i) => s + i.amount, 0);
    const sent = transfers.filter((t) => t.from_person === p.id).reduce((s, t) => s + t.amount, 0);
    const received = transfers.filter((t) => t.to_person === p.id).reduce((s, t) => s + t.amount, 0);
    const heldUsed = round2(held * usedRatio);
    const net = round2(paid - heldUsed - share);
    people[p.id] = { paid, held, heldUsed, share, net, sent, received, pending: round2(net + sent - received) };
  }
  // Ajuste para que la suma de saldos sea exactamente cero.
  const a = people[ADMIN];
  const othersNet = PEOPLE.filter((p) => p.id !== ADMIN).reduce((s, p) => s + people[p.id].net, 0);
  a.net = round2(-othersNet);
  a.share = round2(a.paid - a.heldUsed - a.net);
  a.pending = round2(a.net + a.sent - a.received);
  const settled = PEOPLE.every((p) => Math.abs(people[p.id].pending) < EPS);
  return { total, incomeTotal, excess, surplus, share, people, settled };
}

/** Saldo acumulado por hermano: todos los meses + todas las transferencias. */
export function globalBalances(
  monthNets: Record<PersonId, number>[],
  transfers: Transfer[],
): Record<PersonId, number> {
  const bal = Object.fromEntries(PEOPLE.map((p) => [p.id, 0])) as Record<PersonId, number>;
  for (const m of monthNets) for (const p of PEOPLE) bal[p.id] += m[p.id];
  for (const t of transfers) {
    bal[t.from_person] += t.amount;
    bal[t.to_person] -= t.amount;
  }
  for (const p of PEOPLE) bal[p.id] = round2(bal[p.id]);
  return bal;
}

/** Transferencias mínimas sugeridas para dejar a todos en cero. */
export function suggestSettlement(bal: Record<PersonId, number>) {
  const debtors = PEOPLE.map((p) => ({ id: p.id, v: -bal[p.id] })).filter((x) => x.v > EPS);
  const creditors = PEOPLE.map((p) => ({ id: p.id, v: bal[p.id] })).filter((x) => x.v > EPS);
  const out: { from: PersonId; to: PersonId; amount: number }[] = [];
  for (const d of debtors) {
    for (const c of creditors) {
      if (d.v < EPS) break;
      const a = Math.min(d.v, c.v);
      if (a < EPS) continue;
      out.push({ from: d.id, to: c.id, amount: Math.round(a * 100) / 100 });
      d.v -= a;
      c.v -= a;
    }
  }
  return out;
}

export function statusText(v: number): { label: string; tone: "ok" | "owe" | "due" } {
  if (Math.abs(v) < EPS) return { label: "Al día", tone: "ok" };
  return v < 0 ? { label: "Debe", tone: "owe" } : { label: "Le deben", tone: "due" };
}
