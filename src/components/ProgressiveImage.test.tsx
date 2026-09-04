import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressiveImage } from './ProgressiveImage';

const SRC = 'https://cdn.example.com/hero-1.png';

describe('ProgressiveImage', () => {
  it('渲染真实的 <img> 并保留图片链接', () => {
    render(<ProgressiveImage src={SRC} alt="轮播图" />);

    const img = screen.getByAltText('轮播图') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe(SRC);
  });

  it('加载完成前展示渐进式占位层', () => {
    const { container } = render(<ProgressiveImage src={SRC} alt="轮播图" />);

    expect(container.querySelector('.progressive-image__placeholder')).not.toBeNull();
  });

  it('不使用 antd 的 progress 占位（该模式会丢弃 src，导致页面没有图片）', () => {
    const { container } = render(<ProgressiveImage src={SRC} alt="轮播图" />);

    expect(container.querySelector('.ant-image-progress')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('透传自定义样式与属性', () => {
    render(<ProgressiveImage src={SRC} alt="详情图" loading="lazy" style={{ objectFit: 'cover' }} />);

    const img = screen.getByAltText('详情图') as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.style.objectFit).toBe('cover');
    expect(img.style.display).toBe('block');
  });

  it('关闭预览，避免点击图片弹出遮罩', () => {
    const { container } = render(<ProgressiveImage src={SRC} alt="评价图" />);

    expect(container.querySelector('.ant-image-cover')).toBeNull();
  });
});
