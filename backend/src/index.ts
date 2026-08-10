import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";

dotenv.config();

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:2701";
const PORT = process.env.PORT || 3000;

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
