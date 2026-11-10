"use client";

import Link from "next/link";

export type PhoneTab = "wall" | "collection" | "wantlist" | "explore" | "scan";

function withUser(path: string, username: string | null) {
  if (!username) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}u=${encodeURIComponent(username)}`;
}

export function PhoneTabBar({
  username,
  active,
  canAdd = false,
  onAdd,
}: {
  username: string | null;
  active: PhoneTab;
  canAdd?: boolean;
  onAdd?: () => void;
}) {
  const wallHref = withUser("/store", username);
  const collectionHref = `${withUser("/store/collection", username)}#collection`;
  const wantlistHref = `${withUser("/store/collection", username)}#wishlist`;
  const exploreHref = withUser("/store/explore", username);
  const scanHref = canAdd
    ? `${withUser("/store/collection", username)}?add=scan`
    : "/api/auth/login";

  const scanButton = (
    <>
      <span className="phone-tab-scan-mark" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
          <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
          <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
          <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
          <path d="M6 12h12" />
        </svg>
      </span>
      <span className="phone-tab-label">Scan</span>
    </>
  );

  return (
    <nav className="phone-tabbar" aria-label="Primary">
      <Link
        href={wallHref}
        className={`phone-tab${active === "wall" ? " is-active" : ""}`}
        aria-current={active === "wall" ? "page" : undefined}
      >
        <span className="phone-tab-icon" aria-hidden>
          ▦
        </span>
        <span className="phone-tab-label">Wall</span>
      </Link>
      <Link
        href={collectionHref}
        className={`phone-tab${active === "collection" ? " is-active" : ""}`}
        aria-current={active === "collection" ? "page" : undefined}
      >
        <span className="phone-tab-icon" aria-hidden>
          ♫
        </span>
        <span className="phone-tab-label">Collection</span>
      </Link>

      {canAdd && onAdd ? (
        <button type="button" className="phone-tab phone-tab-scan" onClick={onAdd} aria-label="Scan or enter code">
          {scanButton}
        </button>
      ) : (
        <Link
          href={scanHref}
          className="phone-tab phone-tab-scan"
          aria-label={canAdd ? "Scan or enter code" : "Log in to scan"}
        >
          {scanButton}
        </Link>
      )}

      <Link
        href={wantlistHref}
        className={`phone-tab${active === "wantlist" ? " is-active" : ""}`}
        aria-current={active === "wantlist" ? "page" : undefined}
      >
        <span className="phone-tab-icon" aria-hidden>
          ♪
        </span>
        <span className="phone-tab-label">Wantlist</span>
      </Link>
      <Link
        href={exploreHref}
        className={`phone-tab${active === "explore" ? " is-active" : ""}`}
        aria-current={active === "explore" ? "page" : undefined}
      >
        <span className="phone-tab-icon" aria-hidden>
          ⌕
        </span>
        <span className="phone-tab-label">Explore</span>
      </Link>
    </nav>
  );
}
