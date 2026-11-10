import { addTransfer } from "@/app/actions";
import { PEOPLE } from "@/lib/people";
import { monthLabel } from "@/lib/format";

export function PersonSelect({ name, value, label }: { name: string; value?: string; label: string }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value ?? ""} required>
        <option value="" disabled>—</option>
        {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

/**
 * Registrar una transferencia entre hermanos.
 * Si se pasa `months`, se muestra un selector de mes (o "abono general"); si no, se usa `ym` fijo.
 */
export function TransferForm({
  back, ym, months, from, to, amount, date,
}: {
  back: string; ym?: string; months?: string[];
  from?: string; to?: string; amount?: number; date: string;
}) {
  return (
    <form action={addTransfer} className="form">
      <input type="hidden" name="back" value={back} />
      {!months && <input type="hidden" name="ym" value={ym ?? ""} />}
      <div className="f2"><PersonSelect name="from_person" label="Envía" value={from} /></div>
      <div className="f2"><PersonSelect name="to_person" label="Recibe" value={to} /></div>
      <label className="f2">Importe (USD)
        <input name="amount" inputMode="decimal" defaultValue={amount ? amount.toFixed(2) : ""} placeholder="0.00" required />
      </label>
      {months && (
        <label className="f2">Corresponde a
          <select name="ym" defaultValue={ym ?? ""}>
            <option value="">Abono general (sin mes)</option>
            {months.map((m) => <option key={m} value={m}>Excedente {monthLabel(m)}</option>)}
          </select>
        </label>
      )}
      <label className="f2">Fecha
        <input type="date" name="date" defaultValue={date} />
      </label>
      <label className={months ? "f2" : "f2"}>Nota
        <input name="note" placeholder="Opcional" />
      </label>
      <div className="f6" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn">Registrar transferencia</button>
      </div>
    </form>
  );
}
