type DetailGalleryProps = {
  images: string[];
};

export function DetailGallery({ images }: DetailGalleryProps) {
  return (
    <div className="detail-gallery">
      {images.map((image, index) => (
        <figure className="detail-gallery__item" key={image}>
          <img src={image} alt={`商品详情图 ${index + 1}`} loading="lazy" />
        </figure>
      ))}
    </div>
  );
}
