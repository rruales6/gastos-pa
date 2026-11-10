import { requireUser } from "@/lib/auth";
import { getActivity } from "@/lib/data";
import { personName } from "@/lib/people";
import { fmtDateTime } from "@/lib/format";
import { Header } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ActividadPage() {
  const user = await requireUser();
  const rows = await getActivity();
  return (
    <div className="wrap">
      <Header user={user} />
      <h1>Actividad</h1>
      <p className="sub">Todo lo que cada hermano registra, edita o borra queda aquí.</p>
      <section className="card">
        <ul className="rows">
          {rows.length === 0 && <li className="empty">Sin actividad todavía.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <div className="grow">
                <b>{personName(r.who)}</b> {r.action}
              </div>
              <span className="muted small num">{fmtDateTime(r.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
