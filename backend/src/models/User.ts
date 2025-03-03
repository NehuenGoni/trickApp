import mongoose from "mongoose";
import bcrypt from "bcryptjs";

interface IUser {
  username: string;
  email: string;
  password: string;
  comparePassword(password: string): Promise<boolean>
}

const userSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

userSchema.pre("save", async function (next) {
  const user = this as mongoose.Document & IUser;
  if (!user.isModified("password")) return next();
  user.password = await bcrypt.hash(user.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
