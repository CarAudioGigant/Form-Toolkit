import { authenticate } from "../shopify.server";
import { createStagedUploadTarget } from "../services/shopify-files.server";
import { checkRateLimit, clientIp } from "../services/rate-limit.server";
import { requireSecureGatewayMutation } from "../services/installed-shop.server";

function json(data, init = {}) {
  return Response.json(data, init);
}

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const gate = await requireSecureGatewayMutation(
    authenticate.public.appProxy,
    request,
  );
  if (!gate.ok) return gate.response;

  const { admin, shop } = gate;
  const ip = clientIp(request);
  if (!checkRateLimit(`staged:${shop}:${ip}`, { limit: 40 })) {
    return json({ error: "Too many requests" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const target = await createStagedUploadTarget(admin, {
      filename: body.filename,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      httpMethod: body.httpMethod === "PUT" ? "PUT" : "POST",
    });

    return json({ ok: true, ...target });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Staged upload failed" },
      { status: 400 },
    );
  }
};

export const loader = async () => {
  return json({ error: "Unauthorized" }, { status: 401 });
};
