import Image, { type ImageProps } from 'next/image';
export function TrustImage({ width = 1200, height = 900, sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw', ...props }: ImageProps) {
  return <Image width={width} height={height} sizes={sizes} {...props}/>;
}
