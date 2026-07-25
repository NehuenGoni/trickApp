import nodemailer, { Transporter } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

interface MailContent {
  subject: string;
  text: string;
  html?: string;
}

interface MailPayload extends MailContent {
  to: string;
}

let cachedTransporter: Transporter | null = null;

/**
 * El envío de mails es opcional: si no hay credenciales SMTP configuradas la app
 * sigue funcionando y el contenido se escribe en la consola del servidor, para
 * poder probar el flujo de recuperación de contraseña en desarrollo.
 */
export const isMailConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = (): Transporter => {
  if (cachedTransporter) return cachedTransporter;

  const port = parseInt(process.env.SMTP_PORT || "587", 10);

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // El puerto 465 usa TLS implícito; 587 y 25 usan STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return cachedTransporter;
};

export const sendMail = async ({ to, subject, text, html }: MailPayload): Promise<boolean> => {
  if (!isMailConfigured()) {
    console.warn(
      `[mailer] SMTP no configurado. Mail no enviado a ${to}.\n` +
      `Asunto: ${subject}\n${text}`
    );
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });
    return true;
  } catch (error) {
    console.error(`[mailer] Error enviando mail a ${to}:`, error);
    return false;
  }
};

const APP_NAME = "TrickApp";

export const passwordResetEmail = (username: string, resetUrl: string, ttlMinutes: number): MailContent => ({
  subject: `${APP_NAME} - Restablecer tu contraseña`,
  text:
    `Hola ${username},\n\n` +
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n` +
    `Abrí este enlace para elegir una nueva contraseña:\n\n${resetUrl}\n\n` +
    `El enlace vence en ${ttlMinutes} minutos y solo puede usarse una vez.\n` +
    `Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue siendo válida.`,
  html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#1e1e1e;color:#f5f5f5;border-radius:12px">
      <h2 style="color:#FFD700;margin:0 0 16px">Restablecer tu contraseña</h2>
      <p style="margin:0 0 12px">Hola <strong>${username}</strong>,</p>
      <p style="margin:0 0 20px">Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${APP_NAME}.</p>
      <p style="margin:0 0 24px;text-align:center">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#FFD700;color:#1e1e1e;text-decoration:none;font-weight:bold;border-radius:8px">
          Elegir nueva contraseña
        </a>
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#bdbdbd">
        El enlace vence en ${ttlMinutes} minutos y solo puede usarse una vez.
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#bdbdbd">
        Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue siendo válida.
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#8a8a8a;word-break:break-all">
        Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br />${resetUrl}
      </p>
    </div>
  `
});

export const passwordChangedEmail = (username: string): MailContent => ({
  subject: `${APP_NAME} - Tu contraseña fue actualizada`,
  text:
    `Hola ${username},\n\n` +
    `Te confirmamos que la contraseña de tu cuenta fue actualizada y se cerraron las sesiones abiertas.\n` +
    `Si no fuiste vos, restablecé tu contraseña de inmediato o contactá a un administrador.`,
  html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#1e1e1e;color:#f5f5f5;border-radius:12px">
      <h2 style="color:#FFD700;margin:0 0 16px">Contraseña actualizada</h2>
      <p style="margin:0 0 12px">Hola <strong>${username}</strong>,</p>
      <p style="margin:0 0 12px">La contraseña de tu cuenta fue actualizada y se cerraron las sesiones abiertas.</p>
      <p style="margin:0;font-size:13px;color:#bdbdbd">
        Si no fuiste vos, restablecé tu contraseña de inmediato o contactá a un administrador.
      </p>
    </div>
  `
});
