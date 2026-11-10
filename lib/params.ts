export function firstParam(value: string | string[] | undefined): string | undefined {
  const found = Array.isArray(value) ? value[0] : value;
  const trimmed = found?.trim();
  return trimmed ? trimmed : undefined;
}
