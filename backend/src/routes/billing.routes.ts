import express from "express";
import authMiddleware from "../middlewares/authMiddleware";
import { getMyBilling } from "../controllers/billing.controller";

const router = express.Router();

router.get("/me", authMiddleware, getMyBilling);

export default router;
