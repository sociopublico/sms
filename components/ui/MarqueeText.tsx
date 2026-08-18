"use client";

import Link from "next/link";
import { useRef, useState } from "react";

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
  const [shift, setShift] = useState(0);

  function onEnter() {
    const wrap = wrapRef.current;
    const source = sourceRef.current;
    if (!wrap || !source) return;
    setShift(Math.max(0, source.scrollWidth - wrap.clientWidth));
  }

  const duration = Math.max(3.5, shift / 32);
  const inner =
    shift > 0 ? (
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

  const measure = (
    <span ref={sourceRef} className="invisible absolute left-0 top-0 whitespace-nowrap" aria-hidden>
      {text}
    </span>
  );

  const content = href ? (
    <Link href={href} prefetch={false} className={className}>
      {inner}
    </Link>
  ) : (
    <span className={className}>{inner}</span>
  );

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden"
      onMouseEnter={onEnter}
      onMouseLeave={() => setShift(0)}
    >
      {measure}
      {content}
    </div>
  );
}
