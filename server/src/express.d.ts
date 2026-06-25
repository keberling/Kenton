import type { User } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}

export {};