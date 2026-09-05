import { useCallback, useEffect, useRef, useState } from 'react';
import Carousel from 'antd/es/carousel';
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined';
import PauseOutlined from '@ant-design/icons/PauseOutlined';
import SoundOutlined from '@ant-design/icons/SoundOutlined';
import MutedOutlined from '@ant-design/icons/MutedOutlined';
import type { MediaAsset } from '../../shared/site';
import { resolveMediaUrl } from '../../shared/site';
import { ProgressiveImage } from './ProgressiveImage';

type HeroVideoAsset = MediaAsset & {
  kind?: 'image' | 'video';
  posterSource?: string | null;
};

type HeroImageAsset = MediaAsset & { kind?: 'image' | 'video' };

export type HeroMediaMode = 'image' | 'video';

export type HeroMediaProps = {
  mode?: HeroMediaMode;
  images: HeroImageAsset[];
  video?: HeroVideoAsset | null;
};

function mediaUrl(asset: { resolvedUrl?: string; source: string }) {
  return asset.resolvedUrl || resolveMediaUrl(asset.source);
}

function ImageHero({ images }: { images: HeroImageAsset[] }) {
  if (!images.length) {
    return <div className="hero-media__empty" role="img" aria-label="暂无商品图片" />;
  }

  return (
    <Carousel autoplay={images.length > 1} autoplaySpeed={2500} dots={images.length > 1}>
      {images.map((image, index) => (
        <div className="slide" key={image.id}>
          <ProgressiveImage
            src={mediaUrl(image)}
            alt={image.alt}
            draggable={false}
            decoding="async"
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ))}
    </Carousel>
  );
}

function VideoHero({ video }: { video: HeroVideoAsset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const wasPlayingBeforeSuspend = useRef(false);
  const [sourceRequested, setSourceRequested] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoUrl = mediaUrl(video);
  const posterUrl = video.posterSource ? resolveMediaUrl(video.posterSource) : '';

  const requestSource = useCallback(() => {
    const element = videoRef.current;
    if (!element || !videoUrl) return;
    element.src = videoUrl;
    element.load();
    setSourceRequested(true);
  }, [videoUrl]);

  const playVideo = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    try {
      const result = element.play();
      if (result && typeof result.then === 'function') {
        void result.then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!posterUrl) requestSource();
  }, [posterUrl, requestSource]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    const suspend = () => {
      wasPlayingBeforeSuspend.current = !element.paused && !element.ended;
      if (wasPlayingBeforeSuspend.current) element.pause();
    };
    const resume = () => {
      if (wasPlayingBeforeSuspend.current) {
        wasPlayingBeforeSuspend.current = false;
        playVideo();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') suspend();
      else resume();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (typeof IntersectionObserver !== 'undefined') {
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) resume();
        else suspend();
      }, { threshold: 0.1 });
      observerRef.current.observe(element);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [playVideo]);

  const handleVideoClick = () => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = false;
    setMuted(false);
    if (element.paused) playVideo();
  };

  const togglePlayback = () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) playVideo();
    else element.pause();
  };

  const toggleMuted = () => {
    const nextMuted = !muted;
    const element = videoRef.current;
    if (element) element.muted = nextMuted;
    setMuted(nextMuted);
  };

  const retry = () => {
    setVideoReady(false);
    setVideoError(false);
    setSourceRequested(false);
    const element = videoRef.current;
    if (element) {
      element.removeAttribute('src');
      element.load();
    }
    requestSource();
  };

  return (
    <div className="hero-video" data-source-requested={sourceRequested ? 'true' : 'false'}>
      <div className={videoReady ? 'hero-video__cover hero-video__cover--hidden' : 'hero-video__cover'}>
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={video.alt}
            className="hero-video__poster"
            loading="eager"
            fetchPriority="high"
            onLoad={requestSource}
            onError={requestSource}
          />
        ) : null}
      </div>
      <video
        ref={videoRef}
        className="hero-video__element"
        muted={muted}
        playsInline
        loop
        preload="metadata"
        aria-label={video.alt || '商品视频'}
        onClick={handleVideoClick}
        onLoadedData={() => {
          setVideoReady(true);
          setVideoError(false);
          playVideo();
        }}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setVideoReady(false);
          setVideoError(true);
        }}
      />
      <div className="hero-video__controls" aria-label="视频控制">
        <button type="button" onClick={togglePlayback} aria-label={playing ? '暂停播放' : '播放视频'}>
          {playing ? <PauseOutlined aria-hidden="true" /> : <PlayCircleOutlined aria-hidden="true" />}
        </button>
        <button type="button" onClick={toggleMuted} aria-label={muted ? '打开声音' : '静音'}>
          {muted ? <MutedOutlined aria-hidden="true" /> : <SoundOutlined aria-hidden="true" />}
        </button>
        {videoError ? (
          <button type="button" onClick={retry} aria-label="重试播放视频">
            重试
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function HeroMedia({ mode = 'image', images, video }: HeroMediaProps) {
  if (mode === 'video') {
    return video ? <VideoHero video={video} /> : <div className="hero-media__empty" role="img" aria-label="暂无商品视频" />;
  }
  return <ImageHero images={images} />;
}

export default HeroMedia;
