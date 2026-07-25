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
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const constants_1 = require("../config/constants");
const pointsAdjustmentSchema = new mongoose_1.default.Schema({
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    adjustedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    adjustedAt: { type: Date, default: Date.now }
}, { _id: false });
const userSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    totalPoints: { type: Number, default: 0, min: 0 },
    role: {
        type: String,
        enum: Object.values(constants_1.ROLES),
        default: constants_1.ROLES.USER
    },
    passwordChangedAt: { type: Date },
    pointsAdjustments: { type: [pointsAdjustmentSchema], default: [] },
}, { timestamps: true });
userSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = this;
        if (!user.isModified("password"))
            return next();
        user.password = yield bcryptjs_1.default.hash(user.password, 10);
        // Se resta un segundo para evitar que un token emitido en el mismo instante
        // quede invalidado por el redondeo del campo `iat` (que va en segundos).
        if (!user.isNew)
            user.passwordChangedAt = new Date(Date.now() - 1000);
        next();
    });
});
userSchema.methods.comparePassword = function (enteredPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcryptjs_1.default.compare(enteredPassword, this.password);
    });
};
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
