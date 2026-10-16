// A PRODUCT IMAGE that degrades gracefully instead of showing the browser's
// broken-image icon.
//
// WHY. The catalogue's photography lives on the store's own CDN. If that CDN is
// slow, blocked by a corporate proxy or briefly down, every product tile would
// otherwise render as a broken-image glyph with the alt text spilling out - which
// reads as a broken store rather than a slow one. This component keeps the slot's
// shape, shows the brand mark in the muted blush the tile already uses, and never
// renders a raw error.
//
// It is deliberately NOT a retry loop: a single failed request already went
// through the browser's own retry, and hammering a failing CDN makes an outage
// worse. One attempt, then the placeholder.
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  srcSet,
  sizes,
  alt,
  className,
  loading = "lazy",
  fetchPriority,
  width,
  height,
  style,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-blush text-2xl text-gray/60",
          className,
        )}
        style={{ width, height, ...style }}
      >
        🐾
      </span>
    );
  }

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      width={width}
      height={height}
      decoding="async"
      style={style}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
