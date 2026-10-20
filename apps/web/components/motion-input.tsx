"use client";

import { useEffect } from "react";

/** Keep pointer feedback subtle without delaying keyboard interactions. */
export function MotionInput() {
  useEffect(() => {
    const root = document.documentElement;
    const onPointerDown = () => {
      root.dataset.motionInput = "pointer";
    };
    const onKeyDown = () => {
      root.dataset.motionInput = "keyboard";
    };

    root.dataset.motionInput = "keyboard";
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      delete root.dataset.motionInput;
    };
  }, []);

  return null;
}
