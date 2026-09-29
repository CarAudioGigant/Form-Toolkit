import { authenticate } from "../shopify.server";
import {
  buildGatewaySessionCookie,
  createGatewaySessionToken,
  requireInstalledAppProxy,
} from "../services/installed-shop.server";
import { checkRateLimit, clientIp } from "../services/rate-limit.server";

function json(data, init = {}) {
  return Response.json(data, init);
}

/**
 * Opens an HttpOnly gateway session for the installed shop (via app proxy only).
 * Storefront JS must call this before staged-upload / submit.
 * Token is NOT readable from console (HttpOnly cookie when supported).
 */
export const loader = async ({ request }) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const gate = await requireInstalledAppProxy(
    authenticate.public.appProxy,
    request,
  );
  if (!gate.ok) return gate.response;

  const ip = clientIp(request);
  if (!checkRateLimit(`session:${gate.shop}:${ip}`, { limit: 30 })) {
    return json({ error: "Too many requests" }, { status: 429 });
  }

  const { token, expiresAt, maxAge } = createGatewaySessionToken(gate.shop);

  return json(
    {
      ok: true,
      expiresAt,
      // Returned for header-based session (app proxy may not forward cookies).
      // forms-gateway.js keeps this in closure memory, not window/localStorage.
      sessionToken: token,
    },
    {
      headers: {
        "Set-Cookie": buildGatewaySessionCookie(token, maxAge),
        "Cache-Control": "no-store",
      },
    },
  );
};

export const action = async ({ request }) => {
  await requireInstalledAppProxy(authenticate.public.appProxy, request);
  return json({ error: "Use GET" }, { status: 405 });
};
