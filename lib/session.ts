// Sesión firmada con HMAC (funciona en proxy y en el servidor).
import { isPerson, type PersonId } from "./people";

export const COOKIE = "gp_session";
const MAX_AGE_DAYS = 60;
export const MAX_AGE = MAX_AGE_DAYS * 24 * 3600;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV !== "production") return "dev-secret-solo-local";
  throw new Error("Falta AUTH_SECRET");
}

const enc = new TextEncoder();

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createToken(user: PersonId): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const data = `${user}.${exp}`;
  return `${data}.${await sign(data)}`;
}

export async function verifyToken(token: string | undefined): Promise<PersonId | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [user, exp, sig] = parts;
  if (!isPerson(user) || Number(exp) < Date.now() / 1000) return null;
  const expected = await sign(`${user}.${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? user : null;
}

export function expectedPassword(user: PersonId): string | null {
  const v = process.env[`PASSWORD_${user.toUpperCase()}`];
  if (v) return v;
  return process.env.NODE_ENV !== "production" ? "demo" : null;
}
