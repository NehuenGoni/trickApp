import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES } from "../config/constants";

export type UserRole = typeof ROLES[keyof typeof ROLES];

export interface IPointsAdjustment {
  delta: number;
  reason: string;
  adjustedBy?: mongoose.Types.ObjectId;
  adjustedAt: Date;
}

interface IUser {
  username: string;
  email: string;
  password: string;
  totalPoints: number;
  role: UserRole;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  pointsAdjustments: IPointsAdjustment[];
  comparePassword(password: string): Promise<boolean>
}

const pointsAdjustmentSchema = new mongoose.Schema<IPointsAdjustment>({
  delta: { type: Number, required: true },
  reason: { type: String, required: true },
  adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  adjustedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  totalPoints: { type: Number, default: 0, min: 0 },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.USER
  },
  passwordChangedAt: { type: Date },
  // Se guarda el hash del token de recuperación, nunca el valor que viaja al mail:
  // si alguien lee la base no puede reconstruir el enlace.
  passwordResetToken: { type: String, select: false, index: true, sparse: true },
  passwordResetExpires: { type: Date, select: false },
  pointsAdjustments: { type: [pointsAdjustmentSchema], default: [] },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  const user = this as mongoose.Document & IUser;
  if (!user.isModified("password")) return next();
  user.password = await bcrypt.hash(user.password, 10);
  // Se resta un segundo para evitar que un token emitido en el mismo instante
  // quede invalidado por el redondeo del campo `iat` (que va en segundos).
  if (!user.isNew) user.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
