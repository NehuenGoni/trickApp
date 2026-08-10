import { MailContent } from "./mailer";

const APP_NAME = "TrickApp";
const BRAND_BG = "#1e1e1e";
const BRAND_ACCENT = "#FFD700";

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

interface LayoutParams {
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
  unsubscribeUrl?: string;
}

/**
 * Wrapper HTML compartido por todas las plantillas. Mantiene el estilo ya
 * establecido por los mails de reset de contraseña (fondo oscuro, acento
 * dorado). `bodyHtml` ya debe venir escapado por el caller cuando incluye
 * datos de usuario.
 */
export const layout = ({ title, bodyHtml, ctaUrl, ctaLabel, footerNote, unsubscribeUrl }: LayoutParams): string => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:${BRAND_BG};color:#f5f5f5;border-radius:12px">
    <h2 style="color:${BRAND_ACCENT};margin:0 0 16px">${title}</h2>
    ${bodyHtml}
    ${ctaUrl && ctaLabel ? `
    <p style="margin:24px 0;text-align:center">
      <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND_ACCENT};color:${BRAND_BG};text-decoration:none;font-weight:bold;border-radius:8px">
        ${ctaLabel}
      </a>
    </p>` : ""}
    ${footerNote ? `<p style="margin:0 0 12px;font-size:13px;color:#bdbdbd">${footerNote}</p>` : ""}
    ${unsubscribeUrl ? `
    <p style="margin:24px 0 0;font-size:12px;color:#8a8a8a">
      Si no querés recibir este tipo de aviso, <a href="${unsubscribeUrl}" style="color:#8a8a8a">dejá de recibirlo acá</a>.
    </p>` : ""}
  </div>
`;

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
      title: "Restablecer tu contraseña",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 20px">Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${APP_NAME}.</p>
      `,
      ctaUrl: resetUrl,
      ctaLabel: "Elegir nueva contraseña",
      footerNote:
        `El enlace vence en ${ttlMinutes} minutos y solo puede usarse una vez. ` +
        `Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue siendo válida.<br /><br />` +
        `Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br />${resetUrl}`
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
      title: "Contraseña actualizada",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">La contraseña de tu cuenta fue actualizada y se cerraron las sesiones abiertas.</p>
      `,
      footerNote: "Si no fuiste vos, restablecé tu contraseña de inmediato o contactá a un administrador."
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
      title: "Confirmá tu cuenta",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 20px">Gracias por registrarte en ${APP_NAME}. Confirmá tu dirección de email para poder crear torneos y suscribirte a un plan.</p>
      `,
      ctaUrl: verifyUrl,
      ctaLabel: "Confirmar mi cuenta",
      footerNote:
        `El enlace vence en ${ttlHours} horas. Si no creaste esta cuenta, podés ignorar este mensaje.<br /><br />` +
        `Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br />${verifyUrl}`
    })
  };
};

export const paymentApprovedEmail = (username: string, plan: string, currentPeriodEnd: Date | null): MailContent => {
  const safeName = escapeHtml(username);
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
      title: "Pago confirmado",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">Confirmamos tu pago del plan <strong>${escapeHtml(plan)}</strong>.</p>
        ${untilText ? `<p style="margin:0 0 12px">${untilText}</p>` : ""}
      `,
      footerNote: `Gracias por tu apoyo a ${APP_NAME}.`
    })
  };
};

export const paymentRejectedEmail = (username: string, plan: string, billingUrl: string): MailContent => {
  const safeName = escapeHtml(username);
  return {
    subject: `${APP_NAME} - No pudimos procesar tu pago`,
    text:
      `Hola ${username},\n\n` +
      `No pudimos procesar el cobro de tu plan ${plan}. Tu suscripción quedó marcada como pendiente de pago.\n` +
      `Actualizá tu medio de pago para evitar interrupciones:\n\n${billingUrl}`,
    html: layout({
      title: "No pudimos procesar tu pago",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">No pudimos procesar el cobro de tu plan <strong>${escapeHtml(plan)}</strong>. Tu suscripción quedó marcada como pendiente de pago.</p>
      `,
      ctaUrl: billingUrl,
      ctaLabel: "Actualizar medio de pago"
    })
  };
};

export const subscriptionCanceledEmail = (username: string, plan: string, currentPeriodEnd: Date | null): MailContent => {
  const safeName = escapeHtml(username);
  const untilText = currentPeriodEnd
    ? `Seguís teniendo acceso al plan ${plan} hasta el ${currentPeriodEnd.toLocaleDateString("es-AR")}.`
    : `Tu acceso al plan ${plan} se dio de baja.`;
  return {
    subject: `${APP_NAME} - Cancelaste tu renovación`,
    text: `Hola ${username},\n\nConfirmamos que cancelaste la renovación automática de tu plan ${plan}. ${untilText}`,
    html: layout({
      title: "Cancelaste tu renovación",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">Confirmamos que cancelaste la renovación automática de tu plan <strong>${escapeHtml(plan)}</strong>.</p>
        <p style="margin:0 0 12px">${escapeHtml(untilText)}</p>
      `
    })
  };
};

export const subscriptionGrantedEmail = (username: string, plan: string, currentPeriodEnd: Date | null): MailContent => {
  const safeName = escapeHtml(username);
  const untilText = currentPeriodEnd
    ? `Tu plan ${plan} está activo hasta el ${currentPeriodEnd.toLocaleDateString("es-AR")}.`
    : `Tu plan ${plan} está activo.`;
  return {
    subject: `${APP_NAME} - Tu plan fue activado`,
    text: `Hola ${username},\n\n${untilText}`,
    html: layout({
      title: "Tu plan fue activado",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">${escapeHtml(untilText)}</p>
      `
    })
  };
};

export const expiryReminderEmail = (username: string, plan: string, currentPeriodEnd: Date, billingUrl: string): MailContent => {
  const safeName = escapeHtml(username);
  const dateText = currentPeriodEnd.toLocaleDateString("es-AR");
  return {
    subject: `${APP_NAME} - Tu plan vence pronto`,
    text:
      `Hola ${username},\n\n` +
      `Tu plan ${plan} vence el ${dateText}. Renovalo para seguir disfrutando sin cortes:\n\n${billingUrl}`,
    html: layout({
      title: "Tu plan vence pronto",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">Tu plan <strong>${escapeHtml(plan)}</strong> vence el <strong>${dateText}</strong>.</p>
      `,
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
      title: "Sos organizador de una liga",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">Te agregaron como organizador de la liga <strong>${safeLeague}</strong>.</p>
      `,
      ctaUrl: leagueUrl,
      ctaLabel: "Ver la liga"
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
      title: "Inscripción confirmada",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">Confirmamos tu inscripción al torneo <strong>${safeTournament}</strong>.</p>
      `,
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
  const teammatesText = teammates.length > 0 ? `Jugás con ${teammates.map(escapeHtml).join(", ")}.` : "";
  const opponentText = opponent ? `Tu primer rival es <strong>${escapeHtml(opponent)}</strong>.` : "Todavía no tenés rival asignado.";
  return {
    subject: `${APP_NAME} - Arrancó ${tournamentName}`,
    text:
      `Hola ${username},\n\n` +
      `El torneo "${tournamentName}" arrancó. ${teammates.length > 0 ? `Jugás con ${teammates.join(", ")}. ` : ""}` +
      `${opponent ? `Tu primer rival es ${opponent}.` : "Todavía no tenés rival asignado."}\n\n${tournamentUrl}`,
    html: layout({
      title: "¡Arrancó el torneo!",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">El torneo <strong>${safeTournament}</strong> arrancó.</p>
        ${teammatesText ? `<p style="margin:0 0 12px">${teammatesText}</p>` : ""}
        <p style="margin:0 0 12px">${opponentText}</p>
      `,
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
      title: resultText,
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">${resultText} en <strong>${safeTournament}</strong>.</p>
        ${continuationText ? `<p style="margin:0 0 12px">${continuationText}</p>` : ""}
      `,
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
      title: "¡Terminó el torneo!",
      bodyHtml: `
        <p style="margin:0 0 12px">Hola <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px">El torneo <strong>${safeTournament}</strong> terminó.</p>
        <p style="margin:0 0 12px">Quedaste en la posición <strong>${position}</strong> y sumaste <strong>${points}</strong> puntos.</p>
      `,
      ctaUrl: tournamentUrl,
      ctaLabel: "Ver resultados",
      unsubscribeUrl
    })
  };
};
