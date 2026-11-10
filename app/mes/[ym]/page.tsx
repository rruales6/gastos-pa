import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAll } from "@/lib/data";
import { EPS, type Expense, type Income } from "@/lib/calc";
import { ADMIN, PEOPLE, personName, type PersonId } from "@/lib/people";
import { fmt, fmtDate, isYm, monthLabel, todayIso } from "@/lib/format";
import {
  deleteExpense, deleteIncome, deleteTransfer, saveExpense, saveIncome, saveMonthNote,
  setMonthStatus, toggleIncomeReceived,
} from "@/app/actions";
import { ActionButton, Flash, Header, Status } from "@/components/ui";
import { PersonSelect, TransferForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function MonthPage({
  params, searchParams,
}: {
  params: Promise<{ ym: string }>;
  searchParams: Promise<{ error?: string; edit?: string; editInc?: string }>;
}) {
  const user = await requireUser();
  const { ym } = await params;
  const { error, edit, editInc } = await searchParams;
  if (!isYm(ym)) notFound();

  const { months } = await getAll();
  const idx = months.findIndex((m) => m.ym === ym);
  if (idx < 0) notFound();
  const m = months[idx];
  const newer = months[idx - 1]?.ym;
  const older = months[idx + 1]?.ym;
  const open = m.status === "abierto";
  const s = m.summary;
  const back = `/mes/${ym}`;
  const today = todayIso();
  const defaultDate = today.startsWith(ym) ? today : `${ym}-01`;

  // Sugerencia de pago para el usuario actual si debe en este mes.
  const mine = s.people[user];
  const creditor = PEOPLE.map((p) => p.id).filter((id) => id !== user)
    .sort((a, b) => s.people[b].pending - s.people[a].pending)[0];

  return (
    <div className="wrap">
      <Header user={user} />
      <Flash error={error} />

      <div className="month-nav">
        <h1>
          {monthLabel(ym)}{" "}
          <span className={`chip ${open ? "open" : "closed"}`}>{open ? "Abierto" : "Cerrado"}</span>
        </h1>
        <div className="arrows">
          {older && <Link className="btn ghost sm" href={`/mes/${older}`}>‹ {monthLabel(older)}</Link>}
          {newer && <Link className="btn ghost sm" href={`/mes/${newer}`}>{monthLabel(newer)} ›</Link>}
        </div>
      </div>

      <section className="card">
        <div className="stats">
          <Stat k="Gastos del mes" v={fmt(s.total)} />
          <Stat k="Ingresos papá" v={fmt(s.incomeTotal)} />
          <Stat k={s.excess >= 0 ? "Excedente" : "Sobrante"} v={fmt(Math.abs(s.excess))} />
          <Stat k="Cuota por hermano" v={fmt(s.share)} />
        </div>
        {s.excess < 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Los ingresos de papá cubren todos los gastos. El sobrante de {fmt(s.surplus)} queda guardado
            para papá por quien recibió los ingresos; nadie debe aportar este mes.
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Estado del excedente por hermano</h2>
          {s.settled && <span className="chip ok">Saldado ✓</span>}
        </div>
        <div className="people">
          {PEOPLE.map((p) => {
            const x = s.people[p.id];
            return (
              <div key={p.id} className={`person${p.id === user ? " me" : ""}`}>
                <div className="name">{p.name}<Status value={x.pending} withAmount /></div>
                <div className="line"><span>Pagó en gastos</span><b>{fmt(x.paid)}</b></div>
                {x.heldUsed > 0 && <div className="line"><span>Recibió ingresos papá</span><b>−{fmt(x.heldUsed)}</b></div>}
                <div className="line"><span>Su cuota</span><b>−{fmt(x.share)}</b></div>
                <div className="line total"><span>Saldo del mes</span><b>{fmt(x.net)}</b></div>
                {x.sent > 0 && <div className="line"><span>Transfirió</span><b>+{fmt(x.sent)}</b></div>}
                {x.received > 0 && <div className="line"><span>Le transfirieron</span><b>−{fmt(x.received)}</b></div>}
                <div className="line total"><span>Pendiente</span><b>{fmt(x.pending)}</b></div>
              </div>
            );
          })}
        </div>
        {mine.pending <= -EPS && (
          <details style={{ marginTop: 14 }} open>
            <summary>Registrar mi pago de este mes</summary>
            <TransferForm back={back} ym={ym} from={user} to={creditor} amount={Math.min(-mine.pending, Math.max(s.people[creditor].pending, 0)) || -mine.pending} date={today} />
          </details>
        )}
        {mine.pending >= EPS && (
          <details style={{ marginTop: 14 }}>
            <summary>Registrar un pago que recibí para este mes</summary>
            <TransferForm back={back} ym={ym} to={user} date={today} />
          </details>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Gastos</h2>
          <span className="muted small">{m.expenses.length} registro(s)</span>
        </div>
        <ul className="rows">
          {m.expenses.length === 0 && <li className="empty">Aún no hay gastos este mes.</li>}
          {m.expenses.map((e) =>
            String(e.id) === edit && open && canEdit(user, e) ? (
              <li key={e.id} style={{ display: "block" }}>
                <ExpenseForm back={back} ym={ym} user={user} expense={e} defaultDate={defaultDate} />
              </li>
            ) : (
              <li key={e.id}>
                <div className="grow">
                  <div className="title">
                    {e.concept} {e.recurring && <span className="chip ok">fijo</span>}
                  </div>
                  <div className="meta">
                    {e.date ? `${fmtDate(e.date)} · ` : ""}Pagó {personName(e.paid_by)}
                    {e.note ? ` · ${e.note}` : ""}
                    {e.created_by !== e.paid_by && e.created_by !== "sistema" ? ` · registró ${personName(e.created_by)}` : ""}
                  </div>
                </div>
                <div className="num">{fmt(e.amount)}</div>
                {open && canEdit(user, e) && (
                  <div className="acts">
                    <Link className="btn ghost sm" href={`${back}?edit=${e.id}`}>Editar</Link>
                    <ActionButton action={deleteExpense} fields={{ id: e.id, back }} label="×" className="btn ghost sm danger"
                      confirm={`¿Borrar "${e.concept}" (${fmt(e.amount)})?`} />
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
        {open && (
          <details style={{ marginTop: 12 }} open={m.expenses.length === 0 || undefined}>
            <summary>+ Agregar gasto</summary>
            <ExpenseForm back={back} ym={ym} user={user} defaultDate={defaultDate} />
          </details>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Ingresos de papá</h2>
          <span className="muted small">Depositan hasta el 20 de cada mes</span>
        </div>
        <ul className="rows">
          {m.incomes.length === 0 && <li className="empty">Sin ingresos registrados.</li>}
          {m.incomes.map((i) =>
            String(i.id) === editInc && open ? (
              <li key={i.id} style={{ display: "block" }}>
                <IncomeForm back={back} ym={ym} income={i} />
              </li>
            ) : (
              <li key={i.id}>
                <div className="grow">
                  <div className="title">{i.concept}</div>
                  <div className="meta">Lo recibe {personName(i.received_by)}</div>
                </div>
                <ActionButton
                  action={toggleIncomeReceived} fields={{ id: i.id, back }}
                  label={i.received ? "Recibido ✓" : "Por recibir"}
                  className={`chip ${i.received ? "due" : "open"}`}
                />
                <div className="num">{fmt(i.amount)}</div>
                {open && (
                  <div className="acts">
                    <Link className="btn ghost sm" href={`${back}?editInc=${i.id}`}>Editar</Link>
                    <ActionButton action={deleteIncome} fields={{ id: i.id, back }} label="×" className="btn ghost sm danger"
                      confirm={`¿Borrar el ingreso "${i.concept}"?`} />
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
        {open && (
          <details style={{ marginTop: 12 }}>
            <summary>+ Agregar ingreso (ej. décimo tercero)</summary>
            <IncomeForm back={back} ym={ym} />
          </details>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Transferencias de este mes</h2>
          <Link className="small muted" href="/pagos">Ver todas</Link>
        </div>
        <ul className="rows">
          {m.transfers.length === 0 && <li className="empty">Ninguna todavía.</li>}
          {m.transfers.map((t) => (
            <li key={t.id}>
              <div className="grow">
                <div className="title">{personName(t.from_person)} → {personName(t.to_person)}</div>
                <div className="meta">
                  {fmtDate(t.date)} · {t.confirmed ? "confirmada" : "sin confirmar"}{t.note ? ` · ${t.note}` : ""}
                </div>
              </div>
              <div className="num">{fmt(t.amount)}</div>
              {(user === ADMIN || user === t.created_by) && (
                <ActionButton action={deleteTransfer} fields={{ id: t.id, back }} label="×" className="btn ghost sm danger"
                  confirm="¿Borrar esta transferencia?" />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Notas del mes</h2>
        <form action={saveMonthNote} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="ym" value={ym} />
          <input type="hidden" name="back" value={back} />
          <textarea name="note" defaultValue={m.note ?? ""} placeholder="Acuerdos, aclaraciones…" />
          <div><button className="btn ghost sm">Guardar nota</button></div>
        </form>
      </section>

      <section className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>{open ? "Cerrar el mes" : "Mes cerrado"}</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {open
                ? "Al cerrar, ya no se pueden agregar ni editar gastos ni ingresos. Las transferencias se pueden seguir registrando."
                : "Solo Ricardo puede reabrirlo."}
            </p>
          </div>
          {open ? (
            <ActionButton action={setMonthStatus} fields={{ ym, status: "cerrado", back }} label="Cerrar mes"
              confirm={`¿Cerrar ${monthLabel(ym)}?`} />
          ) : user === ADMIN ? (
            <ActionButton action={setMonthStatus} fields={{ ym, status: "abierto", back }} label="Reabrir" />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function canEdit(user: PersonId, e: Expense) {
  return user === ADMIN || e.created_by === user || e.paid_by === user;
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="stat"><div className="k">{k}</div><div className="v">{v}</div></div>;
}

function ExpenseForm({
  back, ym, user, expense, defaultDate,
}: { back: string; ym: string; user: PersonId; expense?: Expense; defaultDate: string }) {
  return (
    <form action={saveExpense} className="form">
      <input type="hidden" name="ym" value={ym} />
      <input type="hidden" name="back" value={back} />
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <label className="f4">Concepto
        <input name="concept" defaultValue={expense?.concept} placeholder="Ej. tirillas, venlafaxina…" required autoFocus={!!expense} />
      </label>
      <label className="f2">Importe (USD)
        <input name="amount" inputMode="decimal" defaultValue={expense?.amount} placeholder="0.00" required />
      </label>
      <div className="f2"><PersonSelect name="paid_by" label="Pagó" value={expense?.paid_by ?? user} /></div>
      <label className="f2">Fecha
        <input type="date" name="date" defaultValue={expense ? expense.date ?? "" : defaultDate} />
      </label>
      <label className="f2">Nota
        <input name="note" defaultValue={expense?.note ?? ""} placeholder="Opcional" />
      </label>
      <label className="check f4">
        <input type="checkbox" name="recurring" defaultChecked={expense?.recurring} />
        Gasto fijo (se copia al abrir el mes siguiente, ej. asilo)
      </label>
      <div className="f2" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {expense && <Link className="btn ghost" href={back}>Cancelar</Link>}
        <button className="btn">{expense ? "Guardar" : "Agregar"}</button>
      </div>
    </form>
  );
}

function IncomeForm({ back, ym, income }: { back: string; ym: string; income?: Income }) {
  return (
    <form action={saveIncome} className="form">
      <input type="hidden" name="ym" value={ym} />
      <input type="hidden" name="back" value={back} />
      {income && <input type="hidden" name="id" value={income.id} />}
      <label className="f2">Concepto
        <input name="concept" defaultValue={income?.concept} placeholder="Ej. Décimo tercero" required />
      </label>
      <label className="f2">Importe (USD)
        <input name="amount" inputMode="decimal" defaultValue={income?.amount} required />
      </label>
      <div className="f2"><PersonSelect name="received_by" label="Lo recibe" value={income?.received_by ?? "ricardo"} /></div>
      <div className="f6" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {income && <Link className="btn ghost" href={back}>Cancelar</Link>}
        <button className="btn">{income ? "Guardar" : "Agregar"}</button>
      </div>
    </form>
  );
}
