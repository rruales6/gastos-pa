export const PEOPLE = [
  { id: "ricardo", name: "Ricardo" },
  { id: "carlos", name: "Carlos" },
  { id: "victor", name: "Víctor" },
] as const;

export type PersonId = (typeof PEOPLE)[number]["id"];

// Ricardo gestiona: puede cerrar/reabrir meses y editar cualquier registro.
export const ADMIN: PersonId = "ricardo";

export function isPerson(id: unknown): id is PersonId {
  return PEOPLE.some((p) => p.id === id);
}

export function personName(id: string): string {
  return PEOPLE.find((p) => p.id === id)?.name ?? id;
}
