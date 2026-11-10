/**
 * The name on the sign. Change this one line.
 * Two words split into a serif title and a sans-serif subtitle:
 * "Daffodil Records" becomes "Daffodil" over "Records".
 */
export const SHOP_NAME = "Daffodil Records";

export function shopSign(name = SHOP_NAME): string {
  return name.trim() || "Daffodil Records";
}

export function shopWords(name = SHOP_NAME): { title: string; subtitle: string } {
  const parts = shopSign(name).split(/\s+/);
  if (parts.length < 2) return { title: shopSign(name), subtitle: "" };
  const subtitle = parts.pop() ?? "";
  return { title: parts.join(" "), subtitle };
}
