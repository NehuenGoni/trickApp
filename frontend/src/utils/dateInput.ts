/**
 * Conversión ISO <-> `datetime-local` en hora LOCAL del navegador.
 *
 * El bug que esto resuelve: `new Date(iso).toISOString().slice(0, 16)` arma
 * un string en UTC, pero el input `datetime-local` interpreta ese literal
 * como hora LOCAL. Guardarlo de vuelta con `new Date(value).toISOString()`
 * lo vuelve a convertir local→UTC, así que cada ciclo de "abrir editor,
 * guardar sin tocar la fecha" corre el horario por el offset del huso
 * horario del usuario (+3h en Argentina). Estas dos funciones son el único
 * punto por el que debe pasar cualquier `<input type="datetime-local">` que
 * lea o escriba un `startDate` de torneo/liga.
 */

/** ISO -> `YYYY-MM-DDTHH:mm` en hora local, para el `value` del input. */
export const toDateTimeLocalInput = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/** Valor de un `datetime-local` (hora local) -> ISO, para mandar al backend. */
export const fromDateTimeLocalInput = (value: string): string => {
  const date = new Date(value);
  return date.toISOString();
};
