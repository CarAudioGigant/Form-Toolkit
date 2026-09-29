import { Link } from "react-router";

/** Empty-state illustration: storefront form → submit → audio brand */
export function EmptyStateIllustration() {
  return (
    <svg
      className="cag-empty__art"
      viewBox="0 0 340 240"
      width="320"
      height="226"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="170" cy="128" rx="118" ry="86" fill="#F2F5FF" />
      <ellipse cx="170" cy="128" rx="88" ry="64" fill="#E8EEFF" opacity="0.7" />

      {/* Paper plane */}
      <g transform="translate(52 78) rotate(-18)">
        <path
          d="M2 18 L46 2 L34 40 L24 28 L2 18Z"
          fill="#9BB0F7"
        />
        <path d="M46 2 L24 28 L34 40" fill="#5F7CF2" />
        <path
          d="M24 28 L46 2"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* Accent strokes */}
      <path
        d="M214 48 L228 36"
        stroke="#F47743"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M232 54 L246 46"
        stroke="#F47743"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Form card */}
      <g filter="url(#cagEmptyShadow)">
        <rect
          x="108"
          y="58"
          width="124"
          height="132"
          rx="14"
          fill="#FFFFFF"
          stroke="#DCE3F5"
          strokeWidth="1.5"
        />
      </g>
      <rect x="128" y="78" width="56" height="8" rx="4" fill="#C8D4F8" />
      <rect x="128" y="100" width="84" height="12" rx="6" fill="#E5EBFF" />
      <rect x="128" y="122" width="84" height="12" rx="6" fill="#E5EBFF" />
      <rect x="128" y="152" width="48" height="18" rx="6" fill="#F47743" />

      {/* Speaker badge */}
      <circle cx="214" cy="168" r="28" fill="#1717A6" />
      <circle cx="214" cy="168" r="28" fill="url(#cagSpeakerGlow)" opacity="0.35" />
      <path
        d="M203 160.5v15c0 .8.6 1.2 1.3.8l6.2-3.5c2.4 2.2 5.5 3.5 8.8 3.5.9 0 1.6-.7 1.6-1.6v-13.4c0-.9-.7-1.6-1.6-1.6-3.3 0-6.4 1.3-8.8 3.5l-6.2-3.5c-.7-.4-1.3 0-1.3.8Z"
        fill="#FFFFFF"
      />
      <path
        d="M226.5 158.2c2.1 2.1 3.3 4.9 3.3 7.8s-1.2 5.7-3.3 7.8"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />

      <defs>
        <filter
          id="cagEmptyShadow"
          x="98"
          y="52"
          width="144"
          height="152"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="8"
            floodColor="#1717A6"
            floodOpacity="0.12"
          />
        </filter>
        <radialGradient
          id="cagSpeakerGlow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(214 168) rotate(90) scale(28)"
        >
          <stop stopColor="#5F7CF2" />
          <stop offset="1" stopColor="#1717A6" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7.2 5.5 4 10l3.2 4.5M12.8 5.5 16 10l-3.2 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InitialEmptyState() {
  return (
    <div className="cag-empty">
      <EmptyStateIllustration />
      <h2 className="cag-empty__title">No submissions yet</h2>
      <p className="cag-empty__text">
        Submissions from your storefront forms will appear here once customers
        submit them.
      </p>
      <div className="cag-empty__actions">
        <Link className="cag-btn cag-btn--accent" to="/app/installation">
          <CodeIcon />
          View installation guide
        </Link>
      </div>
    </div>
  );
}

export function NoMatchingEmptyState({ onClear }) {
  return (
    <div className="cag-empty cag-empty--compact">
      <h2 className="cag-empty__title cag-empty__title--sm">
        No matching submissions
      </h2>
      <p className="cag-empty__text">
        Try adjusting your search or filters to find what you&apos;re looking
        for.
      </p>
      <div className="cag-empty__actions">
        <button type="button" className="cag-btn" onClick={onClear}>
          Clear filters
        </button>
      </div>
    </div>
  );
}
