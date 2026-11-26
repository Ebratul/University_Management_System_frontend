"use client";

import { useState, type ReactNode } from "react";

/**
 * <img> that swaps to a fallback when the source is missing or fails to load,
 * so visitors never see a broken-image icon. Remote URLs come from the admin
 * dashboard (Cloudinary), so next/image's domain allow-list is not used.
 */
export function BrandImage({
  src,
  alt,
  className,
  fallback,
  priority = false,
  srcSet,
  sizes,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: ReactNode;
  priority?: boolean;
  /** Responsive candidates (e.g. from cloudinarySrcSet) and the slot size they fill. */
  srcSet?: string;
  sizes?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}
