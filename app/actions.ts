"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, logActivity } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { COOKIE, MAX_AGE, createToken, expectedPassword } from "@/lib/session";
import { ADMIN, isPerson, personName, type PersonId } from "@/lib/people";
import { fmt, isYm, monthLabel, nextYm, todayIso } from "@/lib/format";

// ---------- utilidades ----------

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

function backTo(fd: FormData, fallback = "/"): string {
  const b = str(fd, "back");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

function withParam(path: string, key: string, value: string): string {
  const [p, q = ""] = path.split("?");
  const sp = new URLSearchParams(q);
  sp.delete("edit");
  sp.set(key, value);
  return `${p}?${sp.toString()}`;
}

function fail(fd: FormData, msg: string): never {
  redirect(withParam(backTo(fd), "error", msg));
}

function done(fd: FormData, fallback = "/"): never {
  revalidatePath("/", "layout");
  const b = backTo(fd, fallback).split("?")[0];
  redirect(b);
}

function amount(fd: FormData, k = "amount"): number | null {
  const raw = str(fd, k).replace(/\s/g, "").replace(",", ".");
  const n = Number(raw);
  if (!raw || !isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function person(fd: FormData, k: string): PersonId | null {
  const v = str(fd, k);
  return isPerson(v) ? v : null;
}

function date(fd: FormData, k = "date"): string | null {
  const v = str(fd, k);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function monthStatus(ym: string): Promise<string | null> {
  const r = await query(`SELECT status FROM months WHERE ym = $1`, [ym]);
  return r[0]?.status ?? null;
}

async function requireOpen(fd: FormData, ym: string) {
  const s = await monthStatus(ym);
  if (!s) fail(fd, "El mes no existe");
  if (s === "cerrado") fail(fd, "El mes está cerrado. Ricardo puede reabrirlo.");
}

function canModify(user: PersonId, row: { created_by: string; owner?: string }) {
  return user === ADMIN || row.created_by === user || row.owner === user;
}

// ---------- sesión ----------

export async function login(fd: FormData) {
  const user = person(fd, "user");
  const pass = str(fd, "password");
  if (!user) redirect("/login?error=Elige+tu+nombre");
  const expected = expectedPassword(user);
  if (!expected) redirect("/login?error=Contraseña+no+configurada+en+el+servidor");
  if (pass !== expected) redirect(`/login?error=Contraseña+incorrecta&u=${user}`);
  const jar = await cookies();
  jar.set(COOKIE, await createToken(user), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/login");
}

// ---------- meses ----------

export async function openNextMonth(fd: FormData) {
  const user = await requireUser();
  const [last] = await query(`SELECT ym FROM months ORDER BY ym DESC LIMIT 1`);
  const ym = last ? nextYm(last.ym) : todayIso().slice(0, 7);
  await query(`INSERT INTO months (ym) VALUES ($1) ON CONFLICT DO NOTHING`, [ym]);
  if (last) {
    // Copia ingresos y gastos fijos del mes anterior.
    await query(
      `INSERT INTO incomes (ym, concept, amount, received_by, created_by)
       SELECT $1, concept, amount, received_by, $3 FROM incomes WHERE ym = $2 ORDER BY id`,
      [ym, last.ym, user],
    );
    await query(
      `INSERT INTO expenses (ym, date, concept, amount, paid_by, note, recurring, created_by)
       SELECT $1, NULL, concept, amount, paid_by, note, true, $3
       FROM expenses WHERE ym = $2 AND recurring ORDER BY id`,
      [ym, last.ym, user],
    );
  }
  await logActivity(user, `abrió el mes ${monthLabel(ym)}`);
  revalidatePath("/", "layout");
  redirect(`/mes/${ym}`);
}

export async function setMonthStatus(fd: FormData) {
  const user = await requireUser();
  const ym = str(fd, "ym");
  const status = str(fd, "status");
  if (!isYm(ym) || !["abierto", "cerrado"].includes(status)) fail(fd, "Datos inválidos");
  if (status === "abierto" && user !== ADMIN) fail(fd, "Solo Ricardo puede reabrir un mes");
  await query(
    `UPDATE months SET status = $2, closed_by = $3, closed_at = CASE WHEN $2 = 'cerrado' THEN now() END WHERE ym = $1`,
    [ym, status, status === "cerrado" ? user : null],
  );
  await logActivity(user, `${status === "cerrado" ? "cerró" : "reabrió"} el mes ${monthLabel(ym)}`);
  done(fd);
}

export async function saveMonthNote(fd: FormData) {
  const user = await requireUser();
  const ym = str(fd, "ym");
  await query(`UPDATE months SET note = $2 WHERE ym = $1`, [ym, str(fd, "note") || null]);
  await logActivity(user, `actualizó la nota de ${monthLabel(ym)}`);
  done(fd);
}

// ---------- gastos ----------

export async function saveExpense(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id")) || null;
  const ym = str(fd, "ym");
  const concept = str(fd, "concept");
  const amt = amount(fd);
  const paidBy = person(fd, "paid_by");
  const d = date(fd);
  const note = str(fd, "note") || null;
  const recurring = fd.get("recurring") === "on";
  if (!isYm(ym)) fail(fd, "Mes inválido");
  if (!concept) fail(fd, "Escribe el concepto");
  if (!amt) fail(fd, "Importe inválido");
  if (!paidBy) fail(fd, "Indica quién pagó");
  await requireOpen(fd, ym);

  if (id) {
    const [row] = await query(`SELECT created_by, paid_by, concept, amount::float8 AS amount FROM expenses WHERE id = $1 AND ym = $2`, [id, ym]);
    if (!row) fail(fd, "Gasto no encontrado");
    if (!canModify(user, { created_by: row.created_by, owner: row.paid_by })) fail(fd, "No puedes editar este gasto");
    await query(
      `UPDATE expenses SET date=$2, concept=$3, amount=$4, paid_by=$5, note=$6, recurring=$7 WHERE id=$1`,
      [id, d, concept, amt, paidBy, note, recurring],
    );
    await logActivity(user, `editó gasto en ${monthLabel(ym)}: "${row.concept}" ${fmt(row.amount)} → "${concept}" ${fmt(amt)} (pagó ${personName(paidBy)})`);
  } else {
    await query(
      `INSERT INTO expenses (ym, date, concept, amount, paid_by, note, recurring, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ym, d, concept, amt, paidBy, note, recurring, user],
    );
    await logActivity(user, `agregó gasto en ${monthLabel(ym)}: "${concept}" ${fmt(amt)} (pagó ${personName(paidBy)})`);
  }
  done(fd, `/mes/${ym}`);
}

export async function deleteExpense(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  const [row] = await query(`SELECT ym, created_by, paid_by, concept, amount::float8 AS amount FROM expenses WHERE id = $1`, [id]);
  if (!row) fail(fd, "Gasto no encontrado");
  await requireOpen(fd, row.ym);
  if (!canModify(user, { created_by: row.created_by, owner: row.paid_by })) fail(fd, "No puedes borrar este gasto");
  await query(`DELETE FROM expenses WHERE id = $1`, [id]);
  await logActivity(user, `borró gasto en ${monthLabel(row.ym)}: "${row.concept}" ${fmt(row.amount)}`);
  done(fd);
}

// ---------- ingresos de papá ----------

export async function saveIncome(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id")) || null;
  const ym = str(fd, "ym");
  const concept = str(fd, "concept");
  const amt = amount(fd);
  const by = person(fd, "received_by");
  if (!isYm(ym) || !concept || !amt || !by) fail(fd, "Completa concepto, importe y quién lo recibe");
  await requireOpen(fd, ym);
  if (id) {
    await query(`UPDATE incomes SET concept=$2, amount=$3, received_by=$4 WHERE id=$1 AND ym=$5`, [id, concept, amt, by, ym]);
    await logActivity(user, `editó ingreso en ${monthLabel(ym)}: "${concept}" ${fmt(amt)} (recibe ${personName(by)})`);
  } else {
    await query(
      `INSERT INTO incomes (ym, concept, amount, received_by, created_by) VALUES ($1,$2,$3,$4,$5)`,
      [ym, concept, amt, by, user],
    );
    await logActivity(user, `agregó ingreso en ${monthLabel(ym)}: "${concept}" ${fmt(amt)} (recibe ${personName(by)})`);
  }
  done(fd, `/mes/${ym}`);
}

export async function toggleIncomeReceived(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  const [row] = await query(`SELECT ym, concept, received FROM incomes WHERE id = $1`, [id]);
  if (!row) fail(fd, "Ingreso no encontrado");
  await query(`UPDATE incomes SET received = NOT received WHERE id = $1`, [id]);
  await logActivity(user, `marcó "${row.concept}" de ${monthLabel(row.ym)} como ${row.received ? "no recibido" : "recibido"}`);
  done(fd);
}

export async function deleteIncome(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  const [row] = await query(`SELECT ym, concept, amount::float8 AS amount FROM incomes WHERE id = $1`, [id]);
  if (!row) fail(fd, "Ingreso no encontrado");
  await requireOpen(fd, row.ym);
  await query(`DELETE FROM incomes WHERE id = $1`, [id]);
  await logActivity(user, `borró ingreso en ${monthLabel(row.ym)}: "${row.concept}" ${fmt(row.amount)}`);
  done(fd);
}

// ---------- transferencias entre hermanos ----------

export async function addTransfer(fd: FormData) {
  const user = await requireUser();
  const from = person(fd, "from_person");
  const to = person(fd, "to_person");
  const amt = amount(fd);
  const d = date(fd) ?? todayIso();
  const ymRaw = str(fd, "ym");
  const ym = isYm(ymRaw) ? ymRaw : null;
  const note = str(fd, "note") || null;
  if (!from || !to || from === to) fail(fd, "Elige quién envía y quién recibe (distintos)");
  if (!amt) fail(fd, "Importe inválido");
  if (ym && !(await monthStatus(ym))) fail(fd, "El mes no existe");
  // Si quien registra es quien recibe, queda confirmada de una vez.
  const confirmed = user === to;
  await query(
    `INSERT INTO transfers (date, from_person, to_person, amount, ym, note, confirmed, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [d, from, to, amt, ym, note, confirmed, user],
  );
  await logActivity(
    user,
    `registró transferencia de ${personName(from)} a ${personName(to)} por ${fmt(amt)}${ym ? ` (excedente de ${monthLabel(ym)})` : " (abono general)"}`,
  );
  done(fd, "/pagos");
}

export async function confirmTransfer(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  const [row] = await query(`SELECT from_person, to_person, amount::float8 AS amount FROM transfers WHERE id = $1`, [id]);
  if (!row) fail(fd, "Transferencia no encontrada");
  if (row.to_person !== user) fail(fd, "Solo quien recibe puede confirmar");
  await query(`UPDATE transfers SET confirmed = true WHERE id = $1`, [id]);
  await logActivity(user, `confirmó haber recibido ${fmt(row.amount)} de ${personName(row.from_person)}`);
  done(fd);
}

export async function deleteTransfer(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  const [row] = await query(
    `SELECT from_person, to_person, amount::float8 AS amount, created_by FROM transfers WHERE id = $1`, [id],
  );
  if (!row) fail(fd, "Transferencia no encontrada");
  if (!canModify(user, { created_by: row.created_by })) fail(fd, "No puedes borrar esta transferencia");
  await query(`DELETE FROM transfers WHERE id = $1`, [id]);
  await logActivity(user, `borró transferencia de ${personName(row.from_person)} a ${personName(row.to_person)} por ${fmt(row.amount)}`);
  done(fd);
}
