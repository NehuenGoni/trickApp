import { JwtPayload } from "jsonwebtoken";
import { UserRole, IBilling } from "../models/User";

interface AuthUser {
  id: string;
  role: UserRole;
  billing?: IBilling;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: string;
      authUser?: AuthUser;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: string;
    authUser?: AuthUser;
  }
}
