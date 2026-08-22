import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/**
 * Paso 1 (solo lectura) para importar el torneo histórico "Australian Open"
 * (grupo Hood, jugado el 20/02/2026 por fuera de la app — ver el plan
 * `tengo-los-datos-de-validated-octopus.md`).
 *
 * Busca en `users` de PRODUCCIÓN candidatos por similitud de `username` para
 * cada uno de los 24 jugadores del sheet, para que el dueño de la app
 * confirme a mano el mapping nombre → userId antes de escribir nada. No hay
 * campo "nombre real" en el modelo de User (solo username/email), así que el
 * match es una sugerencia, nunca una decisión automática.
 *
 * Uso: npx ts-node src/scripts/findAustralianOpenPlayerMatches.ts
 */

const PLAYER_NAMES = [
  "Tomas Yuste", "Rafael Aguilar", "Benjamin Terzolo",
  "Jose Bence Pieres", "Santiago Montenegro", "Felipe Videla",
  "Mateo Baldunciel", "Nicolas Mancini", "Ignacio Carrere",
  "Lucas Romanini", "Fermin Arena", "Ian Quelch",
  "Ezequiel Pires", "Salvador Dell Acqua", "Tomas Plorutti",
  "Estanislao Harismendy", "Facundo Caputo", "Matias Role",
  "Luca Magnasco", "Tobias Aguilar", "Lucas Pereyra Iraola",
  "Juan Cruz Tauber", "Luciano Sabato", "Fermin Fernandez Llanos"
];

/** Mismo criterio que `normalizeGuestName` en utils/leagueStandings.ts. */
const normalize = (s: string): string =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

const tokensOf = (name: string): string[] =>
  normalize(name).split(" ").filter((t) => t.length >= 3);

async function run() {
  const mongoURI = process.env.MONGO_URI_PROD;
  if (!mongoURI) {
    console.error("MONGO_URI_PROD no está definida en .env");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(mongoURI).asPromise();
  console.log(`Conectado (solo lectura) a: ${conn.name}\n`);

  try {
    const users = await conn
      .collection("users")
      .find({})
      .project({ username: 1, email: 1 })
      .toArray();

    const usersWithNorm = users.map((u) => ({
      _id: u._id,
      username: u.username as string,
      email: u.email as string,
      norm: normalize(u.username ?? "")
    }));

    let sinMatch = 0;
    for (const name of PLAYER_NAMES) {
      const tokens = tokensOf(name);
      const candidates = usersWithNorm.filter((u) =>
        tokens.some((t) => u.norm.includes(t))
      );

      console.log(`"${name}"`);
      if (candidates.length === 0) {
        console.log("  (sin candidatos — se cargaría como invitado)");
        sinMatch++;
      } else {
        for (const c of candidates) {
          console.log(`  - ${c._id}  username="${c.username}"  email=${c.email}`);
        }
      }
      console.log("");
    }

    console.log(`Total: ${PLAYER_NAMES.length} jugadores, ${sinMatch} sin ningún candidato sugerido.`);
    console.log("Revisar cada uno a mano: username parecido no implica que sea la persona correcta.");
  } finally {
    await conn.close();
  }
}

run().catch((err) => {
  console.error("Error buscando matches:", err);
  process.exit(1);
});
