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
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/trucoDB";
mongoose_1.default
    .connect(mongoURI)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch((err) => console.error("❌ Error conectando a MongoDB:", err));
// Rutas de autenticación
app.use("/api/auth", auth_routes_1.default);
// Ruta de prueba
app.get("/", (req, res) => {
    res.send("¡Servidor funcionando!");
});
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
