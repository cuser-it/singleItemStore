import type { ComponentProps } from 'react';
import Image from 'antd/es/image';

/** 加载失败时的兜底底图（浅灰方块），避免破图 icon */
const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23f1f2f4'/%3E%3C/svg%3E";

export type ProgressiveImageProps = ComponentProps<typeof Image>;

/**
 * 渐进式加载图片。
 *
 * 注意：不要使用 antd 的 `placeholder={{ progress: true }}`——antd 6 在该分支只渲染
 * Progress 占位层并直接 return，`src` 会被丢弃，页面上不会出现任何 <img>。
 * 这里采用官方 "Reload Image" 的写法：真实 src + ReactNode placeholder，
 * 图片加载中显示毛玻璃/微光占位，加载完成后由 rc-image 自动移除占位层。
 */
export function ProgressiveImage({ className, style, ...props }: ProgressiveImageProps) {
  return (
    <Image
      {...props}
      className={className}
      preview={false}
      placeholder={<div className="progressive-image__placeholder" aria-hidden="true" />}
      fallback={FALLBACK_IMAGE}
      style={{ display: 'block', ...style }}
    />
  );
}

export default ProgressiveImage;
