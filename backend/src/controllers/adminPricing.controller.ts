import { Request, Response } from "express";
import { getUsdToArs, setUsdToArs, MAX_USD_TO_ARS } from "../services/pricing";

interface AuthRequest extends Request {
  user?: string;
}

/** Panel de superadmin: consulta el tipo de cambio vigente para precargar el formulario. */
export const getAdminPricing = async (_req: Request, res: Response): Promise<void> => {
  try {
    const usdToArs = await getUsdToArs();
    res.status(200).json({ usdToArs });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener los precios", error: error.message });
  }
};

/** Actualiza el tipo de cambio usado en toda la app para mostrar precios en pesos. */
export const updateAdminPricing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { usdToArs } = req.body as { usdToArs?: number };

    if (typeof usdToArs !== "number" || !Number.isFinite(usdToArs) || usdToArs <= 0) {
      return void res.status(400).json({ message: "`usdToArs` debe ser un número mayor a 0" });
    }
    if (usdToArs > MAX_USD_TO_ARS) {
      return void res.status(400).json({ message: `\`usdToArs\` no puede superar ${MAX_USD_TO_ARS}` });
    }

    const value = await setUsdToArs(usdToArs, req.user!);
    res.status(200).json({ message: "Tipo de cambio actualizado", usdToArs: value });
  } catch (error: any) {
    res.status(500).json({ message: "Error al actualizar los precios", error: error.message });
  }
};
