export type HeroImage = {
  src: string;
  alt: string;
};

export type Bundle = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  saleLabel: string;
  highlight?: string;
};

export type Spec = {
  label: string;
  value: string;
};

export type Review = {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  tags: string[];
  images?: string[];
};

export type Faq = {
  question: string;
  answer: string;
};

export type Product = {
  shopName: string;
  title: string;
  subtitle: string;
  highlight: string;
  serviceNote: string;
  guarantee: string[];
  heroImages: HeroImage[];
  bundles: Bundle[];
  specs: Spec[];
  reviews: Review[];
  detailImages: string[];
  faqs: Faq[];
};
