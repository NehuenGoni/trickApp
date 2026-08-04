import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Subscription from "../models/Subscription";
import Payment from "../models/Payment";
import { PLAN_IDS, isValidPlanId } from "../config/plans";
import { grantSubscriptionPeriod, changePlan, resolveBilling } from "../services/billing";

interface AuthRequest extends Request {
  user?: string;
}

const isValidInterval = (value: unknown): value is "monthly" | "quarterly" | "yearly" =>
  value === "monthly" || value === "quarterly" || value === "yearly";

/** Panel de superadmin: quién paga qué, para poder cobrar por transferencia y activar a mano. */
export const listSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const search = (req.query.search as string)?.trim();
    const plan = req.query.plan as string | undefined;

    const filter: Record<string, unknown> = {};
    if (plan && isValidPlanId(plan)) filter["billing.plan"] = plan;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { username: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } }
      ];
    }
    // Solo interesa a este panel quien alguna vez tuvo o tiene algo que pagar:
    // deja afuera a la masa de usuarios en `free` que nunca se acercó a un plan.
    if (!plan) filter["billing.plan"] = { $ne: "free" };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("username email billing")
        .sort({ "billing.currentPeriodEnd": -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const withEffectiveStatus = users.map((u) => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      billing: u.billing,
      isActive: resolveBilling(u.billing).isActive
    }));

    res.status(200).json({
      users: withEffectiveStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al listar suscripciones", error: error.message });
  }
};

/** Historial de pagos y períodos de un usuario puntual, para auditar antes de activar de nuevo. */
export const getUserBillingHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }
    const user = await User.findById(id).select("username email billing");
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const [subscriptions, payments] = await Promise.all([
      Subscription.find({ userId: id }).sort({ createdAt: -1 }),
      Payment.find({ userId: id }).sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      user,
      isActive: resolveBilling(user.billing).isActive,
      subscriptions,
      payments
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener el historial", error: error.message });
  }
};

/**
 * Activa o extiende N meses de un plan pago para un usuario — el flujo real
 * hoy es: el bar transfiere, y el superadmin viene acá a acreditárselo.
 */
export const grantUserSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { plan, interval, months, amount } = req.body as {
      plan?: string;
      interval?: string;
      months?: number;
      amount?: number;
    };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }
    if (!isValidPlanId(plan) || plan === "free") {
      return void res.status(400).json({
        message: `Plan inválido (${PLAN_IDS.filter((p) => p !== "free").join(" | ")})`
      });
    }
    if (!isValidInterval(interval)) {
      return void res.status(400).json({ message: "Intervalo inválido (monthly | quarterly | yearly)" });
    }
    if (typeof months !== "number" || !Number.isInteger(months) || months <= 0) {
      return void res.status(400).json({ message: "`months` debe ser un entero mayor a 0" });
    }
    if (amount !== undefined && (typeof amount !== "number" || amount < 0)) {
      return void res.status(400).json({ message: "`amount` debe ser un número mayor o igual a 0" });
    }

    const user = await User.findById(id).select("username");
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { subscription, payment } = await grantSubscriptionPeriod({
      userId: id,
      plan,
      interval,
      months,
      activatedBy: req.user!,
      amount: amount ?? 0
    });

    res.status(200).json({
      message: `Suscripción de ${user.username} activada: ${plan} hasta ${subscription.currentPeriodEnd.toLocaleDateString("es-AR")}.`,
      subscription,
      payment
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al activar la suscripción", error: error.message });
  }
};

/** Cambia el plan sin tocar el período vigente (upgrade/downgrade) o cancela bajando a `free`. */
export const updateUserPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { plan } = req.body as { plan?: string };

    if (!mongoose.isValidObjectId(id)) {
      return void res.status(400).json({ message: "ID de usuario inválido" });
    }
    if (!isValidPlanId(plan)) {
      return void res.status(400).json({ message: `Plan inválido (${PLAN_IDS.join(" | ")})` });
    }

    const user = await User.findById(id).select("username");
    if (!user) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    await changePlan(id, plan);
    const updated = await User.findById(id).select("billing");

    res.status(200).json({
      message: `Plan de ${user.username} actualizado a ${plan}.`,
      billing: updated!.billing
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al cambiar el plan", error: error.message });
  }
};
