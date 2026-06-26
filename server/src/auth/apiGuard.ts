import type { NextFunction, Request, Response } from "express";
import { authUploadRequired, authViewRequired } from "./config.js";
import { requireAuth, requireAuthForUpload } from "./middleware.js";

const PUBLIC_GET = new Set(["/api/auth/config", "/api/auth/status", "/api/health"]);

/** Identity bootstrap — attachAuth validates the bearer token; handlers return their own 401. */
const AUTH_SESSION_ROUTES = new Set(["/api/auth/me", "/api/auth/sync"]);

function isUploadRoute(path: string): boolean {
  return path === "/api/photos/upload" || path.startsWith("/api/photos/upload/");
}

export function protectApiRoutes(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  if (!path.startsWith("/api/")) {
    next();
    return;
  }

  if (PUBLIC_GET.has(path) && req.method === "GET") {
    next();
    return;
  }

  if (AUTH_SESSION_ROUTES.has(path)) {
    next();
    return;
  }

  if (isUploadRoute(path)) {
    if (authUploadRequired()) {
      requireAuthForUpload(req, res, next);
      return;
    }
    next();
    return;
  }

  if (!authViewRequired()) {
    next();
    return;
  }

  requireAuth(req, res, next);
}