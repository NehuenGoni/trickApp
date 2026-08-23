import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES } from "../config/constants";
import { PlanId, PLAN_IDS, periodKeyOf } from "../config/plans";

export type UserRole = typeof ROLES[keyof typeof ROLES];

export interface IPointsAdjustment {
  delta: number;
  reason: string;
  adjustedBy?: mongoose.Types.ObjectId;
  adjustedAt: Date;
}

export type BillingStatus = "none" | "active" | "past_due" | "canceled" | "expired";

export interface IBillingUsage {
  /** 'YYYY-MM' del período que están contando `tournamentsCreated`. */
  periodKey: string;
  /** Torneos creados en `periodKey`. Se resetea al cambiar de mes (perezoso, sin cron). */
  tournamentsCreated: number;
  /** Acumulado histórico de TODOS los torneos creados. Nunca se resetea ni decrementa:
   *  es lo único que impide reciclar el torneo gratis borrándolo y creando otro. */
  tournamentsTotal: number;
}

export interface IBilling {
  plan: PlanId;
  status: BillingStatus;
  currentPeriodEnd?: Date | null;
  usage: IBillingUsage;
  /** Usuario de antes de que existiera billing: no se le cobra retroactivamente. */
  grandfathered: boolean;
  /** Última vez que se le mandó el recordatorio de vencimiento próximo, para no repetirlo. */
  lastExpiryReminderAt?: Date | null;
}

/**
 * Preferencias de notificación por email. Los transaccionales (verificación
 * de cuenta, reset/cambio de contraseña, avisos de pago) se mandan siempre y
 * no pasan por acá. `matchResults` arranca en `false`: es el evento de mayor
 * volumen (uno por partido jugado) y conviene que sea opt-in explícito.
 */
export interface INotificationPrefs {
  tournamentSignup: boolean;
  tournamentStart: boolean;
  tournamentResults: boolean;
  matchResults: boolean;
  leagueRoles: boolean;
}

export interface IUser {
  username: string;
  email: string;
  password: string;
  totalPoints: number;
  role: UserRole;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  notificationPrefs: INotificationPrefs;
  pointsAdjustments: IPointsAdjustment[];
  billing: IBilling;
  comparePassword(password: string): Promise<boolean>
}

const pointsAdjustmentSchema = new mongoose.Schema<IPointsAdjustment>({
  delta: { type: Number, required: true },
  reason: { type: String, required: true },
  adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  adjustedAt: { type: Date, default: Date.now }
}, { _id: false });

const billingUsageSchema = new mongoose.Schema<IBillingUsage>({
  periodKey: { type: String, default: () => periodKeyOf(new Date()) },
  tournamentsCreated: { type: Number, default: 0, min: 0 },
  tournamentsTotal: { type: Number, default: 0, min: 0 }
}, { _id: false });

const billingSchema = new mongoose.Schema<IBilling>({
  plan: { type: String, enum: PLAN_IDS, default: "free" },
  status: {
    type: String,
    enum: ["none", "active", "past_due", "canceled", "expired"],
    default: "none"
  },
  currentPeriodEnd: { type: Date, default: null },
  usage: { type: billingUsageSchema, default: () => ({}) },
  grandfathered: { type: Boolean, default: false },
  lastExpiryReminderAt: { type: Date, default: null }
}, { _id: false });

const notificationPrefsSchema = new mongoose.Schema<INotificationPrefs>({
  tournamentSignup: { type: Boolean, default: true },
  tournamentStart: { type: Boolean, default: true },
  tournamentResults: { type: Boolean, default: true },
  matchResults: { type: Boolean, default: false },
  leagueRoles: { type: Boolean, default: true }
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
  emailVerified: { type: Boolean, default: false },
  // Mismo patrón que passwordResetToken: se guarda el hash, no el valor que viaja al mail.
  emailVerificationToken: { type: String, select: false, index: true, sparse: true },
  emailVerificationExpires: { type: Date, select: false },
  notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
  pointsAdjustments: { type: [pointsAdjustmentSchema], default: [] },
  billing: { type: billingSchema, default: () => ({}) },
}, { timestamps: true });

userSchema.index({ "billing.currentPeriodEnd": 1 });
// Ranking global (adminTournament.getAdminStats) y userStats.globalRank.
userSchema.index({ totalPoints: -1 });

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
