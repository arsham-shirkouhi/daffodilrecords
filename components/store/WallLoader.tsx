"use client";

export function WallLoader({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <div className="wall-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="wall-loader-card">
        <span className="wall-loader-daffodil" aria-hidden>
          <span className="wall-loader-daffodil-petals" />
          <span className="wall-loader-daffodil-cup" />
        </span>
        <p className="wall-loader-kicker">Opening the listening room</p>
        <div className="wall-loader-track" aria-hidden>
          <span className="wall-loader-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="wall-loader-copy">
          {pct < 35
            ? "Warming the plaster…"
            : pct < 70
              ? "Laying the floor & ceiling…"
              : pct < 100
                ? "Hanging the sleeves…"
                : "Ready."}{" "}
          ({pct}%)
        </p>
      </div>
    </div>
  );
}
