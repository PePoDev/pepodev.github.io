// A responsive WebP <img> made at build time. See src/lib/images.ts for the
// srcset rules.
import type { ImgHTMLAttributes } from "react";
import { getResponsiveImage, type ImageAsset } from "@lib/images";

type ResponsiveImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "width" | "height"
> & {
  image: ImageAsset;
  /** Display width in CSS px; defaults to the image's own width. */
  width?: number;
  /** With `width`, crops to that aspect ratio (cover, centred). */
  height?: number;
  alt: string;
};

export async function ResponsiveImage({
  image,
  width,
  height,
  sizes,
  loading = "lazy",
  decoding = "async",
  ...attributes
}: ResponsiveImageProps) {
  const resolved = await getResponsiveImage(image, { width, height, sizes });
  return (
    <img
      {...attributes}
      src={resolved.src}
      srcSet={resolved.srcSet}
      sizes={resolved.sizes}
      width={resolved.width}
      height={resolved.height}
      loading={loading}
      decoding={decoding}
    />
  );
}
