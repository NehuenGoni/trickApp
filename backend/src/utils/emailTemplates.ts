import { MailContent } from "./mailer";
import { Accent, ACCENT_CONTRAST, ACCENT_HEX, COLORS, chips, infoRows, notice, paragraph, statCards, versusBlock } from "./emailComponents";

const APP_NAME = "TrickApp";

/**
 * Escapa los caracteres que tienen significado especial en HTML. Se usa
 * sobre cualquier dato provisto por el usuario (username, nombre de torneo,
 * nombre de liga, etc.) antes de interpolarlo en una plantilla: sin esto,
 * alguien podía registrarse con un username tipo `<img src=x onerror=...>`
 * y ejecutar HTML/JS arbitrario en el cliente de mail de otra persona.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const frontendBase = (): string =>
  (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

/** URL pública del logo mostrado en el header del mail. Ver `.env.example`. */
const getLogoUrl = (): string =>
  process.env.MAIL_LOGO_URL || "https://trick-app.com/logo192.png";

interface LayoutParams {
  /** Texto que los clientes de mail muestran al lado del asunto en la bandeja de entrada. */
  preheader: string;
  /** Etiqueta corta en mayúsculas arriba del título (ej. "SEGURIDAD", "TORNEO"). */
  eyebrow: string;
  /** Color de marca de la familia de mail: colorea la hairline, el título y el CTA. */
  accent: Accent;
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
  unsubscribeUrl?: string;
}

/**
 * Wrapper HTML compartido por todas las plantillas. Es un documento
 * completo (no un `<div>` suelto) armado con tablas `role="presentation"`
 * porque Outlook de escritorio (motor Word) no soporta flexbox/grid ni la
 * mayoría del CSS moderno; los `bgcolor` en los `<td>` son el fallback para
 * los clientes que ni siquiera aplican `background-color` inline.
 *
 * `meta[name=color-scheme]` fijado en "light" evita que Apple Mail/Outlook
 * en modo oscuro reprocesen la tarjeta ya oscura y rompan el contraste.
 *
 * `bodyHtml` y `footerNote` ya deben venir como HTML seguro armado por el
 * caller (con `escapeHtml()` aplicado a todo dato de usuario) — este
 * wrapper no escapa nada.
 */
export const layout = ({
  preheader,
  eyebrow,
  accent,
  title,
  bodyHtml,
  ctaUrl,
  ctaLabel,
  footerNote,
  unsubscribeUrl
}: LayoutParams): string => {
  const accentHex = ACCENT_HEX[accent];
  const accentContrast = ACCENT_CONTRAST[accent];
  const logoUrl = getLogoUrl();
  const prefsUrl = `${frontendBase()}/profile?tab=notifications`;

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${APP_NAME}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td { font-family: 'Montserrat', Arial, Helvetica, sans-serif; }
  @media (max-width: 600px) {
    .email-card { width: 100% !important; }
    .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.PAGE_BG};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.PAGE_BG}" style="background-color:${COLORS.PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-radius:14px;overflow:hidden;">
          <tr>
            <td bgcolor="${COLORS.HEADER_BG}" class="email-pad" style="background-color:${COLORS.HEADER_BG};padding:20px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;">
                    <img src="${logoUrl}" width="32" height="32" alt="${APP_NAME}" style="display:block;border-radius:8px;" />
                  </td>
                  <td style="font-family:'Merriweather',Georgia,serif;font-size:18px;font-weight:700;letter-spacing:1px;color:${COLORS.GOLD};">
                    TRICKAPP
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${accentHex}" style="background-color:${accentHex};line-height:3px;font-size:3px;">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.CARD_BG}" class="email-pad" style="background-color:${COLORS.CARD_BG};padding:32px;">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:${accentHex};text-transform:uppercase;">${eyebrow}</p>
              <h1 style="margin:0 0 20px;font-family:'Merriweather',Georgia,serif;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.TEXT};">${title}</h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.TEXT_MUTED};">
                ${bodyHtml}
              </div>
              ${
                ctaUrl && ctaLabel
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px;">
                <tr>
                  <td bgcolor="${accentHex}" style="background-color:${accentHex};border-radius:10px;">
                    <a href="${ctaUrl}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${accentContrast};text-decoration:none;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>`
                  : ""
              }
              ${
                footerNote
                  ? `<div style="margin-top:24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${COLORS.TEXT_FAINT};">${footerNote}</div>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.FOOTER_BG}" class="email-pad" style="background-color:${COLORS.FOOTER_BG};padding:20px 32px;border-top:1px solid ${COLORS.BORDER};">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.TEXT_FAINT};">
                ${APP_NAME} &middot; torneos de truco<br />
                <a href="${prefsUrl}" style="color:${COLORS.TEXT_FAINT};">Preferencias de notificación</a>${
                  unsubscribeUrl
                    ? ` &middot; <a href="${unsubscribeUrl}" style="color:${COLORS.TEXT_FAINT};">Dejar de recibir este aviso</a>`
                    : ""
                }
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const passwordResetEmail = (username: string, resetUrl: string, ttlMinutes: number): MailContent => {
  const safeName = escapeHtml(username);
  return {
    subject: `${APP_NAME} - Restablecer tu contraseña`,
    text:
      `Hola ${username},\n\n` +
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n` +
      `Abrí este enlace para elegir una nueva contraseña:\n\n${resetUrl}\n\n` +
      `El enlace vence en ${ttlMinutes} minutos y solo puede usarse una vez.\n` +
      `Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue siendo válida.`,
    html: layout({
      preheader: `Restablecé tu contraseña de ${APP_NAME}. El enlace vence en ${ttlMinutes} minutos.`,
      eyebrow: "Seguridad",
      accent: "gold",
      title: "Restablecer tu contraseña",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${APP_NAME}.`),
      ctaUrl: resetUrl,
      ctaLabel: "Elegir nueva contraseña",
      footerNote: notice(
        `El enlace vence en ${ttlMinutes} minutos y solo puede usarse una vez. ` +
          `Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue siendo válida.<br /><br />` +
          `Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br />${resetUrl}`,
        "red"
      )
    })
  };
};

export const passwordChangedEmail = (username: string): MailContent => {
  const safeName = escapeHtml(username);
  return {
    subject: `${APP_NAME} - Tu contraseña fue actualizada`,
    text:
      `Hola ${username},\n\n` +
      `Te confirmamos que la contraseña de tu cuenta fue actualizada y se cerraron las sesiones abiertas.\n` +
      `Si no fuiste vos, restablecé tu contraseña de inmediato o contactá a un administrador.`,
    html: layout({
      preheader: "Tu contraseña fue actualizada y se cerraron las sesiones abiertas.",
      eyebrow: "Seguridad",
      accent: "gold",
      title: "Contraseña actualizada",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph("La contraseña de tu cuenta fue actualizada y se cerraron las sesiones abiertas."),
      footerNote: notice("Si no fuiste vos, restablecé tu contraseña de inmediato o contactá a un administrador.", "red")
    })
  };
};

export const emailVerificationEmail = (username: string, verifyUrl: string, ttlHours: number): MailContent => {
  const safeName = escapeHtml(username);
  return {
    subject: `${APP_NAME} - Confirmá tu cuenta`,
    text:
      `Hola ${username},\n\n` +
      `Gracias por registrarte en ${APP_NAME}. Confirmá tu dirección de email para poder crear torneos y suscribirte a un plan:\n\n${verifyUrl}\n\n` +
      `El enlace vence en ${ttlHours} horas.\n` +
      `Si no creaste esta cuenta, podés ignorar este mensaje.`,
    html: layout({
      preheader: `Confirmá tu cuenta de ${APP_NAME} para poder crear torneos y suscribirte a un plan.`,
      eyebrow: "Seguridad",
      accent: "gold",
      title: "Confirmá tu cuenta",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Gracias por registrarte en ${APP_NAME}. Confirmá tu dirección de email para poder crear torneos y suscribirte a un plan.`),
      ctaUrl: verifyUrl,
      ctaLabel: "Confirmar mi cuenta",
      footerNote: notice(
        `El enlace vence en ${ttlHours} horas. Si no creaste esta cuenta, podés ignorar este mensaje.<br /><br />` +
          `Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br />${verifyUrl}`,
        "gold"
      )
    })
  };
};

export const paymentApprovedEmail = (username: string, plan: string, currentPeriodEnd: Date | null): MailContent => {
  const safeName = escapeHtml(username);
  const safePlan = escapeHtml(plan);
  const untilText = currentPeriodEnd
    ? `Tu período está activo hasta el ${currentPeriodEnd.toLocaleDateString("es-AR")}.`
    : "";
  return {
    subject: `${APP_NAME} - Pago confirmado`,
    text:
      `Hola ${username},\n\n` +
      `Confirmamos tu pago del plan ${plan}. ${untilText}\n\n` +
      `Gracias por tu apoyo a ${APP_NAME}.`,
    html: layout({
      preheader: `Confirmamos tu pago del plan ${safePlan}.`,
      eyebrow: "Tu plan",
      accent: "gold",
      title: "Pago confirmado",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Confirmamos tu pago del plan <strong>${safePlan}</strong>. ¡Gracias por tu apoyo a ${APP_NAME}!`) +
        infoRows([
          { label: "Plan", value: safePlan },
          ...(currentPeriodEnd ? [{ label: "Activo hasta", value: currentPeriodEnd.toLocaleDateString("es-AR") }] : [])
        ])
    })
  };
};

export const paymentRejectedEmail = (username: string, plan: string, billingUrl: string): MailContent => {
  const safeName = escapeHtml(username);
  const safePlan = escapeHtml(plan);
  return {
    subject: `${APP_NAME} - No pudimos procesar tu pago`,
    text:
      `Hola ${username},\n\n` +
      `No pudimos procesar el cobro de tu plan ${plan}. Tu suscripción quedó marcada como pendiente de pago.\n` +
      `Actualizá tu medio de pago para evitar interrupciones:\n\n${billingUrl}`,
    html: layout({
      preheader: `No pudimos procesar el cobro de tu plan ${safePlan}. Actualizá tu medio de pago.`,
      eyebrow: "Tu plan",
      accent: "red",
      title: "No pudimos procesar tu pago",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(
          `No pudimos procesar el cobro de tu plan <strong>${safePlan}</strong>. Tu suscripción quedó marcada como pendiente de pago.`
        ),
      ctaUrl: billingUrl,
      ctaLabel: "Actualizar medio de pago"
    })
  };
};

export const subscriptionCanceledEmail = (username: string, plan: string, currentPeriodEnd: Date | null): MailContent => {
  const safeName = escapeHtml(username);
  const safePlan = escapeHtml(plan);
  const untilText = currentPeriodEnd
    ? `Seguís teniendo acceso al plan ${plan} hasta el ${currentPeriodEnd.toLocaleDateString("es-AR")}.`
    : `Tu acceso al plan ${plan} se dio de baja.`;
  return {
    subject: `${APP_NAME} - Cancelaste tu renovación`,
    text: `Hola ${username},\n\nConfirmamos que cancelaste la renovación automática de tu plan ${plan}. ${untilText}`,
    html: layout({
      preheader: `Cancelaste la renovación automática de tu plan ${safePlan}.`,
      eyebrow: "Tu plan",
      accent: "red",
      title: "Cancelaste tu renovación",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Confirmamos que cancelaste la renovación automática de tu plan <strong>${safePlan}</strong>.`) +
        infoRows([
          { label: "Plan", value: safePlan },
          {
            label: currentPeriodEnd ? "Acceso hasta" : "Estado",
            value: currentPeriodEnd ? currentPeriodEnd.toLocaleDateString("es-AR") : "Dado de baja"
          }
        ])
    })
  };
};

export const subscriptionGrantedEmail = (username: string, plan: string, currentPeriodEnd: Date | null): MailContent => {
  const safeName = escapeHtml(username);
  const safePlan = escapeHtml(plan);
  const untilText = currentPeriodEnd
    ? `Tu plan ${plan} está activo hasta el ${currentPeriodEnd.toLocaleDateString("es-AR")}.`
    : `Tu plan ${plan} está activo.`;
  return {
    subject: `${APP_NAME} - Tu plan fue activado`,
    text: `Hola ${username},\n\n${untilText}`,
    html: layout({
      preheader: currentPeriodEnd
        ? `Tu plan ${safePlan} está activo hasta el ${currentPeriodEnd.toLocaleDateString("es-AR")}.`
        : `Tu plan ${safePlan} está activo.`,
      eyebrow: "Tu plan",
      accent: "gold",
      title: "Tu plan fue activado",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Tu plan <strong>${safePlan}</strong> ya está activo. ¡A disfrutarlo!`) +
        infoRows([
          { label: "Plan", value: safePlan },
          { label: "Estado", value: currentPeriodEnd ? `Activo hasta ${currentPeriodEnd.toLocaleDateString("es-AR")}` : "Activo" }
        ])
    })
  };
};

export const expiryReminderEmail = (username: string, plan: string, currentPeriodEnd: Date, billingUrl: string): MailContent => {
  const safeName = escapeHtml(username);
  const safePlan = escapeHtml(plan);
  const dateText = currentPeriodEnd.toLocaleDateString("es-AR");
  return {
    subject: `${APP_NAME} - Tu plan vence pronto`,
    text:
      `Hola ${username},\n\n` +
      `Tu plan ${plan} vence el ${dateText}. Renovalo para seguir disfrutando sin cortes:\n\n${billingUrl}`,
    html: layout({
      preheader: `Tu plan ${safePlan} vence el ${dateText}. Renovalo para seguir disfrutando sin cortes.`,
      eyebrow: "Tu plan",
      accent: "red",
      title: "Tu plan vence pronto",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Tu plan <strong>${safePlan}</strong> vence pronto. Renovalo para seguir disfrutando sin cortes.`) +
        infoRows([
          { label: "Plan", value: safePlan },
          { label: "Vence el", value: dateText }
        ]),
      ctaUrl: billingUrl,
      ctaLabel: "Renovar mi plan"
    })
  };
};

export const organizerAddedEmail = (username: string, leagueName: string, leagueUrl: string): MailContent => {
  const safeName = escapeHtml(username);
  const safeLeague = escapeHtml(leagueName);
  return {
    subject: `${APP_NAME} - Sos organizador de ${leagueName}`,
    text: `Hola ${username},\n\nTe agregaron como organizador de la liga "${leagueName}".\n\n${leagueUrl}`,
    html: layout({
      preheader: `Te agregaron como organizador de la liga ${safeLeague}.`,
      eyebrow: "Liga",
      accent: "blue",
      title: "Sos organizador de una liga",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Te agregaron como organizador de la liga <strong>${safeLeague}</strong>.`),
      ctaUrl: leagueUrl,
      ctaLabel: "Ver la liga"
    })
  };
};

/**
 * Al dueño de una liga, cuando alguien no pudo anotarse porque se llegó al
 * cupo de jugadores del plan. Solo se dispara cuando el que rebota NO es el
 * propio dueño (si fue él, ya vio el error en pantalla) — ver
 * `services/leagueCapGate.ts`.
 */
export const leagueCapReachedEmail = (
  username: string,
  leagueName: string,
  current: number,
  limit: number,
  planLabel: string,
  leagueUrl: string,
  plansUrl: string,
  unsubscribeUrl: string
): MailContent => {
  const safeName = escapeHtml(username);
  const safeLeague = escapeHtml(leagueName);
  const safePlan = escapeHtml(planLabel);
  return {
    subject: `${APP_NAME} - Tu liga "${leagueName}" llegó al cupo de jugadores`,
    text:
      `Hola ${username},\n\n` +
      `Alguien intentó anotarse en tu liga "${leagueName}" pero no pudo: ya tenés ${current} de ${limit} jugadores, ` +
      `el cupo de tu plan ${planLabel}.\n\n` +
      `Pasate a un plan superior para seguir sumando gente:\n${plansUrl}\n\n` +
      `Ver la liga: ${leagueUrl}`,
    html: layout({
      preheader: `Ya tenés ${current} de ${limit} jugadores en "${leagueName}" — el cupo de tu plan ${planLabel}.`,
      eyebrow: "Liga",
      accent: "gold",
      title: "Tu liga llegó al cupo de jugadores",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(
          `Alguien intentó anotarse en tu liga <strong>${safeLeague}</strong> pero no pudo: ya tenés ` +
          `<strong>${current} de ${limit}</strong> jugadores, el cupo de tu plan <strong>${safePlan}</strong>.`
        ) +
        notice(`Pasate a un plan superior para destrabar el resto de los cupos, o <a href="${leagueUrl}" style="color:${COLORS.TEXT_MUTED};">gestioná la liga</a>.`),
      ctaUrl: plansUrl,
      ctaLabel: "Ver planes",
      unsubscribeUrl
    })
  };
};

export const tournamentSignupConfirmedEmail = (username: string, tournamentName: string, tournamentUrl: string, unsubscribeUrl: string): MailContent => {
  const safeName = escapeHtml(username);
  const safeTournament = escapeHtml(tournamentName);
  return {
    subject: `${APP_NAME} - Te inscribiste en ${tournamentName}`,
    text: `Hola ${username},\n\nConfirmamos tu inscripción al torneo "${tournamentName}".\n\n${tournamentUrl}`,
    html: layout({
      preheader: `Confirmamos tu inscripción al torneo ${safeTournament}.`,
      eyebrow: "Torneo",
      accent: "blue",
      title: "Inscripción confirmada",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`Confirmamos tu inscripción al torneo <strong>${safeTournament}</strong>.`),
      ctaUrl: tournamentUrl,
      ctaLabel: "Ver el torneo",
      unsubscribeUrl
    })
  };
};

export const tournamentStartedEmail = (
  username: string,
  tournamentName: string,
  teammates: string[],
  opponent: string | null,
  tournamentUrl: string,
  unsubscribeUrl: string
): MailContent => {
  const safeName = escapeHtml(username);
  const safeTournament = escapeHtml(tournamentName);
  const safeTeammates = teammates.map(escapeHtml);
  const safeOpponent = opponent ? escapeHtml(opponent) : null;
  return {
    subject: `${APP_NAME} - Arrancó ${tournamentName}`,
    text:
      `Hola ${username},\n\n` +
      `El torneo "${tournamentName}" arrancó. ${teammates.length > 0 ? `Jugás con ${teammates.join(", ")}. ` : ""}` +
      `${opponent ? `Tu primer rival es ${opponent}.` : "Todavía no tenés rival asignado."}\n\n${tournamentUrl}`,
    html: layout({
      preheader: `El torneo ${safeTournament} arrancó.`,
      eyebrow: "Torneo",
      accent: "blue",
      title: "¡Arrancó el torneo!",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`El torneo <strong>${safeTournament}</strong> arrancó.`) +
        (safeTeammates.length > 0 ? paragraph("Jugás en equipo con:") + chips(safeTeammates) : "") +
        versusBlock(safeName, safeOpponent ?? "Por confirmar"),
      ctaUrl: tournamentUrl,
      ctaLabel: "Ver el torneo",
      unsubscribeUrl
    })
  };
};

export const matchResultEmail = (
  username: string,
  tournamentName: string,
  won: boolean,
  nextPhaseLabel: string | null,
  finalPosition: number | null,
  tournamentUrl: string,
  unsubscribeUrl: string
): MailContent => {
  const safeName = escapeHtml(username);
  const safeTournament = escapeHtml(tournamentName);
  const resultText = won ? "Ganaste tu partido" : "Perdiste tu partido";
  const continuationText = nextPhaseLabel
    ? `Seguís en pie: tu próximo cruce es en <strong>${escapeHtml(nextPhaseLabel)}</strong>.`
    : finalPosition
      ? `Terminaste el torneo en la posición <strong>${finalPosition}</strong>.`
      : "";
  return {
    subject: `${APP_NAME} - ${resultText} en ${tournamentName}`,
    text:
      `Hola ${username},\n\n` +
      `${resultText} en "${tournamentName}". ` +
      `${nextPhaseLabel ? `Seguís en pie: tu próximo cruce es en ${nextPhaseLabel}.` : finalPosition ? `Terminaste el torneo en la posición ${finalPosition}.` : ""}\n\n${tournamentUrl}`,
    html: layout({
      preheader: `${resultText} en ${safeTournament}.`,
      eyebrow: "Resultado",
      accent: won ? "gold" : "red",
      title: resultText,
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`${resultText} en <strong>${safeTournament}</strong>.`) +
        (continuationText ? notice(continuationText, won ? "gold" : "blue") : ""),
      ctaUrl: tournamentUrl,
      ctaLabel: "Ver el torneo",
      unsubscribeUrl
    })
  };
};

export const tournamentClosedEmail = (
  username: string,
  tournamentName: string,
  position: number,
  points: number,
  tournamentUrl: string,
  unsubscribeUrl: string
): MailContent => {
  const safeName = escapeHtml(username);
  const safeTournament = escapeHtml(tournamentName);
  return {
    subject: `${APP_NAME} - Terminó ${tournamentName}`,
    text:
      `Hola ${username},\n\n` +
      `El torneo "${tournamentName}" terminó. Quedaste en la posición ${position} y sumaste ${points} puntos.\n\n${tournamentUrl}`,
    html: layout({
      preheader: `El torneo ${safeTournament} terminó. Quedaste en la posición ${position}.`,
      eyebrow: "Torneo",
      accent: "blue",
      title: "¡Terminó el torneo!",
      bodyHtml:
        paragraph(`Hola <strong>${safeName}</strong>,`) +
        paragraph(`El torneo <strong>${safeTournament}</strong> terminó.`) +
        statCards([
          { label: "Posición", value: `${position}º` },
          { label: "Puntos", value: `${points}` }
        ]),
      ctaUrl: tournamentUrl,
      ctaLabel: "Ver resultados",
      unsubscribeUrl
    })
  };
};
