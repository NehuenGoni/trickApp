import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/**
 * Levanta un replica set en memoria, NO un `MongoMemoryServer` standalone.
 *
 * `withTransaction` (`src/utils/withTransaction.ts`) detecta soporte
 * transaccional preguntando `hello.setName`: un standalone no tiene ese
 * campo, así que con `MongoMemoryServer` todos los `withTransaction` de la
 * app tomarían silenciosamente la rama "sin sesión" y los tests no
 * ejercitarían el camino real de producción (que sí corre contra un replica
 * set de Atlas). Con un solo nodo (`count: 1`) ya alcanza para tener
 * transacciones reales y arranca rápido.
 */
let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
