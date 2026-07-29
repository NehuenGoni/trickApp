import mongoose, { ClientSession } from "mongoose";

/** Cache del soporte de transacciones; se invalida al reconectar. */
let transactionSupport: boolean | null = null;

mongoose.connection.on("disconnected", () => {
  transactionSupport = null;
});

/**
 * Las transacciones de MongoDB solo existen en replica set o mongos. En un
 * `mongod` standalone (el fallback de desarrollo) fallan con IllegalOperation,
 * así que hay que preguntar antes de abrir una.
 */
const supportsTransactions = async (): Promise<boolean> => {
  if (transactionSupport !== null) return transactionSupport;

  const db = mongoose.connection.db;
  if (!db) return false;

  try {
    const info = await db.admin().command({ hello: 1 });
    transactionSupport = Boolean(info.setName) || info.msg === "isdbgrid";
  } catch {
    transactionSupport = false;
  }

  return transactionSupport;
};

/**
 * Ejecuta `fn` dentro de una transacción si el servidor la soporta y, si no,
 * la ejecuta tal cual sin sesión. Las operaciones de `fn` deben propagar la
 * sesión que reciben (`{ session }` en las opciones de cada query) para que la
 * atomicidad valga; con `undefined` se comportan como una query normal.
 */
export const withTransaction = async <T>(
  fn: (session?: ClientSession) => Promise<T>
): Promise<T> => {
  if (!(await supportsTransactions())) {
    return fn(undefined);
  }

  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
};
