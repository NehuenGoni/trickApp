import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes";
import tournamentRoutes from "./routes/tournament.routes"
import matchRoutes from "./routes/match.routes"
import leagueRoutes from "./routes/league.routes"
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import billingRoutes from "./routes/billing.routes";

/**
 * Construcción de la app de Express, separada de `index.ts` (que solo conecta
 * a Mongo y hace `listen`). La separación existe para poder testear con
 * `supertest` sin abrir un socket real ni depender de una conexión a Mongo
 * ya establecida en el momento del `import`.
 */
const app = express();

app.use(express.json());
app.use(cors());

// Auth
app.use("/auth", authRoutes);

// Users
app.use("/users", userRoutes);

// Panel de administración
app.use("/admin", adminRoutes);

// Test
app.get("/", (req, res) => {
  res.send("Servidor funcionando!");
});

/**
 * Health check para el orquestador (Fly). Devuelve 200 siempre que el proceso
 * responda, con el estado de Mongo informativo en el body — deliberadamente
 * NO devuelve 503 si Mongo está caído: eso haría que Fly reinicie la máquina
 * en loop ante un blip transitorio de Atlas, empeorando la caída en vez de
 * ayudar a diagnosticarla.
 */
app.get("/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({ status: "ok", db: states[mongoose.connection.readyState] ?? "unknown" });
});

//Tournament
app.use("/tournaments", tournamentRoutes);
app.use("/matches", matchRoutes);
app.use("/leagues", leagueRoutes);
app.use("/billing", billingRoutes);

export default app;
