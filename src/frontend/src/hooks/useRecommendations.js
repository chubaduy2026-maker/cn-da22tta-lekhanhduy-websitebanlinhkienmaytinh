/**
 * useRecommendations - Custom React Hook for AI Recommendation System V2
 * 
 * Provides recommendation data with automatic fallback from V2 (Python AI Service)
 * to V1 (NodeJS RecommendationService) if the advanced service is unavailable.
 * Upgraded to integrate with UserBehavior tracking model.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Hook for product-based recommendations (similar products)
 * Used on ProductDetail page
 */
export const useProductRecommendations = (productId, limit = 8) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'v2' | 'v1' | 'fallback'
  const [logId, setLogId] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    if (!productId) return;
    
    setLoading(true);
    setError(null);

    try {
      // Try V2 first (Advanced Smart Service)
      const response = await aiAPI.v2.getProductRecommendations(productId, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource(data.source || 'v2');
        setLogId(data.logId || null);
        return;
      }
    } catch (v2Error) {
      console.warn('[Recommendations V2] Fallback to V1:', v2Error.message);
    }

    try {
      // Fallback to V1
      const response = await aiAPI.getProductRecommendations(productId, 'hybrid', limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource('v1');
        return;
      }
    } catch (v1Error) {
      console.warn('[Recommendations V1] Also failed:', v1Error.message);
      setError('Không thể tải gợi ý sản phẩm');
    }

    setLoading(false);
  }, [productId, limit]);

  useEffect(() => {
    fetchRecommendations().finally(() => setLoading(false));
  }, [fetchRecommendations]);

  // Track impression of recommendations
  useEffect(() => {
    if (recommendations && recommendations.length > 0) {
      const sessionId = localStorage.getItem('sessionId');
      recommendations.forEach(async (p) => {
        try {
          await aiAPI.v2.trackInteraction({
            sessionId,
            eventType: 'recommendation_impression',
            productId: p._id || p.id,
            category: p.category,
            brand: p.brand,
            price: p.price,
            metadata: { source, page: 'product_detail' }
          });
        } catch (err) {}
      });
    }
  }, [recommendations, source]);

  // Track click on a recommended product
  const trackClick = useCallback(async (clickedProductId) => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      await aiAPI.v2.trackInteraction({
        sessionId,
        eventType: 'recommendation_click',
        productId: clickedProductId,
        metadata: { logId, source, page: 'product_detail' }
      });
    } catch (err) {
      // Silent fail
    }
  }, [logId, source]);

  return { recommendations, loading, error, source, trackClick, refetch: fetchRecommendations };
};

/**
 * Hook for user personalized recommendations
 * Used on Home page for logged-in users
 */
export const useUserRecommendations = (userId, limit = 12) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [logId, setLogId] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await aiAPI.v2.getUserRecommendations(userId, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource(data.source || 'v2');
        setLogId(data.logId || null);
        setLoading(false);
        return;
      }
    } catch (v2Error) {
      console.warn('[User Recommendations V2] Fallback:', v2Error.message);
    }

    try {
      const response = await aiAPI.getUserRecommendations(limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource('v1');
      }
    } catch (v1Error) {
      setError('Không thể tải gợi ý cá nhân');
    }

    setLoading(false);
  }, [userId, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Track impression of recommendations
  useEffect(() => {
    if (recommendations && recommendations.length > 0) {
      const sessionId = localStorage.getItem('sessionId');
      recommendations.forEach(async (p) => {
        try {
          await aiAPI.v2.trackInteraction({
            sessionId,
            eventType: 'recommendation_impression',
            productId: p._id || p.id,
            category: p.category,
            brand: p.brand,
            price: p.price,
            metadata: { source, page: 'home' }
          });
        } catch (err) {}
      });
    }
  }, [recommendations, source]);

  const trackClick = useCallback(async (clickedProductId) => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      await aiAPI.v2.trackInteraction({
        sessionId,
        eventType: 'recommendation_click',
        productId: clickedProductId,
        metadata: { logId, source, page: 'home' }
      });
    } catch (err) { /* silent */ }
  }, [logId, source]);

  return { recommendations, loading, error, source, trackClick, refetch: fetchRecommendations };
};

/**
 * Hook for cart-based recommendations (cross-sell)
 * Used on Cart page
 */
export const useCartRecommendations = (cartItems, limit = 6) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null);
  const prevCartRef = useRef(null);

  const fetchRecommendations = useCallback(async () => {
    if (!cartItems || cartItems.length === 0) {
      setRecommendations([]);
      return;
    }

    const cartKey = cartItems.map(i => i.product?._id || i.productId || i._id || i).sort().join(',');
    if (prevCartRef.current === cartKey) return;
    prevCartRef.current = cartKey;

    setLoading(true);

    const itemsPayload = cartItems.map(item => ({
      productId: item.product?._id || item.productId || item._id || item,
      quantity: item.quantity || 1
    }));

    try {
      const response = await aiAPI.v2.getCartRecommendations(itemsPayload, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource(data.source || 'v2');
        setLoading(false);
        return;
      }
    } catch (v2Error) {
      console.warn('[Cart Recommendations V2] Fallback:', v2Error.message);
    }

    try {
      const response = await aiAPI.getCartRecommendations(itemsPayload, limit);
      const data = response.data;
      
      if (data.success && data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        setSource('v1');
      }
    } catch (v1Error) {
      console.warn('[Cart Recommendations V1] Also failed');
    }

    setLoading(false);
  }, [cartItems, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Track impression of recommendations
  useEffect(() => {
    if (recommendations && recommendations.length > 0) {
      const sessionId = localStorage.getItem('sessionId');
      recommendations.forEach(async (p) => {
        try {
          await aiAPI.v2.trackInteraction({
            sessionId,
            eventType: 'recommendation_impression',
            productId: p._id || p.id,
            category: p.category,
            brand: p.brand,
            price: p.price,
            metadata: { source, page: 'cart' }
          });
        } catch (err) {}
      });
    }
  }, [recommendations, source]);

  return { recommendations, loading, source };
};

/**
 * Hook for trending/popular products
 * Used on Home page
 */
export const useTrendingProducts = (limit = 12, category = null) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);

      try {
        const response = await aiAPI.v2.getTrending(limit, category);
        const data = response.data;
        
        if (data.success && data.recommendations?.length > 0) {
          setProducts(data.recommendations);
          setSource(data.source || 'v2');
          setLoading(false);
          return;
        }
      } catch (v2Error) {
        console.warn('[Trending V2] Fallback:', v2Error.message);
      }

      try {
        const response = await aiAPI.getPopularProducts(limit, category);
        const data = response.data;
        
        if (data.success && data.recommendations?.length > 0) {
          setProducts(data.recommendations);
          setSource('v1');
        }
      } catch (v1Error) {
        console.warn('[Trending V1] Also failed');
      }

      setLoading(false);
    };

    fetchTrending();
  }, [limit, category]);

  return { products, loading, source };
};

/**
 * Hook for best-seller products based on actual purchase data
 * Used on Home page
 */
export const useBestSellerProducts = (limit = 12, days = 30) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  useEffect(() => {
    const fetchBestSellers = async () => {
      setLoading(true);
      try {
        const response = await aiAPI.v2.getBestSellers(limit, days);
        const data = response.data;
        if (data.success && data.recommendations?.length > 0) {
          setProducts(data.recommendations);
          setSource('order-aggregation');
        }
      } catch (err) {
        console.warn('[BestSellers] Error:', err.message);
      }
      setLoading(false);
    };

    fetchBestSellers();
  }, [limit, days]);

  return { products, loading, source };
};

/**
 * Hook for tracking user interactions (view, click, add_to_cart, purchase)
 * Used across all pages
 */
export const useInteractionTracker = () => {
  const { user } = useAuth();

  const trackInteraction = useCallback(async (eventType, productId, data = {}) => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      await aiAPI.v2.trackInteraction({
        userId: user?._id || null,
        sessionId,
        eventType,
        productId: productId || null,
        keyword: data.keyword || '',
        category: data.category || '',
        brand: data.brand || '',
        price: Number(data.price) || 0,
        metadata: data.metadata || {}
      });
    } catch (err) {
      // Silent fail
    }
  }, [user]);

  const trackView = useCallback((product) => {
    if (!product) return;
    const isString = typeof product === 'string';
    const productId = isString ? product : (product._id || product.id);
    trackInteraction('view_product', productId, {
      category: isString ? '' : product.category,
      brand: isString ? '' : product.brand,
      price: isString ? 0 : product.price
    });
  }, [trackInteraction]);
  
  const trackClick = useCallback((product, source = '') => {
    if (!product) return;
    const isString = typeof product === 'string';
    const productId = isString ? product : (product._id || product.id);
    trackInteraction('click_product', productId, {
      category: isString ? '' : product.category,
      brand: isString ? '' : product.brand,
      price: isString ? 0 : product.price,
      metadata: { source }
    });
  }, [trackInteraction]);
  
  const trackAddToCart = useCallback((product, quantity = 1) => {
    if (!product) return;
    const isString = typeof product === 'string';
    const productId = isString ? product : (product._id || product.id);
    trackInteraction('add_to_cart', productId, {
      category: isString ? '' : product.category,
      brand: isString ? '' : product.brand,
      price: isString ? 0 : product.price,
      metadata: { quantity }
    });
  }, [trackInteraction]);
  
  const trackPurchase = useCallback((product, quantity = 1) => {
    if (!product) return;
    const isString = typeof product === 'string';
    const productId = isString ? product : (product._id || product.id);
    trackInteraction('purchase_product', productId, {
      category: isString ? '' : product.category,
      brand: isString ? '' : product.brand,
      price: isString ? 0 : product.price,
      metadata: { quantity }
    });
  }, [trackInteraction]);

  const trackSearchKeyword = useCallback((keyword) => {
    trackInteraction('search_keyword', null, { keyword });
  }, [trackInteraction]);

  return { trackView, trackClick, trackAddToCart, trackPurchase, trackSearchKeyword, trackInteraction };
};

const recommendationHooks = {
  useProductRecommendations,
  useUserRecommendations,
  useCartRecommendations,
  useTrendingProducts,
  useBestSellerProducts,
  useInteractionTracker
};

export default recommendationHooks;
