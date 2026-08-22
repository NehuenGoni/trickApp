import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
// Solo se importa por su efecto de registrar el handler de fallo del mailer
// (`setMailFailureHandler`, ver `services/adminAlerts.ts`) antes de que
// cualquier request pueda disparar un envío.
import { reportCriticalError } from "./services/adminAlerts";

dotenv.config();

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:2701";
const PORT = process.env.PORT || 3000;

/**
 * Un `unhandledRejection` no tumba el proceso por sí solo en Node moderno,
 * pero un `uncaughtException` sí — y Fly lo reinicia en loop sin dejar
 * rastro visible más que el log. Estas dos líneas no cambian ese
 * comportamiento (no hay `process.exit` ni se traga el error): solo avisan
 * al mail interno antes de que la máquina se reinicie.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[process] Promesa sin manejar:", reason);
  reportCriticalError("proc:rejection", "Promesa sin manejar (unhandledRejection)", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[process] Excepción no capturada:", error);
  reportCriticalError("proc:exception", "Excepción no capturada (uncaughtException)", error);
});

/**
 * La conexión a Mongo se espera antes de escuchar (y aborta el proceso si
 * falla) para que un `MONGO_URI` mal seteado tumbe el deploy y dispare el
 * rollback automático de Fly, en vez de publicar una versión que arranca
 * "verde" pero sirve 500s en cada request a la DB.
 */
mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("Conectado a MongoDB");
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error conectando a MongoDB:", err);
    process.exit(1);
  });
