import { NavLink } from "react-router";

const NAV = [
  {
    to: "/app",
    end: true,
    label: "Form submissions",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect
          x="3.5"
          y="2.5"
          width="13"
          height="15"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M6.5 6.5h7M6.5 10h7M6.5 13.5h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    to: "/app/installation",
    label: "Installation",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M7.2 5.5 4 10l3.2 4.5M12.8 5.5 16 10l-3.2 4.5M11.2 4.5 8.8 15.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function ShopifyMark() {
  return (
    <svg
      className="cag-store__shopify"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#95BF47"
        d="M14.6 3.1c-.1 0-.3 0-.4.1l-1.5.5c-.2-.5-.6-1-1.4-1-.01 0-.03 0-.04 0l-.1.01C10.4 1.3 9.4.8 8.5.8c0 0-.01 0-.01 0C7.2.8 6.2 1.8 5.7 3.5L3.8 4.1C3.3 4.2 2.3 4.5 2.2 5.8c0 .1-.8 6.4-.8 6.4l11.7 2.2 5.1-1.1S14.7 3.2 14.6 3.1Zm-3.3 1.2-1.1.3c.2-.7.5-1.3.9-1.6.2.5.3 1 .2 1.3Zm-.9-2c.3 0 .5.1.8.3-.5.4-.9 1.1-1.1 2.1l-.9.3C9.5 4.1 10 2.3 10.4 2.3Zm1.6 13.1L4.6 13.7l.6-4.8 7.4 1.4-.6 5.1Z"
      />
      <path
        fill="#5E8E3E"
        d="M14.6 3.1c-.1 0-.3 0-.4.1l-.3.1c.1.7.1 1.5-.2 2.4-.4 1.4-1.1 2.3-1.9 2.7l.5 7 5.1-1.1S14.7 3.2 14.6 3.1Z"
      />
    </svg>
  );
}

export function AppShell({ shop, children }) {
  return (
    <div className="cag-shell">
      <aside className="cag-sidebar" aria-label="App navigation">
        <div className="cag-sidebar__logo">
          <img
            src="/caraudiogigant-logo-white.png"
            alt="CaraudioGigant.nl"
            width="168"
            height="55"
          />
        </div>
        <nav className="cag-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `cag-nav__item${isActive ? " is-active" : ""}`
              }
            >
              <span className="cag-nav__icon">{item.icon}</span>
              <span className="cag-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="cag-main">
        <header className="cag-header">
          <div className="cag-store" title={shop} aria-label="Connected store">
            <ShopifyMark />
            <span className="cag-store__label">{shop}</span>
            <span className="cag-store__chevron" aria-hidden="true">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path
                  d="M1 1.5 6 6.5 11 1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </header>
        <main className="cag-content">
          <div className="cag-content__inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
