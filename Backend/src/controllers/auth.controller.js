import * as authService from "../services/auth.service.js";
import { REFRESH_COOKIE_NAME, refreshCookieOptions, verifyRefreshToken, verifyAccessToken, signAccessToken } from "../utils/token.js";
import User from "../models/User.js";
import { AuthenticationError } from "../utils/errors.js";
import { safeCreateAuditLog } from "../services/auditLog.service.js";
import { AUDIT_ACTIONS, AUDIT_MODULES } from "../utils/constants.js";

export async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.validatedBody, { ipAddress: req.ip });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: { accessToken, user },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) throw new AuthenticationError("Session expired. Please log in again.");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new AuthenticationError("Session expired. Please log in again.");
    }

    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new AuthenticationError("Session expired. Please log in again.");
    }

    const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
    res.status(200).json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  // Logout intentionally does NOT require `authenticate` (an already-
  // expired access token must still be able to log out) — so the actor
  // is identified here on a strictly best-effort basis: if a still-valid
  // bearer token happens to be present, attribute the log entry to it;
  // otherwise, just skip logging rather than rejecting the logout.
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (bearer) {
    try {
      const payload = verifyAccessToken(bearer);
      const user = await User.findById(payload.sub).select("email role");
      if (user) {
        await safeCreateAuditLog({
          actor: { id: user._id.toString(), role: user.role },
          actorEmail: user.email,
          action: AUDIT_ACTIONS.LOGOUT,
          module: AUDIT_MODULES.AUTH,
          entityType: "User",
          entityId: user._id,
          description: `${user.role} logged out.`,
        });
      }
    } catch {
      // Expired/invalid token, or user no longer exists — logout still
      // proceeds normally; there is simply nothing reliable to log.
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.status(200).json({ success: true, message: "Logged out." });
}

export async function me(req, res, next) {
  try {
    const user = await authService.getAuthenticatedUser(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const token = await authService.requestPasswordReset(req.validatedBody.email);
    const response = {
      success: true,
      message: "If an account exists for this email, password recovery instructions have been sent.",
    };
    // No email-delivery service is configured anywhere in this project
    // (no nodemailer/SMTP/SendGrid setup exists in package.json or
    // .env.example) — so outside production, the token is returned
    // directly in this response so the reset flow can actually be used
    // and tested end-to-end. This is intentionally gated off in
    // production rather than silently faking that an email was sent;
    // wiring a real transactional email service is a deployment/
    // environment-configuration task, not something this phase invents.
    if (process.env.NODE_ENV !== "production" && token) {
      response.devOnlyResetToken = token;
      response.devOnlyNote =
        "No email service is configured in this environment. This token is only included because NODE_ENV is not 'production'.";
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.validatedBody);
    res.status(200).json({ success: true, message: "Your password has been reset. You may now log in." });
  } catch (err) {
    next(err);
  }
}
