import { createHmac, timingSafeEqual } from "node:crypto";

function signature(payload) {
  const secret = process.env.AUTH_SECRET;
  return secret ? createHmac("sha256", secret).update(payload).digest("base64url") : null;
}

export function signReport(payload) {
  const signed = signature(payload);
  return signed ? `${payload}.${signed}` : null;
}

export function verifyReport(token) {
  const [body, supplied, extra] = String(token || "").split(".");
  const expected = body && !extra ? signature(body) : null;
  return Boolean(expected && supplied && expected.length === supplied.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
}
