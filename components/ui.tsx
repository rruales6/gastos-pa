import Link from "next/link";
import { logout } from "@/app/actions";
import { personName } from "@/lib/people";
import { statusText } from "@/lib/calc";
import { fmt } from "@/lib/format";
import ConfirmButton from "./ConfirmButton";

export function Header({ user }: { user: string }) {
  return (
    <header className="top">
      <Link href="/" className="brand">Gastos Papá</Link>
      <nav className="nav">
        <Link href="/">Resumen</Link>
        <Link href="/pagos">Pagos</Link>
        <Link href="/actividad">Actividad</Link>
      </nav>
      <div className="who">
        <span>{personName(user)}</span>
        <form action={logout}><button className="linkbtn">Salir</button></form>
      </div>
    </header>
  );
}

export function Flash({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="flash" role="alert">{error}</div>;
}

export function Status({ value, withAmount = false }: { value: number; withAmount?: boolean }) {
  const s = statusText(value);
  return (
    <span className={`chip ${s.tone}`}>
      {s.label}{withAmount && s.tone !== "ok" ? ` ${fmt(Math.abs(value))}` : ""}
    </span>
  );
}

/** Formulario de un solo botón para acciones (borrar, confirmar…). */
export function ActionButton({
  action, fields, label, className = "btn ghost sm", confirm,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string | number>;
  label: string;
  className?: string;
  confirm?: string;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirm ? <ConfirmButton className={className} message={confirm}>{label}</ConfirmButton>
        : <button className={className}>{label}</button>}
    </form>
  );
}
