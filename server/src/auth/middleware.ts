import type { NextFunction, Request, Response } from "express";
import { authRequired, authUploadRequired, authViewRequired, azureAuthEnabled } from "./config.js";
import { verifyMicrosoftAccessToken } from "./microsoft.js";
import { store } from "../store.js";
import type { AuthUser, User } from "../types.js";

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function resolveAuthUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const claims = await verifyMicrosoftAccessToken(token);
  if (!claims) return null;

  return store.upsertUser(claims);
}

export async function attachAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.authUser = (await resolveAuthUser(req)) ?? undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!azureAuthEnabled() || !authViewRequired()) {
    next();
    return;
  }
  if (!req.authUser) {
    res.status(401).json({ error: "Sign in with Microsoft to continue" });
    return;
  }
  next();
}

export function requireAuthForUpload(req: Request, res: Response, next: NextFunction) {
  if (!azureAuthEnabled() || !authUploadRequired()) {
    next();
    return;
  }
  if (!req.authUser) {
    res.status(401).json({ error: "Sign in with Microsoft to upload photos" });
    return;
  }
  next();
}

export function mergeProfilePatch(user: User, patch: Partial<AuthUser>): User {
  return store.upsertUser({
    microsoftOid: user.microsoftOid,
    tenantId: user.tenantId,
    displayName: patch.displayName ?? user.displayName,
    email: patch.email ?? user.email,
    preferredUsername: patch.preferredUsername ?? user.preferredUsername,
    jobTitle: patch.jobTitle ?? user.jobTitle,
    department: patch.department ?? user.department,
    officeLocation: patch.officeLocation ?? user.officeLocation,
  });
}