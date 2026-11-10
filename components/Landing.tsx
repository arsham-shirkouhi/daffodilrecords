"use client";

import { motion } from "framer-motion";
import { shopSign } from "@/lib/config";
import { ShopMark } from "@/components/ShopMark";

const ERROR_COPY: Record<string, string> = {
  oauth: "Discogs could not finish signing you in. Try again.",
  denied: "The Discogs authorization was cancelled.",
  config: "The shop keys are not in .env.local yet. Add them, then restart the app.",
};

function BackdropFlower({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      aria-hidden
      className={`daffodil absolute ${className}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className="petal" style={{ ["--i" as string]: index }} />
      ))}
      <span className="cup" />
    </motion.div>
  );
}

export function Landing({ error }: { error: string | null }) {
  const message = error ? ERROR_COPY[error] : null;

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <BackdropFlower className="top-10 -left-16 h-56 w-56 opacity-80" />
      <BackdropFlower className="right-[-4rem] bottom-6 h-72 w-72 opacity-70" delay={0.08} />
      <BackdropFlower className="top-1/3 right-[14%] hidden h-36 w-36 opacity-60 md:block" delay={0.16} />

      <main id="main" className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-6 text-xs tracking-[0.16em] text-leaf uppercase sm:text-sm sm:tracking-[0.28em]">In bloom · headphones optional</p>
          <div className="sign-board rounded-[2rem] px-8 py-8 sm:px-12">
            <h1>
              <ShopMark size="hero" />
            </h1>
          </div>
          <p className="mx-auto mt-8 max-w-md text-lg text-ink/80">
            A room for the records you already love. Log in and we will pull every sleeve out of your Discogs collection.
          </p>
        </motion.div>

        {message ? (
          <p role="alert" className="mt-8 max-w-md rounded-2xl border border-trumpet/30 bg-amber/30 px-4 py-3 text-sm text-trumpet">
            {message}
          </p>
        ) : null}

        <motion.div
          className="mt-10 flex w-full max-w-md flex-col gap-4"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <a
            href="/api/auth/login"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-amber px-6 text-base font-semibold text-ink shadow-[0_12px_30px_rgba(212,168,40,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ffe58a]"
          >
            <VinylMark />
            Log in with Discogs
          </a>

          <form action="/store" className="rounded-3xl border border-line bg-petal p-4 text-left shadow-[0_16px_40px_rgba(160,130,40,0.12)]">
            <label htmlFor="username" className="font-display text-lg">
              Just browse a username
            </label>
            <p className="mt-1 text-sm text-ink/65">Public collections open without an account.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="username"
                name="u"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Discogs username"
                className="h-12 flex-1 rounded-full border border-line bg-white px-4 text-ink outline-none placeholder:text-ink/40"
              />
              <button
                type="submit"
                className="h-12 rounded-full border border-leaf/40 px-5 text-sm font-semibold text-leaf transition hover:bg-leaf/10"
              >
                Open the crates
              </button>
            </div>
          </form>
        </motion.div>

        <p className="mt-12 text-xs tracking-wide text-ink/45">{shopSign()} · powered by your Discogs collection</p>
      </main>
    </div>
  );
}

function VinylMark() {
  return (
    <span aria-hidden className="relative inline-block h-5 w-5 rounded-full bg-ink shadow-[inset_0_0_0_3px_#5c6a48]">
      <span className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffe56b]" />
    </span>
  );
}
