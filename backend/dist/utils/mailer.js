"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordChangedEmail = exports.passwordResetEmail = exports.sendMail = exports.isMailConfigured = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let cachedTransporter = null;
/**
 * El envío de mails es opcional: si no hay credenciales SMTP configuradas la app
 * sigue funcionando y el contenido se escribe en la consola del servidor, para
 * poder probar el flujo de recuperación de contraseña en desarrollo.
 */
const isMailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
exports.isMailConfigured = isMailConfigured;
const getTransporter = () => {
    if (cachedTransporter)
        return cachedTransporter;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    cachedTransporter = nodemailer_1.default.createTransport({
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
const sendMail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, subject, text, html }) {
    if (!(0, exports.isMailConfigured)()) {
        console.warn(`[mailer] SMTP no configurado. Mail no enviado a ${to}.\n` +
            `Asunto: ${subject}\n${text}`);
        return false;
    }
    try {
        yield getTransporter().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html
        });
        return true;
    }
    catch (error) {
        console.error(`[mailer] Error enviando mail a ${to}:`, error);
        return false;
    }
});
exports.sendMail = sendMail;
const APP_NAME = "TrickApp";
const passwordResetEmail = (username, resetUrl, ttlMinutes) => ({
    subject: `${APP_NAME} - Restablecer tu contraseña`,
    text: `Hola ${username},\n\n` +
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
exports.passwordResetEmail = passwordResetEmail;
const passwordChangedEmail = (username) => ({
    subject: `${APP_NAME} - Tu contraseña fue actualizada`,
    text: `Hola ${username},\n\n` +
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
exports.passwordChangedEmail = passwordChangedEmail;
