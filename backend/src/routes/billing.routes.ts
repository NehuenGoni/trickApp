import express from "express";
import authMiddleware from "../middlewares/authMiddleware";
import {
  getMyBilling,
  getPricing,
  getMyBillingHistory,
  createCheckout,
  mercadoPagoWebhook,
  cancelMySubscription
} from "../controllers/billing.controller";

const router = express.Router();

router.get("/me", authMiddleware, getMyBilling);
router.get("/history", authMiddleware, getMyBillingHistory);
router.post("/checkout", authMiddleware, createCheckout);
router.post("/subscription/cancel", authMiddleware, cancelMySubscription);

// Sin authMiddleware a propósito: la página de precios es pública.
router.get("/pricing", getPricing);
// Sin authMiddleware a propósito: lo llama MercadoPago, no un usuario logueado.
// La firma `x-signature` (verificada dentro del controller) es la barrera de entrada.
router.post("/webhooks/mercadopago", mercadoPagoWebhook);

export default router;
