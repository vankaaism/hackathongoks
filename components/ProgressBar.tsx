"use client";

import { useEffect, useRef, useState } from "react";

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const target = Math.min(100, Math.max(0, value));
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) {
      current.current = target;
      return;
    }
    const from = current.current;
    if (from === target) return;
    const start = performance.now();
    const duration = Math.min(520, 180 + Math.abs(target - from) * 6);
    let frame = 0;
    function fill(now: number) {
      const fraction = Math.min(1, (now - start) / duration);
      current.current = from + (target - from) * (1 - (1 - fraction) ** 3);
      setShown(current.current);
      if (fraction < 1) frame = requestAnimationFrame(fill);
    }
    frame = requestAnimationFrame(fill);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <div className="cermin-progress">
    <progress className="sr-only" aria-label={label} max={100} value={target}/>
    <div className="cermin-progress-track" aria-hidden>
      <span className="cermin-progress-fill" style={{ width: `${shown}%` }}/>
      <span className="cermin-progress-fill cermin-progress-static" style={{ width: `${target}%` }}/>
    </div>
    <span className="cermin-progress-number" aria-hidden>{Math.round(shown)}%</span>
    <span className="cermin-progress-static" aria-hidden>{Math.round(target)}%</span>
  </div>;
}
