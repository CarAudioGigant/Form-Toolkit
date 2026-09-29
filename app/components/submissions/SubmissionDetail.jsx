import { formatBytes, formatDetailTimestamp, isImageFile } from "./detailHelpers";
import { sourceTone } from "./helpers";

function SourceBadge({ source }) {
  const tone = sourceTone(source);
  return <span className={`cag-badge cag-badge--${tone}`}>{source || "Other"}</span>;
}

function formatDateValue(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return String(value || "—");
  }
}

/**
 * Universal field renderer for dynamic form responses.
 */
export function SubmissionField({ field }) {
  if (!field) return null;
  const { type, label, value } = field;

  let body;
  switch (type) {
    case "email":
      body = value ? (
        <a className="cag-email" href={`mailto:${value}`}>
          {value}
        </a>
      ) : (
        "—"
      );
      break;
    case "phone":
      body = value ? (
        <a className="cag-email" href={`tel:${String(value).replace(/\s+/g, "")}`}>
          {value}
        </a>
      ) : (
        "—"
      );
      break;
    case "url":
      body = value ? (
        <a className="cag-email" href={value} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        "—"
      );
      break;
    case "textarea":
      body = <p className="cag-field__long">{value || "—"}</p>;
      break;
    case "checkbox":
      body = <span className="cag-field__value">{value || "—"}</span>;
      break;
    case "multiselect":
      body = (
        <div className="cag-field__badges">
          {(Array.isArray(value) ? value : [value]).filter(Boolean).map((item) => (
            <span className="cag-badge cag-badge--other" key={item}>
              {item}
            </span>
          ))}
        </div>
      );
      break;
    case "date":
      body = <span className="cag-field__value">{formatDateValue(value)}</span>;
      break;
    case "time":
    case "number":
    case "text":
    default:
      body = <span className="cag-field__value">{value || "—"}</span>;
      break;
  }

  return (
    <div className={`cag-field${type === "textarea" ? " cag-field--block" : ""}`}>
      <div className="cag-field__label">{label}</div>
      <div className="cag-field__body">{body}</div>
    </div>
  );
}

export function CustomerInfoCard({ rows }) {
  return (
    <section className="cag-detail-card">
      <header className="cag-detail-card__head">
        <h2 className="cag-detail-card__title">Customer information</h2>
      </header>
      {rows.length === 0 ? (
        <p className="cag-detail-card__empty">
          No customer contact fields were included with this submission.
        </p>
      ) : (
        <dl className="cag-detail-grid">
          {rows.map((row) => (
            <div className="cag-detail-grid__item" key={row.key}>
              <dt>{row.label}</dt>
              <dd>
                {row.type === "email" && row.value ? (
                  <a className="cag-email" href={`mailto:${row.value}`}>
                    {row.value}
                  </a>
                ) : row.type === "phone" && row.value ? (
                  <a
                    className="cag-email"
                    href={`tel:${String(row.value).replace(/\s+/g, "")}`}
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function SubmissionDetailsCard({ submission }) {
  return (
    <section className="cag-detail-card">
      <header className="cag-detail-card__head">
        <h2 className="cag-detail-card__title">Submission details</h2>
      </header>
      <dl className="cag-meta-list">
        <div className="cag-meta-list__row">
          <dt>Form</dt>
          <dd>{submission.formName}</dd>
        </div>
        <div className="cag-meta-list__row">
          <dt>Submission ID</dt>
          <dd>#{submission.displayId}</dd>
        </div>
        <div className="cag-meta-list__row">
          <dt>Submitted at</dt>
          <dd>{formatDetailTimestamp(submission.createdAt)}</dd>
        </div>
        <div className="cag-meta-list__row">
          <dt>Source</dt>
          <dd>
            <SourceBadge source={submission.source} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ImageGallery({ files }) {
  if (!files.length) return null;
  const large = files.length === 1;

  return (
    <div className={`cag-gallery${large ? " cag-gallery--single" : ""}`}>
      {files.map((file, index) => (
        <a
          key={`${file.shopifyFileId || file.url || index}`}
          className="cag-gallery__item"
          href={file.url || undefined}
          target="_blank"
          rel="noreferrer"
        >
          {file.url ? (
            <img src={file.url} alt={file.filename || "Uploaded image"} />
          ) : (
            <div className="cag-gallery__placeholder">Processing…</div>
          )}
          <span className="cag-gallery__caption">
            {file.filename || "Image"}
            {file.size ? ` · ${formatBytes(file.size)}` : ""}
          </span>
        </a>
      ))}
    </div>
  );
}

function DocumentList({ files }) {
  if (!files.length) return null;
  return (
    <div className="cag-docs">
      {files.map((file, index) => (
        <div
          className="cag-docs__item"
          key={`${file.shopifyFileId || file.url || index}`}
        >
          <div className="cag-docs__icon" aria-hidden="true">
            📄
          </div>
          <div className="cag-docs__meta">
            <div className="cag-docs__name">{file.filename || "Document"}</div>
            <div className="cag-docs__size">
              {file.fieldName || "file"}
              {file.size ? ` · ${formatBytes(file.size)}` : ""}
            </div>
          </div>
          {file.url ? (
            <a
              className="cag-btn"
              href={file.url}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          ) : (
            <span className="cag-docs__pending">Processing…</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function FormResponsesCard({ fields, files }) {
  const images = (files || []).filter(isImageFile);
  const documents = (files || []).filter((file) => !isImageFile(file));
  const empty = fields.length === 0 && images.length === 0 && documents.length === 0;

  return (
    <section className="cag-detail-card cag-detail-card--responses">
      <header className="cag-detail-card__head">
        <h2 className="cag-detail-card__title">Form responses</h2>
      </header>

      {empty ? (
        <p className="cag-detail-card__empty">
          No response fields or files were included with this submission.
        </p>
      ) : (
        <div className="cag-responses">
          {fields.map((field) => (
            <SubmissionField key={field.key} field={field} />
          ))}

          {images.length > 0 ? (
            <div className="cag-responses__files">
              <div className="cag-field__label">
                {images.length === 1 ? "Image" : "Images"}
              </div>
              <ImageGallery files={images} />
            </div>
          ) : null}

          {documents.length > 0 ? (
            <div className="cag-responses__files">
              <div className="cag-field__label">
                {documents.length === 1 ? "Attachment" : "Attachments"}
              </div>
              <DocumentList files={documents} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
