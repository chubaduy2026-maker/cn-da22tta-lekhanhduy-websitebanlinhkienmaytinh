import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiPlay, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { videoReviewAPI } from '../services/api';
import './VideoReviewSection.css';

const VideoReviewSection = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await videoReviewAPI.getAll(8);
        if (res.data.success) {
          setVideos(res.data.videos);
        }
      } catch (err) {
        console.warn('VideoReview fetch error:', err.message);
      }
      setLoading(false);
    };
    fetchVideos();
  }, []);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  // Extract YouTube video ID from various URL formats
  const getYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const getEmbedUrl = (url) => {
    const ytId = getYouTubeId(url);
    if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;
    return url;
  };

  if (loading) {
    return (
      <div className="video-review-section">
        <h2 className="video-review-title">
          <span role="img" aria-label="icon">🎬</span> Góc review dành cho bạn
        </h2>
        <div className="video-review-scroll">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="video-card-skeleton" key={i}>
              <div className="skeleton-thumb shimmer" />
              <div className="skeleton-info">
                <div className="skeleton-text shimmer" />
                <div className="skeleton-text short shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!videos.length) return null;

  return (
    <>
      <div className="video-review-section">
        <h2 className="video-review-title">
          <span role="img" aria-label="icon">🎬</span> Góc review dành cho bạn
        </h2>

        <div className="video-review-wrapper">
          <button className="scroll-btn scroll-left" onClick={() => scroll('left')} aria-label="Scroll left">
            <FiChevronLeft />
          </button>

          <div className="video-review-scroll" ref={scrollRef}>
            {videos.map((video) => (
              <div className="video-card" key={video._id}>
                <div className="video-thumb" onClick={() => setActiveVideo(video)}>
                  <img src={video.thumbnail} alt={video.title} loading="lazy" />
                  <div className="play-overlay">
                    <div className="play-btn">
                      <FiPlay />
                    </div>
                  </div>
                  {video.reviewer && (
                    <span className="reviewer-badge">{video.reviewer}</span>
                  )}
                </div>

                <div className="video-info">
                  <p className="video-card-title" title={video.title}>{video.title}</p>
                  {video.product && (
                    <Link
                      to={`/product/${video.product._id}`}
                      className="video-product-link"
                    >
                      <img
                        src={video.product.image}
                        alt={video.product.name}
                        className="video-product-img"
                      />
                      <span className="video-product-name">{video.product.name}</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="scroll-btn scroll-right" onClick={() => scroll('right')} aria-label="Scroll right">
            <FiChevronRight />
          </button>
        </div>
      </div>

      {/* Video Modal */}
      {activeVideo && (
        <div className="video-modal-overlay" onClick={() => setActiveVideo(null)}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <button className="video-modal-close" onClick={() => setActiveVideo(null)}>
              <FiX />
            </button>
            <div className="video-modal-player">
              <iframe
                src={getEmbedUrl(activeVideo.videoUrl)}
                title={activeVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="video-modal-info">
              <h3>{activeVideo.title}</h3>
              {activeVideo.product && (
                <Link
                  to={`/product/${activeVideo.product._id}`}
                  className="video-modal-product"
                  onClick={() => setActiveVideo(null)}
                >
                  <img src={activeVideo.product.image} alt={activeVideo.product.name} />
                  <div>
                    <span className="modal-product-name">{activeVideo.product.name}</span>
                    <span className="modal-product-price">
                      {activeVideo.product.price?.toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                  <span className="modal-view-product">Xem sản phẩm →</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoReviewSection;
