import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAll } from "@/lib/data";
import { ADMIN, isPerson, personName } from "@/lib/people";
import { fmt, fmtDate, monthLabel, todayIso } from "@/lib/format";
import { confirmTransfer, deleteTransfer } from "@/app/actions";
import { ActionButton, Flash, Header } from "@/components/ui";
import { TransferForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function PagosPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; from?: string; to?: string; amount?: string; ym?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { months, transfers } = await getAll();
  const amount = Number(sp.amount) > 0 ? Number(sp.amount) : undefined;
  // Por defecto, el mes abierto más antiguo con pendientes; si no, el más reciente.
  const defaultYm = sp.ym ?? (amount ? "" : [...months].reverse().find((m) => !m.summary.settled)?.ym ?? months[0]?.ym);

  return (
    <div className="wrap">
      <Header user={user} />
      <Flash error={sp.error} />
      <h1>Pagos entre hermanos</h1>
      <p className="sub">
        Transferencias para cubrir el excedente. Quien recibe puede confirmar que le llegó el dinero.
      </p>

      <section className="card">
        <h2>Registrar transferencia</h2>
        <TransferForm
          back="/pagos"
          months={months.map((m) => m.ym)}
          ym={defaultYm}
          from={isPerson(sp.from) ? sp.from : user}
          to={isPerson(sp.to) ? sp.to : undefined}
          amount={amount}
          date={todayIso()}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Historial</h2>
          <span className="muted small">{transfers.length} transferencia(s)</span>
        </div>
        <ul className="rows">
          {transfers.length === 0 && <li className="empty">Aún no hay transferencias.</li>}
          {transfers.map((t) => (
            <li key={t.id}>
              <div className="grow">
                <div className="title">
                  {personName(t.from_person)} → {personName(t.to_person)}
                </div>
                <div className="meta">
                  {fmtDate(t.date)} ·{" "}
                  {t.ym ? <Link href={`/mes/${t.ym}`}>excedente {monthLabel(t.ym)}</Link> : "abono general"}
                  {t.note ? ` · ${t.note}` : ""} · registró {personName(t.created_by)}
                </div>
              </div>
              <div className="num">{fmt(t.amount)}</div>
              {t.confirmed ? (
                <span className="chip due">Confirmada</span>
              ) : user === t.to_person ? (
                <ActionButton action={confirmTransfer} fields={{ id: t.id, back: "/pagos" }} label="Confirmar recibido" className="btn sm" />
              ) : (
                <span className="chip open">Sin confirmar</span>
              )}
              {(user === ADMIN || user === t.created_by) && (
                <ActionButton action={deleteTransfer} fields={{ id: t.id, back: "/pagos" }} label="×"
                  className="btn ghost sm danger" confirm="¿Borrar esta transferencia?" />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
