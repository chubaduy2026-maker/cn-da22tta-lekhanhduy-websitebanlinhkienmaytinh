import React, { useEffect, useState } from 'react';
import { techNewsAPI } from '../services/api';
import './TechNewsSection.css';

const TechNewsSection = ({
  title = 'Tin tức về công nghệ',
  limit = 6,
  emptyText = 'Nội dung tin tức sẽ hiển thị tại đây khi bạn thêm bài viết.',
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchNews = async () => {
      try {
        const response = await techNewsAPI.getAll(limit);
        if (mounted && response.data?.success) {
          setItems(response.data.items || []);
        }
      } catch (error) {
        console.warn('TechNews fetch error:', error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNews();
    return () => {
      mounted = false;
    };
  }, [limit]);

  return (
    <section className="tech-news-section">
      <h2 className="tech-news-title">{title}</h2>

      {loading ? (
        <div className="tech-news-placeholder">Đang tải tin tức công nghệ...</div>
      ) : items.length > 0 ? (
        <div className="tech-news-list">
          {items.map((item, index) => (
            <a
              key={`${item.title || 'news-item'}-${item._id || index}`}
              className="tech-news-item"
              href={item.articleUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.thumbnail && <img src={item.thumbnail} alt={item.title || 'Tin tuc'} loading="lazy" />}
              <div className="tech-news-item-content">
                <span>{item.title || 'Bai viet cong nghe'}</span>
                {item.source && <small>{item.source}</small>}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="tech-news-placeholder">{emptyText}</div>
      )}
    </section>
  );
};

export default TechNewsSection;
