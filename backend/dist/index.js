"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const tournament_routes_1 = __importDefault(require("./routes/tournament.routes"));
const match_routes_1 = __importDefault(require("./routes/match.routes"));
const league_routes_1 = __importDefault(require("./routes/league.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:2701";
mongoose_1.default
    .connect(mongoURI)
    .then(() => console.log("Conectado a MongoDB"))
    .catch((err) => console.error("Error conectando a MongoDB:", err));
// Auth
app.use("/auth", auth_routes_1.default);
// Users
app.use("/users", user_routes_1.default);
// Test
app.get("/", (req, res) => {
    res.send("Servidor funcionando!");
});
//Tournament
app.use("/tournaments", tournament_routes_1.default);
app.use("/matches", match_routes_1.default);
app.use("/leagues", league_routes_1.default);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
