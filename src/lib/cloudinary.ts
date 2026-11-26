/**
 * Cloudinary URL helpers. Branding images are uploaded by admins and served
 * from res.cloudinary.com; Cloudinary resizes and re-encodes on the fly when a
 * transformation segment follows "/upload/". Any other URL is returned as-is.
 */
const UPLOAD = "/image/upload/";

export function isCloudinary(src: string): boolean {
  return src.startsWith("https://res.cloudinary.com/") && src.includes(UPLOAD);
}

/** f_auto picks AVIF/WebP per browser, q_auto picks the quality, w_ caps the width (never upscales with c_limit). */
export function cloudinaryWidth(src: string, width: number): string {
  if (!isCloudinary(src)) return src;
  const [head, tail] = src.split(UPLOAD);
  // Leave URLs that already carry a transformation alone.
  if (/^[a-z]{1,3}_[^/]*\//.test(tail) && !tail.startsWith("v")) return src;
  return `${head}${UPLOAD}f_auto,q_auto,c_limit,w_${width}/${tail}`;
}

/** srcset for a full-bleed image. */
export function cloudinarySrcSet(src: string, widths: readonly number[] = [640, 960, 1280, 1920, 2560]): string | undefined {
  if (!isCloudinary(src)) return undefined;
  return widths.map((w) => `${cloudinaryWidth(src, w)} ${w}w`).join(", ");
}
