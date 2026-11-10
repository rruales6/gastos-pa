# Gastos Papá

App web mínima para que Ricardo, Carlos y Víctor lleven, mes a mes, los gastos de papá.

## Cómo calcula

Por cada mes:

1. **Gastos del mes**: la suma de todo lo registrado (asilo, medicinas, citas…).
2. **Ingresos de papá**: jubilación ($409) y Erika ($120). Se pueden agregar otros (ej. décimo tercero).
3. **Excedente** = gastos − ingresos. Se divide entre 3 → **cuota por hermano**.
4. Para cada hermano: **saldo del mes** = lo que pagó de su bolsillo − ingresos de papá que recibió − su cuota.
   - Positivo → le deben devolver.
   - Negativo → debe aportar.
5. Las **transferencias** entre hermanos (asociadas a un mes o como abono general) van saldando esos montos.

Si los ingresos cubren todos los gastos, nadie aporta y el sobrante queda guardado para papá.
La cuota se redondea al centavo; el centavo que sobra lo absorbe Ricardo para que todo cuadre exacto.

El **Resumen** muestra el saldo acumulado de cada hermano (todos los meses + todas las transferencias)
y las transferencias sugeridas para quedar a mano.

## Funciones

- 3 usuarios (uno por hermano) con contraseña propia.
- Gastos por mes: concepto, importe, quién pagó, fecha, nota. Los marcados como **fijos** (ej. asilo)
  se copian solos al abrir el mes siguiente, junto con los ingresos.
- Ingresos de papá con marca "recibido / por recibir" (depositan hasta el 20).
- Estado del excedente por hermano en cada mes (al día / debe / le deben).
- Transferencias entre hermanos; quien recibe puede **confirmar** que le llegó.
- Cerrar mes (cualquiera); solo Ricardo puede reabrirlo.
- Historial de **actividad**: todo lo que se crea, edita o borra, con quién y cuándo.
- Permisos: un gasto lo puede editar quien lo registró, quien lo pagó o Ricardo.

## Desplegar en Vercel

1. Sube esta carpeta a un repositorio privado de GitHub (el `.gitignore` deja fuera el Excel).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio. Framework: Next.js (se detecta solo).
3. En el proyecto → **Storage → Create Database → Neon (Postgres)** → conéctala al proyecto.
   Esto agrega `DATABASE_URL` automáticamente.
4. En **Settings → Environment Variables** agrega:
   - `AUTH_SECRET`: una clave larga aleatoria (por ejemplo, la salida de `openssl rand -hex 32`).
   - `PASSWORD_RICARDO`, `PASSWORD_CARLOS`, `PASSWORD_VICTOR`: la contraseña de cada uno.
5. **Deployments → Redeploy** para que tome las variables.

Las tablas se crean solas en el primer uso, con noviembre 2026 abierto y los ingresos de jubilación y Erika cargados.

Para cambiar una contraseña: edita la variable en Vercel y vuelve a desplegar.

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Sin `DATABASE_URL` usa una base local en `.pglite/` y la contraseña de los tres es `demo`.
Para borrar los datos locales, elimina la carpeta `.pglite`.
