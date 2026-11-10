import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, verifyToken } from "./session";
import type { PersonId } from "./people";

export async function currentUser(): Promise<PersonId | null> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

export async function requireUser(): Promise<PersonId> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
