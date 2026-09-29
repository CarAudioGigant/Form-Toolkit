import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import prisma from "../db.server";

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

/** App-proxy signed timestamp must be this fresh (seconds). */
export const PROXY_TIMESTAMP_MAX_AGE_SEC = 5 * 60;

/** Storefront gateway session lifetime (seconds). */
export const GATEWAY_SESSION_MAX_AGE_SEC = 15 * 60;

export const GATEWAY_COOKIE = "__cfg_gw";
export const GATEWAY_HEADER = "x-forms-gateway";
export const GATEWAY_HEADER_VALUE = "1";
export const GATEWAY_SESSION_HEADER = "x-forms-gateway-session";


const UNAUTHORIZED = { error: "Unauthorized" };

function unauthorized() {
  return Response.json(UNAUTHORIZED, { status: 401 });
}

function badRequest() {
  return Response.json({ error: "Bad request" }, { status: 400 });
}

/**
 * Normalize and validate a Shopify shop domain from app-proxy query params.
 * @returns {string|null}
 */
export function normalizeShopDomain(shop) {
  if (!shop || typeof shop !== "string") return null;
  const trimmed = shop.trim().toLowerCase();
  if (!SHOP_DOMAIN_RE.test(trimmed)) return null;
  return trimmed;
}

function getApiSecret() {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  if (!secret) {
    throw new Error("SHOPIFY_API_SECRET is not configured");
  }
  return secret;
}

function signPayload(payload) {
  return createHmac("sha256", getApiSecret()).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Require Shopify app-proxy query params before HMAC verify.
 * Blocks raw curl/console hits against the app host without a proxy signature.
 */
export function assertAppProxyQuery(url) {
  const shop = normalizeShopDomain(url.searchParams.get("shop"));
  const timestamp = url.searchParams.get("timestamp");
  const signature =
    url.searchParams.get("signature") || url.searchParams.get("hmac");

  if (!shop || !timestamp || !signature) {
    return { ok: false, response: unauthorized() };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, response: unauthorized() };
  }

  // Shopify app proxy timestamps are unix seconds.
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSec > PROXY_TIMESTAMP_MAX_AGE_SEC) {
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, shop };
}

/**
 * Fail closed: only Shopify-signed app-proxy traffic for an installed shop.
 */
export async function requireInstalledAppProxy(authenticateAppProxy, request) {
  const url = new URL(request.url);
  const precheck = assertAppProxyQuery(url);
  if (!precheck.ok) return precheck;

  let context;
  try {
    // Throws Response on invalid HMAC — only Shopify-signed proxy traffic proceeds.
    context = await authenticateAppProxy(request);
  } catch (error) {
    if (error instanceof Response) {
      return { ok: false, response: unauthorized() };
    }
    throw error;
  }

  const { admin, session } = context;

  if (!session?.shop || !session?.accessToken || !admin) {
    return { ok: false, response: unauthorized() };
  }

  const sessionShop = normalizeShopDomain(session.shop);
  if (!sessionShop || sessionShop !== precheck.shop) {
    return { ok: false, response: unauthorized() };
  }

  const stored = await prisma.session.findFirst({
    where: {
      shop: sessionShop,
      isOnline: false,
      accessToken: { not: "" },
    },
    select: { id: true },
  });

  if (!stored) {
    return { ok: false, response: unauthorized() };
  }

  return {
    ok: true,
    admin,
    session: { ...session, shop: sessionShop },
    shop: sessionShop,
  };
}

/**
 * Create a signed HttpOnly gateway session for the installed shop.
 * Cookie is set on the storefront domain via the app proxy response.
 */
export function createGatewaySessionToken(shop) {
  const exp = Math.floor(Date.now() / 1000) + GATEWAY_SESSION_MAX_AGE_SEC;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${shop}|${exp}|${nonce}`;
  const sig = signPayload(payload);
  return {
    token: `${payload}|${sig}`,
    expiresAt: exp,
    maxAge: GATEWAY_SESSION_MAX_AGE_SEC,
  };
}

export function verifyGatewaySessionToken(token, shop) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split("|");
  if (parts.length !== 4) return false;
  const [tokenShop, expRaw, nonce, sig] = parts;
  if (!nonce || !sig) return false;
  if (normalizeShopDomain(tokenShop) !== shop) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const payload = `${tokenShop}|${expRaw}|${nonce}`;
  const expected = signPayload(payload);
  return safeEqual(expected, sig);
}

export function parseCookieHeader(cookieHeader) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function buildGatewaySessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GATEWAY_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearGatewaySessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${GATEWAY_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Mutating proxy endpoints: installed shop + fresh proxy sig + gateway session + CSRF header.
 * Blocks curl/Postman against the app host and casual console calls without bootstrap.
 *
 * Session may arrive as HttpOnly cookie (when proxy forwards cookies) or
 * X-Forms-Gateway-Session header (token kept in JS memory by forms-gateway.js).
 */
export async function requireSecureGatewayMutation(
  authenticateAppProxy,
  request,
) {
  const gate = await requireInstalledAppProxy(authenticateAppProxy, request);
  if (!gate.ok) return gate;

  const gatewayHeader = request.headers.get(GATEWAY_HEADER);
  if (gatewayHeader !== GATEWAY_HEADER_VALUE) {
    return { ok: false, response: unauthorized() };
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const cookieToken = cookies[GATEWAY_COOKIE];
  const headerToken = request.headers.get(GATEWAY_SESSION_HEADER);
  const sessionToken = headerToken || cookieToken;

  if (!verifyGatewaySessionToken(sessionToken, gate.shop)) {
    return { ok: false, response: unauthorized() };
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, response: badRequest() };
  }

  return gate;
}

const ALLOWED_STAGED_HOST_SUFFIXES = [
  "shopify-staged-uploads.storage.googleapis.com",
  "shopify.com",
  "myshopify.com",
];

/**
 * Reject non-Shopify staged URLs before passing them to fileCreate (SSRF hardening).
 */
export function assertShopifyStagedResourceUrl(resourceUrl) {
  if (!resourceUrl || typeof resourceUrl !== "string") {
    throw new Error("resourceUrl is required");
  }

  let parsed;
  try {
    parsed = new URL(resourceUrl);
  } catch {
    throw new Error("Invalid resourceUrl");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("resourceUrl must use https");
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_STAGED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );

  if (!allowed) {
    throw new Error("resourceUrl host is not an allowed Shopify staging host");
  }

  return resourceUrl;
}
