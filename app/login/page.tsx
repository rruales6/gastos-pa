import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { PEOPLE } from "@/lib/people";
import { Flash } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; u?: string }> }) {
  if (await currentUser()) redirect("/");
  const { error, u } = await searchParams;
  return (
    <main className="login">
      <h1>Gastos Papá</h1>
      <p className="sub" style={{ textAlign: "center" }}>¿Quién eres?</p>
      <Flash error={error} />
      <form action={login} className="card" style={{ display: "grid", gap: 14 }}>
        <div className="who-pick">
          {PEOPLE.map((p) => (
            <div key={p.id}>
              <input type="radio" name="user" id={`u-${p.id}`} value={p.id} defaultChecked={u === p.id} required />
              <label htmlFor={`u-${p.id}`}>{p.name}</label>
            </div>
          ))}
        </div>
        <label>
          Contraseña
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn">Entrar</button>
      </form>
    </main>
  );
}
