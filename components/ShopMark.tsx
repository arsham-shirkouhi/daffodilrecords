import { shopSign, shopWords } from "@/lib/config";

export function ShopMark({ size = "header" }: { size?: "header" | "hero" }) {
  const { title, subtitle } = shopWords();
  const titleClass = size === "hero" ? "text-6xl sm:text-8xl" : "text-4xl sm:text-5xl";
  const subClass = size === "hero" ? "text-sm tracking-[0.46em] sm:text-base" : "text-xs tracking-[0.32em]";

  return (
    <span className="inline-flex flex-col leading-none">
      <span className="sr-only">{shopSign()}</span>
      <span aria-hidden className={`font-display text-leaf ${titleClass}`}>
        {title}
      </span>
      {subtitle ? (
        <span aria-hidden className={`mt-2 font-sans text-trumpet uppercase ${subClass}`}>
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}
