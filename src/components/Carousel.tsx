import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HeroImage } from '../data/types';

type CarouselProps = {
  images: HeroImage[];
};

export function Carousel({ images }: CarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [images.length]);

  return (
    <section className="hero" aria-label="商品主图轮播">
      <div className="hero__viewport" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((image) => (
          <figure className="hero__slide" key={image.src}>
            <img src={image.src} alt={image.alt} loading="eager" />
          </figure>
        ))}
      </div>

      <div className="hero__overlay">
        <span className="badge badge--success">商城官方自营</span>
        <span className="hero__count">{index + 1}/{images.length}</span>
      </div>

      <button className="icon-pill hero__nav hero__nav--left" type="button" onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)} aria-label="上一张">
        <ChevronLeft size={18} />
      </button>
      <button className="icon-pill hero__nav hero__nav--right" type="button" onClick={() => setIndex((current) => (current + 1) % images.length)} aria-label="下一张">
        <ChevronRight size={18} />
      </button>

      <div className="hero__dots" role="tablist" aria-label="轮播切换">
        {images.map((image, dotIndex) => (
          <button
            key={image.src}
            type="button"
            className={dotIndex === index ? 'hero__dot hero__dot--active' : 'hero__dot'}
            aria-label={`切换到第 ${dotIndex + 1} 张`}
            aria-pressed={dotIndex === index}
            onClick={() => setIndex(dotIndex)}
          />
        ))}
      </div>
    </section>
  );
}
