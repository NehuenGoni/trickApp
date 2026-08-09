import { Request, Response, NextFunction } from "express";

/**
 * Exige que el usuario haya confirmado su email. Debe montarse siempre
 * después de `authMiddleware`, que es quien resuelve `req.authUser`.
 *
 * Responde 403 con `reason: "email_not_verified"` (mismo espíritu que el 402
 * de `BillingGateError` en `tournament.controller.ts`) para que el frontend
 * pueda distinguir este caso de un 403 genérico y mostrar el CTA de reenvío
 * en vez de un mensaje de error plano.
 */
const requireVerifiedEmail = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.authUser) {
    res.status(401).json({ message: "Acceso no autorizado" });
    return;
  }

  if (!req.authUser.emailVerified) {
    res.status(403).json({
      message: "Confirmá tu email para poder hacer esto.",
      reason: "email_not_verified"
    });
    return;
  }

  next();
};

export default requireVerifiedEmail;
