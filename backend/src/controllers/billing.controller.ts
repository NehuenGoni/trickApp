import { Request, Response } from "express";
import { getUsage, UsageSummary } from "../services/billing";

interface AuthRequest extends Request {
  user?: string;
}

/**
 * `JSON.stringify` convierte `Infinity` en `null` en silencio — acá lo
 * hacemos explícito para que el frontend sepa que `null` en un límite
 * significa "sin tope" y no "dato faltante".
 */
const serializeUsage = (usage: UsageSummary) => ({
  ...usage,
  limits: Object.fromEntries(
    Object.entries(usage.limits).map(([key, value]) => [key, value === Infinity ? null : value])
  )
});

/** El propio usuario consulta su plan, uso del período y vencimiento. */
export const getMyBilling = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usage = await getUsage(req.user!);
    res.status(200).json(serializeUsage(usage));
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener el estado de tu plan", error: error.message });
  }
};
