/**
 * apps/backend/src/auth/middleware.ts
 *
 * authMiddleware — applied to all protected routes.
 *
 * 1. Reads the HTTP-only "access_token" cookie.
 * 2. Verifies the backend JWT (APP_SECRET, HS256).
 * 3. Fetches the full User document from MongoDB.
 * 4. Injects it into the Hono context as c.var.user.
 *
 * All subsequent route handlers can safely call c.var.user without re-fetching.
 */

import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyBackendToken, ACCESS_TOKEN_COOKIE } from "./jwt";
import { User } from "../models/User";
import type { IUser } from "../models/User";

// Extend Hono's ContextVariableMap so c.var.user is typed everywhere
declare module "hono" {
  interface ContextVariableMap {
    user: IUser;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // 1. Extract token from cookie
  const token = getCookie(c, ACCESS_TOKEN_COOKIE);

  if (!token) {
    return c.json({ error: "Unauthorized — missing token" }, 401);
  }

  try {
    // 2. Verify JWT signature + expiry
    const payload = await verifyBackendToken(token);

    if (!payload.sub) {
      return c.json({ error: "Unauthorized — malformed token" }, 401);
    }

    // 3. Load user from MongoDB (payload.sub === githubId)
    const user = await User.findOne({ githubId: payload.sub }).lean();

    if (!user) {
      return c.json({ error: "Unauthorized — user not found" }, 401);
    }

    // 4. Inject into context
    c.set("user", user as unknown as IUser);

    await next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    // Don't leak internal error details in production
    return c.json({ error: "Unauthorized", details: msg }, 401);
  }
});
