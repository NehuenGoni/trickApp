"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
/** Cache del soporte de transacciones; se invalida al reconectar. */
let transactionSupport = null;
mongoose_1.default.connection.on("disconnected", () => {
    transactionSupport = null;
});
/**
 * Las transacciones de MongoDB solo existen en replica set o mongos. En un
 * `mongod` standalone (el fallback de desarrollo) fallan con IllegalOperation,
 * así que hay que preguntar antes de abrir una.
 */
const supportsTransactions = () => __awaiter(void 0, void 0, void 0, function* () {
    if (transactionSupport !== null)
        return transactionSupport;
    const db = mongoose_1.default.connection.db;
    if (!db)
        return false;
    try {
        const info = yield db.admin().command({ hello: 1 });
        transactionSupport = Boolean(info.setName) || info.msg === "isdbgrid";
    }
    catch (_a) {
        transactionSupport = false;
    }
    return transactionSupport;
});
/**
 * Ejecuta `fn` dentro de una transacción si el servidor la soporta y, si no,
 * la ejecuta tal cual sin sesión. Las operaciones de `fn` deben propagar la
 * sesión que reciben (`{ session }` en las opciones de cada query) para que la
 * atomicidad valga; con `undefined` se comportan como una query normal.
 */
const withTransaction = (fn) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield supportsTransactions())) {
        return fn(undefined);
    }
    const session = yield mongoose_1.default.startSession();
    try {
        let result;
        yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            result = yield fn(session);
        }));
        return result;
    }
    finally {
        yield session.endSession();
    }
});
exports.withTransaction = withTransaction;
