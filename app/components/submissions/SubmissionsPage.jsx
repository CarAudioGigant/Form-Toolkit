import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useNavigation, useSearchParams } from "react-router";
import { InitialEmptyState, NoMatchingEmptyState } from "./EmptyStates";
import {
  buildPageItems,
  DATE_PRESETS,
  formatSubmittedAt,
  humanizeFormKey,
  sourceTone,
} from "./helpers";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13.5 13.5 17 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16.5 10a6.5 6.5 0 1 1-1.7-4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5V8H12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="4.5"
        width="13"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 8.5h13M7 3v3M13 3v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FormFilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="3"
        width="12"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 7.5h6M7 10.5h6M7 13.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function buildHref(params, patch) {
  const next = new URLSearchParams(params);
  Object.entries(patch).forEach(([key, value]) => {
    if (value == null || value === "") next.delete(key);
    else next.set(key, String(value));
  });
  const query = next.toString();
  return query ? `/app?${query}` : "/app";
}

function SourceBadge({ source }) {
  const tone = sourceTone(source);
  return <span className={`cag-badge cag-badge--${tone}`}>{source || "Other"}</span>;
}

function SubmissionDrawer({ submission, onClose }) {
  if (!submission) return null;
  const fields = Object.entries(submission.fields || {});

  return (
    <>
      <button
        type="button"
        className="cag-drawer-backdrop"
        aria-label="Close submission details"
        onClick={onClose}
      />
      <aside
        className="cag-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cag-drawer-title"
      >
        <div className="cag-drawer__header">
          <div>
            <h2 id="cag-drawer-title" className="cag-drawer__title">
              Submission #{submission.displayId}
            </h2>
            <p className="cag-drawer__meta">
              {submission.formName}
              <br />
              {formatSubmittedAt(submission.createdAt)}
            </p>
          </div>
          <button
            type="button"
            className="cag-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="cag-drawer__body">
          <section className="cag-drawer__section">
            <h3 className="cag-drawer__section-title">Customer</h3>
            <dl>
              <div className="cag-drawer__field">
                <dt>Name</dt>
                <dd>{submission.name || "—"}</dd>
              </div>
              <div className="cag-drawer__field">
                <dt>Email</dt>
                <dd>
                  {submission.email ? (
                    <a className="cag-email" href={`mailto:${submission.email}`}>
                      {submission.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {submission.phone ? (
                <div className="cag-drawer__field">
                  <dt>Phone</dt>
                  <dd>{submission.phone}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="cag-drawer__section">
            <h3 className="cag-drawer__section-title">Submission data</h3>
            {fields.length === 0 ? (
              <p className="cag-page-desc">No text fields were submitted.</p>
            ) : (
              <dl>
                {fields.map(([key, value]) => (
                  <div className="cag-drawer__field" key={key}>
                    <dt>{key}</dt>
                    <dd>{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="cag-drawer__section">
            <h3 className="cag-drawer__section-title">Source</h3>
            <SourceBadge source={submission.source} />
          </section>

          {submission.files?.length ? (
            <section className="cag-drawer__section">
              <h3 className="cag-drawer__section-title">Files</h3>
              <div className="cag-drawer__files">
                {submission.files.map((file, index) => (
                  <div
                    className="cag-drawer__file"
                    key={`${file.shopifyFileId || file.url || index}`}
                  >
                    <div>
                      <strong>{file.filename || "Untitled"}</strong>
                      <div className="cag-mobile-card__meta">
                        {file.fieldName || "file"}
                      </div>
                    </div>
                    {file.url ? (
                      <a
                        className="cag-btn"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function RowActions({ submission, onView, onDeleted }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setOpen(false);
      onDeleted?.();
    }
  }, [fetcher.state, fetcher.data, onDeleted]);

  return (
    <div className="cag-actions" ref={menuRef}>
      <button
        type="button"
        className="cag-actions__btn"
        aria-label={`Actions for submission ${submission.displayId}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className="cag-actions__menu" role="menu">
          <button
            type="button"
            className="cag-actions__item"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onView();
            }}
          >
            View submission
          </button>
          <fetcher.Form method="post" onClick={(event) => event.stopPropagation()}>
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="ids" value={submission.id} />
            <button
              type="submit"
              className="cag-actions__item cag-actions__item--danger"
              role="menuitem"
              onClick={(event) => {
                if (
                  !window.confirm(
                    `Delete submission #${submission.displayId}? This cannot be undone.`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              Delete
            </button>
          </fetcher.Form>
        </div>
      ) : null}
    </div>
  );
}

export function SubmissionsPage({
  submissions,
  pagination,
  filters,
  formKeys,
  totalAll = 0,
  selectedSubmission,
  error,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const bulkFetcher = useFetcher();
  const [query, setQuery] = useState(filters.search || "");
  const [selected, setSelected] = useState(() => new Set());
  const loading =
    navigation.state !== "idle" &&
    navigation.location?.pathname?.startsWith("/app");

  const filtersActive = Boolean(
    filters.search ||
      (filters.formKey && filters.formKey !== "") ||
      (filters.datePreset && filters.datePreset !== "last30"),
  );

  const isInitialEmpty = !error && !loading && totalAll === 0;
  const isFilteredEmpty =
    !error && !loading && totalAll > 0 && pagination.total === 0;
  const toolbarDisabled = isInitialEmpty;

  useEffect(() => {
    setQuery(filters.search || "");
  }, [filters.search]);

  useEffect(() => {
    setSelected(new Set());
  }, [filters.search, filters.formKey, filters.datePreset, pagination.page]);

  useEffect(() => {
    if (query === (filters.search || "")) return undefined;
    const handle = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (query) next.set("q", query);
          else next.delete("q");
          next.delete("page");
          next.delete("view");
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(handle);
  }, [query, filters.search, setSearchParams]);

  const updateParam = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      if (!("page" in patch)) next.delete("page");
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const openSubmission = useCallback(
    (id) => updateParam({ view: id, page: pagination.page }),
    [updateParam, pagination.page],
  );

  const closeDrawer = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const pageItems = useMemo(
    () => buildPageItems(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );

  const allVisibleSelected =
    submissions.length > 0 &&
    submissions.every((item) => selected.has(item.id));
  const someSelected =
    submissions.some((item) => selected.has(item.id)) && !allVisibleSelected;

  const toggleAll = (checked) => {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(submissions.map((item) => item.id)));
  };

  const toggleOne = (id, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearFilters = () => {
    setQuery("");
    setSearchParams(new URLSearchParams());
  };

  return (
    <>
      <header>
        <h1 className="cag-page-title">Form submissions</h1>
        <p className="cag-page-desc">
          Submissions from your storefront Liquid forms via the app proxy
          gateway.
        </p>
      </header>

      <section className={`cag-card${isInitialEmpty ? " cag-card--empty" : ""}`}>
        <div className={`cag-toolbar${toolbarDisabled ? " is-disabled" : ""}`}>
          <div className="cag-search">
            <span className="cag-search__icon">
              <SearchIcon />
            </span>
            <input
              className="cag-search__input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search submissions..."
              aria-label="Search submissions"
              disabled={toolbarDisabled}
            />
          </div>

          <label className="cag-select-wrap">
            <span className="cag-select-wrap__icon">
              <CalendarIcon />
            </span>
            <select
              className="cag-select cag-select--icon"
              value={filters.datePreset || "last30"}
              aria-label="Date filter"
              disabled={toolbarDisabled}
              onChange={(event) =>
                updateParam({ date: event.target.value, page: null })
              }
            >
              {DATE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <label className="cag-select-wrap">
            <span className="cag-select-wrap__icon">
              <FormFilterIcon />
            </span>
            <select
              className="cag-select cag-select--icon"
              value={filters.formKey || ""}
              aria-label="Form filter"
              disabled={toolbarDisabled}
              onChange={(event) =>
                updateParam({ form: event.target.value || null, page: null })
              }
            >
              <option value="">All forms</option>
              {formKeys.map((key) => (
                <option key={key} value={key}>
                  {humanizeFormKey(key)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`cag-btn cag-btn--ghost${
              filtersActive && !toolbarDisabled ? "" : " is-muted"
            }`}
            onClick={clearFilters}
            disabled={toolbarDisabled}
          >
            <RefreshIcon />
            Clear filters
          </button>
        </div>

        {selected.size > 0 ? (
          <div className="cag-bulk">
            <span>{selected.size} selected</span>
            <bulkFetcher.Form method="post">
              <input type="hidden" name="intent" value="delete" />
              {[...selected].map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <button
                type="submit"
                className="cag-btn cag-btn--danger"
                onClick={(event) => {
                  if (
                    !window.confirm(
                      `Delete ${selected.size} submission${selected.size === 1 ? "" : "s"}? This cannot be undone.`,
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                Delete
              </button>
            </bulkFetcher.Form>
          </div>
        ) : null}

        {error ? (
          <div className="cag-empty cag-empty--compact">
            <h2 className="cag-empty__title cag-empty__title--sm">
              Unable to load submissions
            </h2>
            <p className="cag-empty__text">
              Something went wrong while loading your submissions.
            </p>
            <div className="cag-empty__actions">
              <Link className="cag-btn cag-btn--primary" to="/app">
                Try again
              </Link>
            </div>
          </div>
        ) : loading && submissions.length === 0 && totalAll === 0 ? (
          <div className="cag-table-wrap">
            <table className="cag-table">
              <tbody>
                {Array.from({ length: 6 }).map((_, index) => (
                  <tr className="cag-skeleton" key={index}>
                    <td colSpan={8}>
                      <div className="cag-skeleton__bar" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : isInitialEmpty ? (
          <InitialEmptyState />
        ) : isFilteredEmpty ? (
          <NoMatchingEmptyState onClear={clearFilters} />
        ) : (
          <>
            <div className="cag-table-wrap">
              <table className="cag-table">
                <thead>
                  <tr>
                    <th className="cag-table__check" scope="col">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={(event) => toggleAll(event.target.checked)}
                        aria-label="Select all submissions on this page"
                      />
                    </th>
                    <th className="cag-col-id" scope="col">
                      #
                    </th>
                    <th scope="col">Form</th>
                    <th scope="col">
                      <button
                        type="button"
                        className="cag-sort"
                        onClick={() =>
                          updateParam({
                            sort: "submitted_at",
                            order:
                              filters.sort === "submitted_at" &&
                              filters.order === "desc"
                                ? "asc"
                                : "desc",
                          })
                        }
                      >
                        Submitted at
                        {filters.sort === "submitted_at"
                          ? filters.order === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th className="cag-col-source" scope="col">
                      Source
                    </th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => {
                    const isSelected = selected.has(submission.id);
                    return (
                      <tr
                        key={submission.id}
                        className={isSelected ? "is-selected" : undefined}
                        onClick={() => openSubmission(submission.id)}
                      >
                        <td
                          className="cag-table__check"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) =>
                              toggleOne(submission.id, event.target.checked)
                            }
                            aria-label={`Select submission ${submission.displayId}`}
                          />
                        </td>
                        <td className="cag-table__id cag-col-id">
                          {submission.displayId}
                        </td>
                        <td>
                          <div className="cag-table__form" title={submission.formName}>
                            {submission.formName}
                          </div>
                        </td>
                        <td>{formatSubmittedAt(submission.createdAt)}</td>
                        <td>{submission.name || "—"}</td>
                        <td onClick={(event) => event.stopPropagation()}>
                          {submission.email ? (
                            <a
                              className="cag-email"
                              href={`mailto:${submission.email}`}
                            >
                              {submission.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="cag-col-source">
                          <SourceBadge source={submission.source} />
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <RowActions
                            submission={submission}
                            onView={() => openSubmission(submission.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="cag-mobile-list">
              {submissions.map((submission) => (
                <article
                  key={submission.id}
                  className="cag-mobile-card"
                  onClick={() => openSubmission(submission.id)}
                >
                  <div className="cag-mobile-card__top">
                    <span className="cag-mobile-card__form">
                      {submission.formName}
                    </span>
                    <SourceBadge source={submission.source} />
                  </div>
                  <div>{submission.name || "—"}</div>
                  <div className="cag-mobile-card__meta">
                    {submission.email || "No email"}
                  </div>
                  <div className="cag-mobile-card__meta">
                    {formatSubmittedAt(submission.createdAt)}
                  </div>
                </article>
              ))}
            </div>

            <div className="cag-footer">
              <div className="cag-footer__meta">
                {pagination.total === 0
                  ? "No submissions"
                  : `Showing ${pagination.from}–${pagination.to} of ${pagination.total} submissions`}
              </div>
              <nav className="cag-pagination" aria-label="Pagination">
                <Link
                  className="cag-page-btn"
                  to={buildHref(searchParams, {
                    page: Math.max(1, pagination.page - 1),
                  })}
                  aria-disabled={!pagination.hasPrev}
                  onClick={(event) => {
                    if (!pagination.hasPrev) event.preventDefault();
                  }}
                  style={
                    !pagination.hasPrev
                      ? { pointerEvents: "none", opacity: 0.4 }
                      : undefined
                  }
                >
                  ‹
                </Link>
                {pageItems.map((item) =>
                  typeof item === "string" ? (
                    <span className="cag-ellipsis" key={item}>
                      …
                    </span>
                  ) : (
                    <Link
                      key={item}
                      className={`cag-page-btn${
                        item === pagination.page ? " is-active" : ""
                      }`}
                      to={buildHref(searchParams, { page: item })}
                      aria-current={
                        item === pagination.page ? "page" : undefined
                      }
                    >
                      {item}
                    </Link>
                  ),
                )}
                <Link
                  className="cag-page-btn"
                  to={buildHref(searchParams, {
                    page: Math.min(
                      pagination.totalPages,
                      pagination.page + 1,
                    ),
                  })}
                  aria-disabled={!pagination.hasNext}
                  onClick={(event) => {
                    if (!pagination.hasNext) event.preventDefault();
                  }}
                  style={
                    !pagination.hasNext
                      ? { pointerEvents: "none", opacity: 0.4 }
                      : undefined
                  }
                >
                  ›
                </Link>
              </nav>
            </div>
          </>
        )}
      </section>

      <SubmissionDrawer
        submission={selectedSubmission}
        onClose={closeDrawer}
      />
    </>
  );
}
