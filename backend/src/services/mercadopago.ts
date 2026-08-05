import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const MP_API_BASE = "https://api.mercadopago.com";

export type PreapprovalStatus = "pending" | "authorized" | "paused" | "cancelled";

export interface Preapproval {
  id: string;
  status: PreapprovalStatus;
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: "months";
    transaction_amount: number;
    currency_id: string;
  };
}

export type AuthorizedPaymentStatus = "scheduled" | "processed" | "recycled" | "cancelled";

export interface AuthorizedPayment {
  id: number;
  status: AuthorizedPaymentStatus;
  payment?: { id: number; status: string };
  preapproval_id: string;
  transaction_amount: number;
}

/**
 * La integración es opcional: sin credenciales configuradas la app sigue
 * andando con el flujo manual existente (mismo patrón que `isMailConfigured`
 * en `utils/mailer.ts`). El checkout y el webhook consultan esto antes de
 * hacer cualquier llamada a la API de MercadoPago.
 */
export const isMercadoPagoEnabled = (): boolean =>
  Boolean(process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET);

class MercadoPagoError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN no está configurado");

  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new MercadoPagoError(`MercadoPago respondió ${res.status} en ${path}`, res.status, body);
  }
  return body as T;
};

export interface CreatePreapprovalParams {
  reason: string;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
  frequency: number; // meses (1, 3 o 12 según el intervalo)
  transactionAmount: number; // ARS
}

/**
 * Crea una suscripción "con pago pendiente": sin `card_token_id`, MP
 * devuelve un `init_point` al que hay que redirigir al usuario para que
 * elija el medio de pago. Queda en `status: "pending"` hasta que lo
 * autorice — recién ahí llega el webhook `subscription_preapproval` con
 * `authorized`.
 */
export const createPreapproval = async (params: CreatePreapprovalParams): Promise<Preapproval> =>
  request<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: params.reason,
      external_reference: params.externalReference,
      payer_email: params.payerEmail,
      back_url: params.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: params.frequency,
        frequency_type: "months",
        transaction_amount: params.transactionAmount,
        currency_id: "ARS"
      }
    })
  });

export const getPreapproval = async (id: string): Promise<Preapproval> =>
  request<Preapproval>(`/preapproval/${id}`, { method: "GET" });

export const updatePreapprovalStatus = async (
  id: string,
  status: "paused" | "cancelled"
): Promise<Preapproval> =>
  request<Preapproval>(`/preapproval/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });

export const getAuthorizedPayment = async (id: string | number): Promise<AuthorizedPayment> =>
  request<AuthorizedPayment>(`/authorized_payments/${id}`, { method: "GET" });

/**
 * Valida la firma `x-signature` de un webhook de MercadoPago. El manifest
 * (`id:...;request-id:...;ts:...;`) se firma con HMAC-SHA256 usando el
 * secreto configurado en el panel de MP; comparación en tiempo constante
 * para no filtrar el secreto por timing.
 *
 * Referencia: https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
 */
export const verifyWebhookSignature = (params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
}): boolean => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !params.xSignature || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(",").map((part) => {
      const [key, value] = part.split("=").map((s) => s.trim());
      return [key, value];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId ?? ""};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
};

export { MercadoPagoError };
