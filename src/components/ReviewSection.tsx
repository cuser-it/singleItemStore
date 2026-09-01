import { Star } from 'lucide-react';
import type { Review } from '../data/types';

type ReviewSectionProps = {
  reviews: Review[];
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="stars" aria-label={`${rating} 星评价`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={14} fill={index < rating ? 'currentColor' : 'none'} />
      ))}
    </div>
  );
}

export function ReviewSection({ reviews }: ReviewSectionProps) {
  const tags = Array.from(new Set(reviews.flatMap((review) => review.tags)));

  return (
    <div className="reviews">
      <div className="review-tags" aria-label="精选评价标签">
        {tags.map((tag) => (
          <span className="pill pill--accent" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <div className="review-list">
        {reviews.map((review) => (
          <article className="review-card" key={review.id}>
            <header className="review-card__head">
              <div>
                <p className="review-card__name">{review.name}</p>
                <p className="review-card__date">{review.date}</p>
              </div>
              <Stars rating={review.rating} />
            </header>

            <p className="review-card__text">{review.text}</p>

            <div className="review-card__chips">
              {review.tags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>

            {review.images?.length ? (
              <div className="review-card__images">
                {review.images.map((image) => (
                  <img src={image} alt={`${review.name} 评价图片`} key={image} loading="lazy" />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
