import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Always clear install sessions for this shop so app-proxy APIs fail closed.
  if (shop) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
