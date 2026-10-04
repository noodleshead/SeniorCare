import jwt from "jsonwebtoken";

// Access tokens are short-lived and carry only the claims needed for
// authorization decisions. Never place personal information (name,
// address, etc.) inside the token payload.

export function signAccessToken({ userId, role }) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
}

export function signRefreshToken({ userId, tokenVersion = 0 }) {
  return jwt.sign({ sub: userId, tokenVersion }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

export const REFRESH_COOKIE_NAME = "seniorcare_refresh_token";

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches default refresh expiry
  };
}
