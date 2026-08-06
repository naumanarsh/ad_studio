"use client";

import { useEffect, useState } from "react";

/**
 * <img> that retries a few times on load failure — absorbs transient 500s
 * from the dev server compiling image routes on demand.
 */
export function RetryImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={attempt === 0 ? src : `${src}?r=${attempt}`}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (attempt < 3) {
          setTimeout(() => setAttempt((a) => a + 1), 700 * (attempt + 1));
        }
      }}
    />
  );
}
