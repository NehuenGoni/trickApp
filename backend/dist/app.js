"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const tournament_routes_1 = __importDefault(require("./routes/tournament.routes"));
const match_routes_1 = __importDefault(require("./routes/match.routes"));
const league_routes_1 = __importDefault(require("./routes/league.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
/**
 * Construcción de la app de Express, separada de `index.ts` (que solo conecta
 * a Mongo y hace `listen`). La separación existe para poder testear con
 * `supertest` sin abrir un socket real ni depender de una conexión a Mongo
 * ya establecida en el momento del `import`.
 */
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Auth
app.use("/auth", auth_routes_1.default);
// Users
app.use("/users", user_routes_1.default);
// Panel de administración
app.use("/admin", admin_routes_1.default);
// Test
app.get("/", (req, res) => {
    res.send("Servidor funcionando!");
});
//Tournament
app.use("/tournaments", tournament_routes_1.default);
app.use("/matches", match_routes_1.default);
app.use("/leagues", league_routes_1.default);
exports.default = app;
