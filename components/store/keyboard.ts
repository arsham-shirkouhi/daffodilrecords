import type { KeyboardEvent } from "react";

export function focusRecordSibling(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-record]")];
  const index = buttons.findIndex((button) => button === document.activeElement);
  if (index < 0) return;
  const next = buttons[index + (event.key === "ArrowRight" ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  next.scrollIntoView({
    inline: "center",
    block: "nearest",
    behavior: reduce ? "auto" : "smooth",
  });
}
