import {
  assertAllowedMimeType,
  assertFileSize,
  isImageMimeType,
} from "./upload-limits.server";

const STAGED_UPLOADS_CREATE = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE = `#graphql
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
        ... on MediaImage {
          image {
            url
          }
        }
        ... on GenericFile {
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function createStagedUploadTarget(admin, {
  filename,
  mimeType,
  fileSize,
  httpMethod = "POST",
}) {
  assertAllowedMimeType(mimeType);
  const size = assertFileSize(fileSize);

  if (!filename || typeof filename !== "string") {
    throw new Error("filename is required");
  }

  const resource = isImageMimeType(mimeType) ? "IMAGE" : "FILE";

  const response = await admin.graphql(STAGED_UPLOADS_CREATE, {
    variables: {
      input: [
        {
          filename,
          mimeType,
          fileSize: String(size),
          httpMethod,
          resource,
        },
      ],
    },
  });

  const json = await response.json();
  const payload = json.data?.stagedUploadsCreate;
  const errors = payload?.userErrors;

  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }

  const target = payload?.stagedTargets?.[0];
  if (!target?.url || !target?.resourceUrl) {
    throw new Error("Failed to create staged upload target");
  }

  return {
    url: target.url,
    resourceUrl: target.resourceUrl,
    parameters: target.parameters ?? [],
    httpMethod,
  };
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function createShopifyFile(admin, {
  resourceUrl,
  filename,
  mimeType,
  alt,
}) {
  assertAllowedMimeType(mimeType);

  if (!resourceUrl) {
    throw new Error("resourceUrl is required");
  }

  const contentType = isImageMimeType(mimeType) ? "IMAGE" : "FILE";

  const response = await admin.graphql(FILE_CREATE, {
    variables: {
      files: [
        {
          originalSource: resourceUrl,
          contentType,
          alt: alt || filename || undefined,
          filename: filename || undefined,
        },
      ],
    },
  });

  const json = await response.json();
  const payload = json.data?.fileCreate;
  const errors = payload?.userErrors;

  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }

  const file = payload?.files?.[0];
  if (!file?.id) {
    throw new Error("fileCreate did not return a file");
  }

  const url =
    file.image?.url ||
    file.url ||
    resourceUrl;

  return {
    id: file.id,
    url,
    fileStatus: file.fileStatus,
  };
}
