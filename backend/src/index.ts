import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes";
import tournamentRoutes from "./routes/tournament.routes"
import matchRoutes from "./routes/match.routes"
import leagueRoutes from "./routes/league.routes"
import userRoutes from "./routes/user.routes";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:2701";
mongoose
  .connect(mongoURI)
  .then(() => console.log("Conectado a MongoDB"))
  .catch((err) => console.error("Error conectando a MongoDB:", err));

// Auth
app.use("/auth", authRoutes);

// Users
app.use("/users", userRoutes);

// Test
app.get("/", (req, res) => {
  res.send("Servidor funcionando!");
});

//Tournament
app.use("/tournaments", tournamentRoutes);
app.use("/matches", matchRoutes);
app.use("/leagues", leagueRoutes);

const PORT = process.env.PORT
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
