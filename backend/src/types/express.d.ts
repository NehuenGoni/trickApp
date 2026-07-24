import { JwtPayload } from "jsonwebtoken";
import { UserRole } from "../models/User";

interface AuthUser {
  id: string;
  role: UserRole;
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
