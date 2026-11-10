"use client";

import { useEffect, useRef } from "react";

/** Same WAAPI sleeve lift + disc slide used on the wall. */
export function useVinylHover(tilt = 0) {
  const frameRef = useRef<HTMLElement | null>(null);
  const hangRef = useRef<HTMLElement | null>(null);
  const discRef = useRef<HTMLElement | null>(null);
  const matRef = useRef<HTMLElement | null>(null);
  const animsRef = useRef<Animation[]>([]);

  useEffect(() => {
    return () => {
      animsRef.current.forEach((anim) => anim.cancel());
      animsRef.current = [];
    };
  }, []);

  const playHover = (hot: boolean) => {
    const frame = frameRef.current;
    const hang = hangRef.current;
    const disc = discRef.current;
    const mat = matRef.current;
    if (!frame || !disc || mat == null) return;

    const frameFrom = getComputedStyle(frame).transform;
    const hangFrom = hang ? getComputedStyle(hang).transform : "none";
    const discFrom = getComputedStyle(disc).transform;
    const matFrom = getComputedStyle(mat).transform;

    animsRef.current.forEach((anim) => {
      try {
        anim.commitStyles();
      } catch {
        /* commitStyles unavailable */
      }
      anim.cancel();
    });
    animsRef.current = [];

    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    const duration = 520;
    const frameTo = hot
      ? `rotate(${tilt}deg) translateZ(22px) translateY(-4px) scale(1.03)`
      : `rotate(${tilt}deg) translateZ(0px) translateY(0px) scale(1)`;
    const hangTo = hot ? "translateZ(2px)" : "translateZ(0px)";
    const discTo = hot
      ? "translate3d(22%, 0, -14px) scale(0.98) rotate(-3deg)"
      : "translate3d(6%, 0, -12px) scale(0.95) rotate(0deg)";
    const matTo = hot ? "translateZ(6px) rotateY(-1.5deg)" : "translateZ(4px) rotateY(0deg)";

    const orNone = (value: string, fallback: string) =>
      !value || value === "none" ? fallback : value;

    const next: Animation[] = [
      frame.animate([{ transform: orNone(frameFrom, frameTo) }, { transform: frameTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
      disc.animate([{ transform: orNone(discFrom, discTo) }, { transform: discTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
      mat.animate([{ transform: orNone(matFrom, matTo) }, { transform: matTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
    ];

    if (hang) {
      next.push(
        hang.animate([{ transform: orNone(hangFrom, hangTo) }, { transform: hangTo }], {
          duration,
          easing,
          fill: "forwards",
        }),
      );
    }

    animsRef.current = next;
  };

  return {
    frameRef,
    hangRef,
    discRef,
    matRef,
    hoverProps: {
      onPointerEnter: () => playHover(true),
      onPointerLeave: () => playHover(false),
      onFocus: () => playHover(true),
      onBlur: () => playHover(false),
    },
  };
}
