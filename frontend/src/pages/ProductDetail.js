import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiArrowLeft, FiShoppingBag, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { productAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useProductRecommendations, useInteractionTracker } from '../hooks/useRecommendations';
import ProductCard from '../components/ProductCard';
import ProductReviews from '../components/ProductReviews';
import TechNewsSection from '../components/TechNewsSection';
import Swal from 'sweetalert2';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // V2 AI Recommendations with automatic V1 fallback
  const { 
    recommendations: relatedProducts, 
    source: recsSource,
    trackClick: trackRecClick 
  } = useProductRecommendations(id, 4);
  
  // Interaction tracking
  const { trackView } = useInteractionTracker();

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const response = await productAPI.getById(id);
      setProduct(response.data);
      setSelectedImage(response.data.image);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin sản phẩm:', error);
      Swal.fire('Lỗi', 'Không tìm thấy sản phẩm', 'error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchProduct();
    // Track product view for recommendation training
    if (id) trackView(id);
  }, [id, fetchProduct, trackView]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
  }, [id]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      Swal.fire('Thông báo', 'Vui lòng đăng nhập để thêm vào giỏ hàng', 'warning');
      navigate('/login');
      return;
    }

    setAdding(true);
    const result = await addToCart(product._id, quantity);

    if (result.success) {
      Swal.fire('Thành công', 'Đã thêm vào giỏ hàng!', 'success');
    } else {
      Swal.fire('Lỗi', result.message, 'error');
    }
    setAdding(false);
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      Swal.fire('Thông báo', 'Vui lòng đăng nhập để mua hàng', 'warning');
      navigate('/login');
      return;
    }

    if (product.stock === 0) return;

    // Chuyển thẳng đến trang thanh toán với thông tin sản phẩm
    navigate('/checkout', {
      state: {
        buyNowItem: {
          productId: product._id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: quantity
        }
      }
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const uniqueProductImages = useMemo(() => {
    const productImages = [product?.image, ...(product?.images || [])].filter(Boolean);
    return productImages.filter((img, index) => productImages.indexOf(img) === index);
  }, [product]);

  const handlePrevImage = () => {
    if (uniqueProductImages.length <= 1) return;
    const currentIndex = uniqueProductImages.indexOf(selectedImage);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const prevIndex = safeCurrentIndex === 0 ? uniqueProductImages.length - 1 : safeCurrentIndex - 1;
    setSelectedImage(uniqueProductImages[prevIndex]);
  };

  const handleNextImage = () => {
    if (uniqueProductImages.length <= 1) return;
    const currentIndex = uniqueProductImages.indexOf(selectedImage);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = safeCurrentIndex === uniqueProductImages.length - 1 ? 0 : safeCurrentIndex + 1;
    setSelectedImage(uniqueProductImages[nextIndex]);
  };

  useEffect(() => {
    if (uniqueProductImages.length <= 1) return undefined;

    const sliderTimer = setInterval(() => {
      setSelectedImage((currentImage) => {
        const currentIndex = uniqueProductImages.indexOf(currentImage);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = safeCurrentIndex === uniqueProductImages.length - 1 ? 0 : safeCurrentIndex + 1;
        return uniqueProductImages[nextIndex];
      });
    }, 3000);

    return () => clearInterval(sliderTimer);
  }, [uniqueProductImages]);

  const handleDescriptionToggle = () => {
    setIsDescriptionExpanded((prev) => {
      const next = !prev;

      // When collapsing, bring the user back to the top of the page.
      if (prev) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      return next;
    });
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!product) {
    return <div className="loading">Không tìm thấy sản phẩm</div>;
  }

  return (
    <div className="product-detail">
      <div className="container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Quay lại
        </button>

        <div className="product-detail-grid">
          <div className="product-image-section">
            <div className="main-image">
              <img src={selectedImage} alt={product.name} />
              {uniqueProductImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="image-nav-btn image-nav-btn-left"
                    onClick={handlePrevImage}
                    aria-label="Ảnh trước"
                  >
                    <FiChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    className="image-nav-btn image-nav-btn-right"
                    onClick={handleNextImage}
                    aria-label="Ảnh tiếp theo"
                  >
                    <FiChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {uniqueProductImages.length > 1 && (
              <div className="image-thumbnails">
                {uniqueProductImages.map((img, index) => (
                  <div
                    key={`${img}-${index}`}
                    className={`thumbnail ${selectedImage === img ? 'active' : ''}`}
                    onClick={() => setSelectedImage(img)}
                  >
                    <img src={img} alt={`${product.name} - ${index + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="product-info-section">
            <div className="brand-tag">{product.brand}</div>
            <h1 className="product-title">{product.name}</h1>

            {product.rating > 0 && (
              <div className="rating">
                ⭐ {product.rating.toFixed(1)} / 5.0
              </div>
            )}

            <div className="price-section">
              <div className="price">{formatPrice(product.price)}</div>
              <div className="stock-info">
                {product.stock > 0 ? (
                  <span className="in-stock">Còn hàng ({product.stock} sản phẩm)</span>
                ) : (
                  <span className="out-of-stock">Hết hàng</span>
                )}
              </div>
            </div>

            <div className="description">
              <h3>Mô tả sản phẩm</h3>

              <div className={`description-wrapper ${isDescriptionExpanded ? 'expanded' : ''}`}>
                <div
                  className="product-description-content"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
                <div className="description-fade-overlay" />
              </div>

              <button
                type="button"
                className="description-toggle-btn"
                onClick={handleDescriptionToggle}
              >
                {isDescriptionExpanded ? 'Thu gọn ▴' : 'Xem thêm ▸'}
              </button>
            </div>

            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <div className="specifications">
                <h3>Thông số kỹ thuật</h3>
                <table>
                  <tbody>
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <tr key={key}>
                        <td className="spec-label">{key}</td>
                        <td className="spec-value">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="purchase-section">
              <div className="quantity-selector">
                <label>Số lượng:</label>
                <div className="quantity-controls">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max={product.stock}
                  />
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="action-buttons-large">
                <button
                  className="add-to-cart-btn-large"
                  onClick={handleAddToCart}
                  disabled={adding || product.stock === 0}
                >
                  <FiShoppingCart size={20} />
                  {adding ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
                </button>

                <button
                  className="buy-now-btn-large"
                  onClick={handleBuyNow}
                  disabled={adding || product.stock === 0}
                >
                  <FiShoppingBag size={20} />
                  Mua ngay
                </button>
              </div>
            </div>
          </div>
        </div>

        <TechNewsSection limit={5} />

        {/* Sản phẩm gợi ý AI */}
        {relatedProducts.length > 0 && (
          <div className="related-products-section">
            <h2 className="related-products-title">
              <span role="img" aria-label="AI">🤖</span> Gợi ý bởi AI
              {recsSource && (
                <span className="ai-source-badge" title={`Nguồn: ${recsSource}`}>
                  {recsSource === 'python-ai' ? '⚡ Deep Learning' : recsSource === 'v2' ? '⚡ Advanced' : '📊 Classic'}
                </span>
              )}
            </h2>
            <div className="related-products-grid">
              {relatedProducts.map(relatedProduct => (
                <div key={relatedProduct._id} onClick={() => trackRecClick(relatedProduct._id)}>
                  <ProductCard product={relatedProduct} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <ProductReviews productId={id} />
      </div>
    </div>
  );
};

export default ProductDetail;
