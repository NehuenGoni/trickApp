import express from "express";
import authMiddleware from "../middlewares/authMiddleware";
import {
  getMyBilling,
  getPricing,
  getMyBillingHistory,
  createCheckout,
  mercadoPagoWebhook,
  cancelMySubscription,
  syncMySubscription,
  reconcilePendingSubscriptionsCron
} from "../controllers/billing.controller";

const router = express.Router();

router.get("/me", authMiddleware, getMyBilling);
router.get("/history", authMiddleware, getMyBillingHistory);
router.post("/checkout", authMiddleware, createCheckout);
router.post("/subscription/cancel", authMiddleware, cancelMySubscription);
// Respaldo si el webhook de MercadoPago todavía no llegó (o no llega, como en sandbox).
router.post("/subscription/sync", authMiddleware, syncMySubscription);

// Sin authMiddleware a propósito: la página de precios es pública.
router.get("/pricing", getPricing);
// Sin authMiddleware a propósito: lo llama MercadoPago, no un usuario logueado.
// La firma `x-signature` (verificada dentro del controller) es la barrera de entrada.
router.post("/webhooks/mercadopago", mercadoPagoWebhook);
// Sin authMiddleware a propósito: lo llama un cron externo, no un usuario
// logueado. El secreto compartido (`x-cron-secret`) es la barrera de entrada.
router.post("/cron/reconcile-pending", reconcilePendingSubscriptionsCron);

export default router;
