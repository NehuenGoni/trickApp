import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: string; 
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: string;
  }
}
