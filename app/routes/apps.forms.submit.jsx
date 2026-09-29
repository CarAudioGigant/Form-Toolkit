import { authenticate } from "../shopify.server";
import { createShopifyFile } from "../services/shopify-files.server";
import {
  createSubmission,
  sanitizeFields,
  sanitizeFormKey,
  sanitizeIncomingFiles,
} from "../services/submissions.server";
import { checkRateLimit, clientIp } from "../services/rate-limit.server";
import {
  assertShopifyStagedResourceUrl,
  clearGatewaySessionCookie,
  requireSecureGatewayMutation,
} from "../services/installed-shop.server";

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
  if (!checkRateLimit(`submit:${shop}:${ip}`, { limit: 20 })) {
    return json({ error: "Too many requests" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const formKey = sanitizeFormKey(body.form_key ?? body.formKey);
    const fields = sanitizeFields(body.fields ?? {});
    const incomingFiles = sanitizeIncomingFiles(body.files ?? []);

    const createdFiles = [];
    for (const file of incomingFiles) {
      assertShopifyStagedResourceUrl(file.resourceUrl);

      const shopifyFile = await createShopifyFile(admin, {
        resourceUrl: file.resourceUrl,
        filename: file.filename,
        mimeType: file.mimeType,
        alt: `${formKey}:${file.fieldName}`,
      });

      createdFiles.push({
        fieldName: file.fieldName,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        shopifyFileId: shopifyFile.id,
        url: shopifyFile.url,
      });
    }

    const url = new URL(request.url);
    const customerId = url.searchParams.get("logged_in_customer_id") || null;

    const submission = await createSubmission(admin, {
      formKey,
      fields,
      files: createdFiles,
      customerId,
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json(
      {
        ok: true,
        id: submission.id,
        fileCount: createdFiles.length,
      },
      {
        headers: {
          "Set-Cookie": clearGatewaySessionCookie(),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Submit failed" },
      { status: 400 },
    );
  }
};

export const loader = async () => {
  return json({ error: "Unauthorized" }, { status: 401 });
};
