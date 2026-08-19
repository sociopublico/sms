"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export function MarqueeText({
  text,
  href,
  className = "",
}: {
  text: string;
  href?: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const [hover, setHover] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const source = sourceRef.current;
      if (!source) return;
      setOverflow(Math.max(0, source.scrollWidth - wrap.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, className]);

  const running = hover && overflow > 0;
  const duration = Math.max(3.5, overflow / 32);
  const inner = running ? (
    <span
      className="marquee-track inline-flex w-max whitespace-nowrap"
      style={{ animationDuration: `${duration}s` }}
    >
      <span className="pr-10">{text}</span>
      <span className="pr-10" aria-hidden>
        {text}
      </span>
    </span>
  ) : (
    <span className="block truncate">{text}</span>
  );

  const content = href ? (
    <Link href={href} prefetch={false} className={`block min-w-0 overflow-hidden ${className}`.trim()}>
      {inner}
    </Link>
  ) : (
    <span className={`block min-w-0 overflow-hidden ${className}`.trim()}>{inner}</span>
  );

  return (
    <div
      ref={wrapRef}
      className="relative min-w-0 w-full max-w-full overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        ref={sourceRef}
        className={`pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap ${className}`}
        aria-hidden
      >
        {text}
      </span>
      {content}
    </div>
  );
}
