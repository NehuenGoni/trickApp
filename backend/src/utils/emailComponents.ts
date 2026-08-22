/**
 * Primitivas de bloque para armar el cuerpo de los emails (`bodyHtml` en
 * `layout()`, ver `emailTemplates.ts`). Todo devuelve HTML de tabla porque
 * los clientes de mail más restrictivos (Outlook de escritorio, motor Word)
 * no soportan flexbox/grid ni la mayoría de las propiedades modernas de CSS.
 *
 * Ninguna de estas funciones escapa datos de usuario: reciben HTML ya
 * armado, así que todo dato dinámico (username, nombre de torneo/liga, etc.)
 * tiene que pasar por `escapeHtml()` en el caller (`emailTemplates.ts`)
 * *antes* de llegar acá. Es la misma regla que ya regía para `bodyHtml` en
 * el `layout()` original.
 */

export type Accent = "gold" | "red" | "blue";

export const COLORS = {
  PAGE_BG: "#EFEDE7",
  CARD_BG: "#16232E",
  HEADER_BG: "#0D1B2A",
  FOOTER_BG: "#101B24",
  BORDER: "#2A3B49",
  TEXT: "#F8F9FA",
  TEXT_MUTED: "#CED4DA",
  TEXT_FAINT: "#8A99A8",
  GOLD: "#FFD700",
  GOLD_DARK: "#FFC400",
  RED: "#B22222",
  BLUE: "#2B6CB0"
} as const;

export const ACCENT_HEX: Record<Accent, string> = {
  gold: COLORS.GOLD,
  red: COLORS.RED,
  blue: COLORS.BLUE
};

// Color de texto sobre el fondo de acento (CTA, etc). El dorado es claro,
// necesita texto negro; rojo y azul son oscuros, necesitan texto blanco.
export const ACCENT_CONTRAST: Record<Accent, string> = {
  gold: "#000000",
  red: "#FFFFFF",
  blue: "#FFFFFF"
};

/** Párrafo de texto estándar dentro del cuerpo del mail. */
export const paragraph = (html: string): string =>
  `<p style="margin:0 0 12px;">${html}</p>`;

/**
 * Tarjetas de estadística lado a lado (ej. "POSICIÓN 2º" / "PUNTOS 45" al
 * cerrar un torneo). `items.length` define el ancho de cada tarjeta.
 */
export const statCards = (items: Array<{ label: string; value: string }>): string => {
  if (items.length === 0) return "";
  const width = Math.floor(100 / items.length);
  const cells = items
    .map(
      (item, i) => `
      <td width="${width}%" valign="top" style="padding:${i === 0 ? "0" : "0 0 0 12px"};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.FOOTER_BG};border:1px solid ${COLORS.BORDER};border-radius:10px;">
          <tr>
            <td align="center" style="padding:16px 8px;">
              <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;color:${COLORS.TEXT_FAINT};text-transform:uppercase;">${item.label}</p>
              <p style="margin:0;font-family:'Merriweather',Georgia,serif;font-size:24px;font-weight:700;color:${COLORS.GOLD};">${item.value}</p>
            </td>
          </tr>
        </table>
      </td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr>${cells}</tr></table>`;
};

/** Bloque "VOS vs Rival" para el cruce inicial de un torneo. */
export const versusBlock = (you: string, opponent: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;background-color:${COLORS.FOOTER_BG};border:1px solid ${COLORS.BORDER};border-radius:10px;">
    <tr>
      <td align="center" width="42%" style="padding:16px 12px;">
        <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:${COLORS.TEXT_FAINT};text-transform:uppercase;">Vos</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${COLORS.TEXT};">${you}</p>
      </td>
      <td align="center" width="16%" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${COLORS.TEXT_FAINT};">VS</td>
      <td align="center" width="42%" style="padding:16px 12px;">
        <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:${COLORS.TEXT_FAINT};text-transform:uppercase;">Rival</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${COLORS.TEXT};">${opponent}</p>
      </td>
    </tr>
  </table>`;

/** Filas label/valor (ej. Plan · Vence el · Estado) en una tarjeta con fondo propio. */
export const infoRows = (rows: Array<{ label: string; value: string }>): string => {
  if (rows.length === 0) return "";
  const trs = rows
    .map(
      (row, i) => `
        <tr>
          <td style="padding:${i === 0 ? "0" : "10px"} 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.TEXT_FAINT};">${row.label}</td>
          <td align="right" style="padding:${i === 0 ? "0" : "10px"} 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${COLORS.TEXT};">${row.value}</td>
        </tr>`
    )
    .join("");
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;background-color:${COLORS.FOOTER_BG};border:1px solid ${COLORS.BORDER};border-radius:10px;">
    <tr>
      <td style="padding:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs}</table>
      </td>
    </tr>
  </table>`;
};

/** Caja con borde de acento a la izquierda, para avisos de seguridad ("si no fuiste vos..."). */
export const notice = (html: string, accent: Accent = "gold"): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
    <tr>
      <td style="border-left:3px solid ${ACCENT_HEX[accent]};background-color:${COLORS.FOOTER_BG};padding:12px 16px;border-radius:0 8px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${COLORS.TEXT_MUTED};">
        ${html}
      </td>
    </tr>
  </table>`;

/** Lista de nombres como píldoras (ej. compañeros de equipo). */
export const chips = (names: string[]): string => {
  if (names.length === 0) return "";
  const items = names
    .map(
      (name) => `
      <td style="padding:0 6px 6px 0;">
        <span style="display:inline-block;padding:5px 12px;background-color:${COLORS.FOOTER_BG};border:1px solid ${COLORS.BORDER};border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:${COLORS.TEXT};">${name}</span>
      </td>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr>${items}</tr></table>`;
};
