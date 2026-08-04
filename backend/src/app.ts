import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import tournamentRoutes from "./routes/tournament.routes"
import matchRoutes from "./routes/match.routes"
import leagueRoutes from "./routes/league.routes"
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";

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

//Tournament
app.use("/tournaments", tournamentRoutes);
app.use("/matches", matchRoutes);
app.use("/leagues", leagueRoutes);

export default app;
