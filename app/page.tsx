import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAll } from "@/lib/data";
import { EPS, globalBalances, statusText, suggestSettlement } from "@/lib/calc";
import { PEOPLE, personName } from "@/lib/people";
import { fmt, monthLabel, nextYm } from "@/lib/format";
import { openNextMonth } from "./actions";
import { Flash, Header, Status } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const { months, transfers } = await getAll();
  const balances = globalBalances(
    months.map((m) => Object.fromEntries(PEOPLE.map((p) => [p.id, m.summary.people[p.id].net])) as any),
    transfers,
  );
  const suggestions = suggestSettlement(balances);
  const next = months[0] ? nextYm(months[0].ym) : null;
  const pendingConfirm = transfers.filter((t) => t.to_person === user && !t.confirmed);

  return (
    <div className="wrap">
      <Header user={user} />
      <Flash error={error} />

      <h1>Saldos pendientes</h1>
      <p className="sub">Acumulado de todos los meses menos las transferencias entre hermanos.</p>

      <div className="people">
        {PEOPLE.map((p) => {
          const v = balances[p.id];
          const s = statusText(v);
          return (
            <div key={p.id} className={`person${p.id === user ? " me" : ""}`}>
              <div className="name">{p.name}<Status value={v} /></div>
              <div className={`big tone-${s.tone}`}>{fmt(Math.abs(v))}</div>
              <div className="muted small">
                {s.tone === "owe" ? "debe aportar" : s.tone === "due" ? "le deben devolver" : "sin pendientes"}
              </div>
            </div>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <section className="card">
          <h2>Para quedar a mano</h2>
          {suggestions.map((s, i) => (
            <div key={i} className="suggest">
              <span>
                <b>{personName(s.from)}</b> transfiere <b className="num">{fmt(s.amount)}</b> a <b>{personName(s.to)}</b>
              </span>
              {(user === s.from || user === s.to) && (
                <Link className="btn ghost sm" href={`/pagos?from=${s.from}&to=${s.to}&amount=${s.amount}`}>
                  Registrar
                </Link>
              )}
            </div>
          ))}
        </section>
      )}

      {pendingConfirm.length > 0 && (
        <div className="note">
          Tienes {pendingConfirm.length} transferencia(s) por confirmar. <Link href="/pagos">Revisar</Link>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Meses</h2>
          {next && (
            <form action={openNextMonth}>
              <button className="btn ghost sm">+ Abrir {monthLabel(next)}</button>
            </form>
          )}
        </div>
        <ul className="rows">
          {months.map((m) => {
            const s = m.summary;
            return (
              <li key={m.ym}>
                <Link href={`/mes/${m.ym}`} className="month-row">
                  <div className="grow">
                    <div className="title">
                      {monthLabel(m.ym)}{" "}
                      <span className={`chip ${m.status === "cerrado" ? "closed" : "open"}`}>
                        {m.status === "cerrado" ? "Cerrado" : "Abierto"}
                      </span>
                    </div>
                    <div className="meta">
                      Gastos {fmt(s.total)} · {s.excess >= 0 ? `Excedente ${fmt(s.excess)}` : `Sobrante ${fmt(-s.excess)}`}
                      {" "}· Cuota {fmt(s.share)}
                    </div>
                    <div className="badges">
                      {s.settled ? (
                        <span className="chip ok">Excedente saldado ✓</span>
                      ) : (
                        PEOPLE.filter((p) => Math.abs(s.people[p.id].pending) >= EPS).map((p) => (
                          <span key={p.id} className={`chip ${s.people[p.id].pending < 0 ? "owe" : "due"}`}>
                            {p.name}: {s.people[p.id].pending < 0 ? "debe" : "le deben"} {fmt(Math.abs(s.people[p.id].pending))}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <span className="muted">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
