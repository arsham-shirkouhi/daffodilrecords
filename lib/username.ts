import { DiscogsError } from "@/lib/errors";

const USERNAME = /^[^/?#\\\s%]{1,80}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME.test(value);
}

export function assertUsername(value: string): string {
  const trimmed = value.trim();
  if (!isValidUsername(trimmed)) {
    throw new DiscogsError("That does not look like a Discogs username.", 400);
  }
  return trimmed;
}
