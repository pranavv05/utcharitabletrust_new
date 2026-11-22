import Image, {type ImageProps} from 'next/image';

type FitPhotoProps = Omit<ImageProps, 'fill' | 'width' | 'height' | 'className'> & {src: string; alt: string};

/**
 * Shows the entire photograph inside a fixed frame without cropping it.
 * A tiny blurred copy of the same image fills the leftover space so frames
 * keep a consistent shape for square, portrait and landscape sources.
 * The parent must be `position: relative` with a defined size.
 */
export function FitPhoto({src, alt, sizes, ...props}: FitPhotoProps) {
  return (
    <>
      <Image className="fit-backdrop" src={src} alt="" aria-hidden="true" fill sizes="48px" loading="lazy" />
      <Image className="fit-main" src={src} alt={alt} fill sizes={sizes} {...props} />
    </>
  );
}
