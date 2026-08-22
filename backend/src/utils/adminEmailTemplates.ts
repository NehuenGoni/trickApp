import { MailContent } from "./mailer";
import { Accent, infoRows, notice, paragraph } from "./emailComponents";
import { escapeHtml, layout } from "./emailTemplates";

const APP_NAME = "TrickApp";

/**
 * Contenido de una alerta interna al mail del dueño (`services/adminAlerts.ts`).
 * A diferencia de los templates de `emailTemplates.ts` (uno por evento de
 * usuario, cada uno con su copy pulido), acá hay un único constructor
 * genérico: el destinatario es siempre el dueño de la app, así que no hace
 * falta pulir cada evento por separado, y sumar un evento nuevo no cuesta un
 * template más.
 *
 * Ninguno de los campos de texto se escapa acá adentro para el caller — los
 * datos que arma cada `notifyAdminX` (username, mensajes de error de
 * terceros, etc.) tienen que pasar por `escapeHtml()` antes de construir este
 * objeto, exactamente igual que en el resto de los templates.
 */
export interface AdminAlertContent {
  /** Etiqueta corta en mayúsculas arriba del título (ej. "PAGO", "ERROR", "PLAN"). Ya debe venir escapada. */
  eyebrow: string;
  accent: Accent;
  /** Ya debe venir escapado. */
  title: string;
  /** Párrafo principal, HTML ya seguro (ya escapado si viene de datos dinámicos). */
  summaryHtml: string;
  rows?: Array<{ label: string; value: string }>;
  /** HTML ya seguro para el bloque de aviso con borde de acento (ej. detalle de un error). */
  noticeHtml?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  /**
   * Texto plano equivalente a `summaryHtml`, sin marcado. A diferencia de los
   * demás campos, viaja SIN escapar (así debe estar el `text` plano de todo
   * `MailContent`) — acá adentro se escapa aparte solo para el preheader
   * oculto del HTML, que sí es un contexto HTML.
   */
  summaryText: string;
}

/** Construye el mail de alerta interna. Sin `unsubscribeUrl`: es transaccional/interno. */
export const adminAlertEmail = (content: AdminAlertContent): MailContent => {
  const rowsText = (content.rows ?? []).map((r) => `${r.label}: ${r.value}`).join("\n");

  return {
    // Prefijo fijo para poder armar un filtro/etiqueta en el cliente de mail.
    subject: `[${APP_NAME}] ${content.title}`,
    text:
      `${content.summaryText}\n` +
      (rowsText ? `\n${rowsText}\n` : "") +
      (content.ctaUrl ? `\n${content.ctaUrl}` : ""),
    html: layout({
      preheader: escapeHtml(content.summaryText),
      eyebrow: content.eyebrow,
      accent: content.accent,
      title: content.title,
      bodyHtml:
        paragraph(content.summaryHtml) +
        (content.rows ? infoRows(content.rows) : "") +
        (content.noticeHtml ? notice(content.noticeHtml, content.accent) : ""),
      ctaUrl: content.ctaUrl,
      ctaLabel: content.ctaLabel
    })
  };
};
