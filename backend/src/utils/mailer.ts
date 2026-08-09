import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

export interface MailContent {
  subject: string;
  text: string;
  html?: string;
}

export interface MailPayload extends MailContent {
  to: string;
}

let cachedClient: Resend | null = null;

/**
 * El envío de mails es opcional: si no hay una API key de Resend configurada
 * la app sigue funcionando y el contenido se escribe en la consola del
 * servidor, para poder probar los flujos en desarrollo sin cuenta de Resend.
 */
export const isMailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY);

const getClient = (): Resend => {
  if (cachedClient) return cachedClient;
  cachedClient = new Resend(process.env.RESEND_API_KEY);
  return cachedClient;
};

const getFrom = (): string => process.env.MAIL_FROM || "TrickApp <no-reply@trick-app.com>";
const getReplyTo = (): string | undefined => process.env.MAIL_REPLY_TO || undefined;

export const sendMail = async ({ to, subject, text, html }: MailPayload): Promise<boolean> => {
  if (!isMailConfigured()) {
    console.warn(
      `[mailer] Resend no configurado. Mail no enviado a ${to}.\n` +
      `Asunto: ${subject}\n${text}`
    );
    return false;
  }

  try {
    const { error } = await getClient().emails.send({
      from: getFrom(),
      replyTo: getReplyTo(),
      to,
      subject,
      text,
      html
    });
    if (error) {
      console.error(`[mailer] Error enviando mail a ${to}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[mailer] Error enviando mail a ${to}:`, error);
    return false;
  }
};

const BATCH_CHUNK_SIZE = 100;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Envío masivo para fan-outs (torneo iniciado, resultados de partido, cierre
 * de torneo). Usa el endpoint de batch de Resend (hasta 100 destinatarios por
 * request) y nunca lanza: un chunk que falla simplemente no suma al total.
 * Devuelve la cantidad de mails efectivamente enviados.
 */
export const sendMailBatch = async (payloads: MailPayload[]): Promise<number> => {
  if (payloads.length === 0) return 0;

  if (!isMailConfigured()) {
    console.warn(`[mailer] Resend no configurado. ${payloads.length} mail(es) no enviados.`);
    return 0;
  }

  const client = getClient();
  const from = getFrom();
  const replyTo = getReplyTo();
  let sent = 0;

  for (const batch of chunk(payloads, BATCH_CHUNK_SIZE)) {
    try {
      const { data, error } = await client.batch.send(
        batch.map(({ to, subject, text, html }) => ({
          from,
          replyTo,
          to,
          subject,
          text,
          html
        }))
      );
      if (error) {
        console.error(`[mailer] Error enviando batch de ${batch.length} mail(es):`, error);
        continue;
      }
      sent += data?.data.length ?? batch.length;
    } catch (error) {
      console.error(`[mailer] Error enviando batch de ${batch.length} mail(es):`, error);
    }
  }

  return sent;
};
