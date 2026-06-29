import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import RecommendationSection from '../components/RecommendationSection';
import VideoReviewSection from '../components/VideoReviewSection';
import { useTrendingProducts, useUserRecommendations, useBestSellerProducts, useInteractionTracker } from '../hooks/useRecommendations';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/apiConfig';
import './Home.css';

const Home = ({ searchQuery }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    priceRange: '',
    page: 1,
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [dynamicFilters, setDynamicFilters] = useState([]); // Bộ lọc động từ database
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [showAllSubcategories, setShowAllSubcategories] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
  });
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedCategories] = useState([]); // Track expanded category descriptions
  const [expandedColumns, setExpandedColumns] = useState([]); // Track expanded filter columns

  // === AI Recommendation Hooks ===
  const { user } = useAuth();
  const { products: trendingProducts, loading: trendingLoading, source: trendingSource } = useTrendingProducts(12);
  const { products: bestSellers, loading: bestSellersLoading, source: bestSellersSource } = useBestSellerProducts(12, 30);
  const { recommendations: personalRecs, loading: personalLoading, source: personalSource, trackClick } = useUserRecommendations(user?._id, 12);
  const { trackSearchKeyword } = useInteractionTracker();

  const bannerImages = [
    '/img/img-banner-dai/gearvn-laptop-gaming-t8-header-banner.png',
    '/img/img-banner-dai/gearvn-pc-gvn-rtx-5060-t9-header-banner.png',
    '/img/img-banner-dai/thang_04_pc_banner_web_collection_1920x420.jpg',
  ];

  const totalSlides = bannerImages.length;

  // Auto slide banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000); // Chuyển slide mỗi 5 giây

    return () => clearInterval(interval);
  }, [totalSlides]);

  // Scroll reveal animation using IntersectionObserver for lightweight scroll effects
  useEffect(() => {
    const revealElements = document.querySelectorAll('.scroll-reveal');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    revealElements.forEach(element => observer.observe(element));
    
    return () => {
      revealElements.forEach(element => {
        try {
          observer.unobserve(element);
        } catch (e) {
          // ignore
        }
      });
    };
  }, [products]);

  // Đọc URL parameters và GỌI API NGAY LẬP TỨC
  useEffect(() => {
    const loadProducts = async () => {
      const params = new URLSearchParams(location.search);
      const newFilters = {
        category: params.get('category') || '',
        brand: params.get('brand') || '',
        priceRange: params.get('priceRange') || '',
        page: parseInt(params.get('page')) || 1,
      };

      // Load subcategories từ URL
      const subcategoryParam = params.get('subcategory');
      if (subcategoryParam) {
        const subs = subcategoryParam.split(',').filter(s => s.trim());
        setSelectedSubcategories(subs);
        newFilters.subcategory = subcategoryParam;
      } else {
        setSelectedSubcategories([]);
      }

      // Fetch subcategories nếu có category
      if (newFilters.category) {
        fetchSubcategories(newFilters.category);
      }

      // Thêm các bộ lọc động khác từ URL
      params.forEach((value, key) => {
        if (!['category', 'brand', 'page', 'priceRange', 'subcategory'].includes(key)) {
          newFilters[key] = value;
        }
      });

      console.log('🔍 Home.js - URL changed, loading products with filters:', newFilters);
      setFilters(newFilters);

      // GỌI API TRỰC TIẾP NGAY TỨC KHẮC
      try {
        setLoading(true);

        const cleanFilters = Object.keys(newFilters).reduce((acc, key) => {
          if (newFilters[key] && newFilters[key] !== '') {
            acc[key] = newFilters[key];
          }
          return acc;
        }, {});

        console.log('📡 Calling API with cleanFilters:', cleanFilters);
        const response = await productAPI.getAll(cleanFilters);

        console.log('✅ API response:', response.data.products.length, 'products found');
        setProducts(response.data.products);
        setPagination({
          currentPage: response.data.currentPage,
          totalPages: response.data.totalPages,
          totalProducts: response.data.totalProducts,
        });
      } catch (error) {
        console.error('❌ Error loading products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [location.search]);

  useEffect(() => {
    fetchCategories();
    fetchDynamicFilters();
  }, []);

  // Fetch dynamic filters khi category thay đổi
  useEffect(() => {
    if (filters.category) {
      fetchDynamicFilters(filters.category);
      fetchBrandsByCategory(filters.category);
    } else {
      fetchDynamicFilters();
      fetchBrands();
    }
  }, [filters.category]);

  // CHỈ xử lý search query, KHÔNG xử lý filters (filters đã được xử lý ở useEffect location.search)
  useEffect(() => {
    if (searchQuery) {
      searchProducts(searchQuery);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [searchQuery]);

  const fetchProductsWithFilters = async (filtersToUse) => {
    try {
      setLoading(true);

      // Lọc bỏ các giá trị rỗng
      const cleanFilters = Object.keys(filtersToUse).reduce((acc, key) => {
        if (filtersToUse[key] && filtersToUse[key] !== '') {
          acc[key] = filtersToUse[key];
        }
        return acc;
      }, {});

      const response = await productAPI.getAll(cleanFilters);

      setProducts(response.data.products);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalProducts: response.data.totalProducts,
      });
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    return fetchProductsWithFilters(filters);
  };

  const searchProducts = async (query) => {
    try {
      setLoading(true);
      const response = await productAPI.search(query);
      setProducts(response.data.products);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalProducts: response.data.count,
      });
      if (query) {
        trackSearchKeyword(query);
      }
    } catch (error) {
      console.error('Lỗi khi tìm kiếm:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await productAPI.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      setCategories([]);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await productAPI.getBrands();
      setBrands(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy thương hiệu:', error);
    }
  };

  const fetchBrandsByCategory = async (category) => {
    try {
      const response = await productAPI.getAll({ category, limit: 1000 });
      // Lấy danh sách thương hiệu unique từ sản phẩm trong category
      const uniqueBrands = [...new Set(
        response.data.products
          .map(p => p.brand)
          .filter(brand => brand && brand.trim() !== '')
      )].sort();
      setBrands(uniqueBrands);
    } catch (error) {
      console.error('Lỗi khi lấy thương hiệu theo danh mục:', error);
      setBrands([]);
    }
  };

  const fetchDynamicFilters = async (category = '') => {
    try {
      const url = category
        ? `${API_BASE_URL}/filters?category=${category}`
        : `${API_BASE_URL}/filters`;

      const response = await fetch(url);
      const data = await response.json();
      setDynamicFilters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy bộ lọc:', error);
      setDynamicFilters([]);
    }
  };

  const fetchSubcategories = async (category) => {
    if (!category) {
      setSubcategories([]);
      setSelectedSubcategories([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/categories/subcategories/${encodeURIComponent(category)}`);
      const data = await response.json();
      setSubcategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục con:', error);
      setSubcategories([]);
    }
  };

  const handleFilterChange = (key, value) => {
    if (key === 'category') {
      // Reset brand khi đổi category
      setFilters({ ...filters, category: value, brand: '', page: 1 });
    } else {
      setFilters({ ...filters, [key]: value, page: 1 });
    }
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(location.search);
    params.set('page', newPage.toString());
    navigate(`/?${params.toString()}`);

    // Scroll to top of products section
    const productsSection = document.querySelector('.products-grid');
    if (productsSection) {
      const yOffset = -100; // Offset for header
      const y = productsSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCategoryClick = (categoryName) => {
    console.log('🖱️ Sidebar - Category clicked:', categoryName);

    // Nếu click vào category đang chọn -> bỏ chọn
    if (filters.category === categoryName) {
      setSubcategories([]);
      setSelectedSubcategories([]);
      setSubcategorySearch('');
      setShowAllSubcategories(false);

      // Xóa tất cả params, quay về trang chủ
      navigate('/');
      return;
    }

    // Fetch subcategories cho category mới
    fetchSubcategories(categoryName);
    setSelectedSubcategories([]);
    setSubcategorySearch('');
    setShowAllSubcategories(false);

    // Tạo URL params mới với category được chọn
    const params = new URLSearchParams(location.search);
    params.set('category', categoryName);
    params.set('page', '1'); // Reset về trang 1

    // Xóa các filter khác khi chọn category mới
    const keysToDelete = [];
    params.forEach((value, key) => {
      if (!['category', 'page'].includes(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => params.delete(key));

    const newUrl = `/?${params.toString()}`;
    console.log('🔗 Navigating to:', newUrl);
    navigate(newUrl);

    // Scroll đến phần sản phẩm
    setTimeout(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        const offsetTop = mainContent.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSubcategoryToggle = (subcategory) => {
    const newSelected = selectedSubcategories.includes(subcategory)
      ? selectedSubcategories.filter(s => s !== subcategory)
      : [...selectedSubcategories, subcategory];

    setSelectedSubcategories(newSelected);

    // Cập nhật URL
    const params = new URLSearchParams(location.search);
    if (newSelected.length > 0) {
      params.set('subcategory', newSelected.join(','));
    } else {
      params.delete('subcategory');
    }
    params.set('page', '1');
    navigate(`/?${params.toString()}`);
  };

  const getCategoryImage = (categoryName) => {
    const name = categoryName.toLowerCase();

    // Map category names to local images - tên file không dấu
    const imageMap = {
      'laptop': '/img/img-danhmucsanpham/Laptop.png',
      'pc': '/img/img-danhmucsanpham/PC.png',
      'pc build sẵn': '/img/img-danhmucsanpham/PC.png',
      'màn hình': '/img/img-danhmucsanpham/Manhinh.jpg',
      'monitor': '/img/img-danhmucsanpham/Manhinh.jpg',
      'mainboard': '/img/img-danhmucsanpham/Mainboard.png',
      'main': '/img/img-danhmucsanpham/Mainboard.png',
      'cpu': '/img/img-danhmucsanpham/CPU.png',
      'bộ xử lý': '/img/img-danhmucsanpham/CPU.png',
      'vga': '/img/img-danhmucsanpham/VGA.jpg',
      'card': '/img/img-danhmucsanpham/VGA.jpg',
      'card màn hình': '/img/img-danhmucsanpham/VGA.jpg',
      'ram': '/img/img-danhmucsanpham/RAM.png',
      'bộ nhớ': '/img/img-danhmucsanpham/RAM.png',
      'ổ cứng': '/img/img-danhmucsanpham/Ocung.png',
      'ssd': '/img/img-danhmucsanpham/Ocung.png',
      'hdd': '/img/img-danhmucsanpham/Ocung.png',
      'case': '/img/img-danhmucsanpham/Case.png',
      'vỏ case': '/img/img-danhmucsanpham/Case.png',
      'tản nhiệt': '/img/img-danhmucsanpham/Tannhiet.png',
      'cooling': '/img/img-danhmucsanpham/Tannhiet.png',
      'nguồn': '/img/img-danhmucsanpham/Nguon.png',
      'psu': '/img/img-danhmucsanpham/Nguon.png',
      'bàn phím': '/img/img-danhmucsanpham/Banphim.jpg',
      'keyboard': '/img/img-danhmucsanpham/Banphim.jpg',
      'chuột': '/img/img-danhmucsanpham/Chuot.jpg',
      'mouse': '/img/img-danhmucsanpham/Chuot.jpg',
      'ghế': '/img/img-danhmucsanpham/Ghe.jpg',
      'chair': '/img/img-danhmucsanpham/Ghe.jpg',
      'tai nghe': '/img/img-danhmucsanpham/Tainghe.jpg',
      'headphone': '/img/img-danhmucsanpham/Tainghe.jpg',
      'headset': '/img/img-danhmucsanpham/Tainghe.jpg',
      'loa': '/img/img-danhmucsanpham/Loa.png',
      'speaker': '/img/img-danhmucsanpham/Loa.png',
      'console': '/img/img-danhmucsanpham/Console.png',
      'ps5': '/img/img-danhmucsanpham/Console.png',
      'playstation': '/img/img-danhmucsanpham/Console.png',
      'phụ kiện': '/img/img-danhmucsanpham/Phukien.png',
      'accessory': '/img/img-danhmucsanpham/Phukien.png',
      'thiết bị vp': '/img/img-danhmucsanpham/Thietbivp.png',
      'văn phòng': '/img/img-danhmucsanpham/Thietbivp.png',
      'printer': '/img/img-danhmucsanpham/Thietbivp.png',
      'sạc dp': '/img/img-danhmucsanpham/Sacdp.png',
      'sạc dự phòng': '/img/img-danhmucsanpham/Sacdp.png',
      'powerbank': '/img/img-danhmucsanpham/Sacdp.png',
    };

    // Tìm key phù hợp
    for (const [key, image] of Object.entries(imageMap)) {
      if (name.includes(key) || key.includes(name)) {
        return image;
      }
    }

    // Default image
    return 'https://via.placeholder.com/150?text=' + encodeURIComponent(categoryName);
  };

  const getPriceRangeLabel = (range) => {
    switch (range) {
      case '0-15000000':
        return 'Dưới 15 triệu';
      case '15000000-20000000':
        return 'Từ 15 - 20 triệu';
      case '20000000-999999999':
        return 'Trên 20 triệu';
      default:
        return '';
    }
  };

  // Xử lý click vào banner - navigate và scroll đến phần sản phẩm
  const handleBannerClick = (url) => {
    navigate(url);

    // Scroll đến phần sản phẩm sau khi navigate
    setTimeout(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        const offsetTop = mainContent.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    }, 300);
  };

  return (
    <div className="home">
      {/* Hero Section - Dark Gaming style */}
      {!searchQuery && (
        <div className="hero-section">
          {/* Liquid hero layers: CSS-only distortion feel, isolated to the first viewport for performance. */}
          <div className="hero-light-field" aria-hidden="true">
            <span className="hero-liquid-blob hero-liquid-blob-one"></span>
            <span className="hero-liquid-blob hero-liquid-blob-two"></span>
            <span className="hero-liquid-blob hero-liquid-blob-three"></span>
            <span className="hero-liquid-noise"></span>
            <span className="hero-light-sweep"></span>
          </div>
          <div className="container hero-container">
            <div className="hero-content">
              <span className="hero-badge">PC Gaming Gear • Linh kiện chính hãng</span>
              <h1 className="hero-title">
                Build PC hiệu năng cao <br />
                <span className="text-gradient-cyan-purple">chuẩn gaming</span>
              </h1>
              <p className="hero-description">
                GPU, CPU, RAM, SSD và gear gaming được chọn lọc cho game thủ, creator và người dùng cần một cấu hình ổn định lâu dài.
              </p>
              <div className="hero-actions">
                <button 
                  onClick={() => {
                    const productsSection = document.getElementById('products-section');
                    if (productsSection) {
                      const yOffset = -100;
                      const y = productsSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                  }} 
                  className="btn-hero btn-cyan-neon"
                >
                  Mua Ngay
                </button>
                <button 
                  onClick={() => {
                    // Mở ChatbotBox bằng cách kích hoạt click vào biểu tượng chatbot
                    const chatToggle = document.querySelector('.chatbot-toggle-btn') || document.querySelector('.chatbot-box') || document.querySelector('#chatbot-trigger');
                    if (chatToggle) {
                      chatToggle.click();
                    } else {
                      const chatbox = document.querySelector('.chatbot-container') || document.querySelector('.ai-chat-window');
                      if (chatbox) {
                        chatbox.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        // Cuộn xuống cuối trang nơi chatbot có thể ở đó
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                      }
                    }
                  }} 
                  className="btn-hero btn-outline-neon"
                >
                  Tư Vấn AI
                </button>
              </div>
              <div className="hero-trust-row">
                <span>Hàng chính hãng</span>
                <span>GPU, CPU, RAM, SSD giá tốt</span>
                <span>Tư vấn cấu hình</span>
                <span>Lắp ráp tối ưu airflow</span>
              </div>
            </div>
            
            <div className="hero-visual">
              <div className="hero-product-showcase">
                {/* Product liquid frame: soft moving masks simulate fluid displacement around the PC build. */}
                <div className="showcase-liquid-plane" aria-hidden="true">
                  <span className="liquid-ring liquid-ring-one"></span>
                  <span className="liquid-ring liquid-ring-two"></span>
                </div>
                <div className="showcase-glow"></div>
                <div className="showcase-media">
                  <span className="showcase-wave showcase-wave-one" aria-hidden="true"></span>
                  <span className="showcase-wave showcase-wave-two" aria-hidden="true"></span>
                  <img src="/img/gearvn-pc-amd-sub-t8.png" alt="PC Gaming Build" className="showcase-image" />
                </div>
                <div className="showcase-info">
                  <span className="showcase-tag">Cấu hình Gợi ý</span>
                  <h3 className="showcase-name">PC GVN GAMING VIPER</h3>
                  <div className="showcase-specs">
                    <span>RTX 5080</span>
                    <span className="divider">•</span>
                    <span>Core i9 14900K</span>
                    <span className="divider">•</span>
                    <span>32GB DDR5 RGB</span>
                  </div>
                  <div className="showcase-price-row">
                    <span className="price-label">Giá trọn bộ từ</span>
                    <span className="price-value">49.990.000đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promotional Banner with Full Slider */}
      {!searchQuery && (
        <div className="promo-banner-slider scroll-reveal">
          <div className="banner-slides-container">
            {/* 3 Slides ảnh banner */}
            {bannerImages.map((image, index) => (
              <div
                key={index}
                className={`banner-slide image-slide ${currentSlide === index ? 'active' : ''}`}
                style={{ backgroundImage: `url(${image})` }}
              />
            ))}
          </div>

          {/* Slider Controls */}
          <div className="banner-slider-dots">
            {[...Array(totalSlides)].map((_, index) => (
              <button
                key={index}
                className={`banner-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>

          <button
            className="banner-slider-arrow prev"
            onClick={() => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)}
          >
            ‹
          </button>
          <button
            className="banner-slider-arrow next"
            onClick={() => setCurrentSlide((prev) => (prev + 1) % totalSlides)}
          >
            ›
          </button>
        </div>
      )}

      {/* Promotional Cards Grid */}
      {!searchQuery && (
        <div className="promo-cards-section scroll-reveal">
          <div className="promo-cards-grid">
            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=Laptop&subcategory=Gaming')}>
              <img src="/img/gearvn-laptop-gaming-slider-bot-t8.png" alt="Laptop Gaming" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=Laptop&subcategory=H%E1%BB%8Dc%20sinh%20-%20Sinh%20vi%C3%AAn')}>
              <img src="/img/gearvn-laptop-van-phong-slider-bot-t8.png" alt="Laptop Văn Phòng" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=PC')}>
              <img src="/img/gearvn-pc-amd-sub-t8.png" alt="PC AMD" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=Chuột')}>
              <img src="/img/gearvn-gaming-gear-sub-t8.png" alt="Gaming Gear" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=Bàn%20phím')}>
              <img src="/img/gearvn-ban-phim-slider-right-t8.png" alt="Bàn Phím" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=PC')}>
              <img src="/img/gearvn-build-pc-slider-right-t8.png" alt="Build PC" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=Phụ%20kiện')}>
              <img src="/img/gearvn-gaming-gear-deal-hoi-sub-banner-t8.png" alt="Gaming Gear Deal" />
            </div>

            <div className="promo-card banner-image" onClick={() => handleBannerClick('/?category=Màn%20hình')}>
              <img src="/img/gearvn-man-hinh-sub-t8.png" alt="Màn Hình Gaming" />
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      {
        !searchQuery && (
          <div className="banner-section scroll-reveal">
            <div className="banner-content">
              <div className="banner-left">
                <img
                  src="https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800"
                  alt="PC Gaming Setup"
                  className="banner-image"
                />
              </div>
              <div className="banner-right">
                <div className="banner-badge">Chuyên Mua Bán</div>
                <h1 className="banner-title">LINH KIỆN - MÁY TÍNH</h1>
                <div className="banner-features">
                  <div className="feature-item">
                    <span className="feature-icon">✓</span>
                    <span>Uy Tín Chất Lượng</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">✓</span>
                    <span>Cam Kết Giá Rẻ Nhất</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">✓</span>
                    <span>Bảo Hành 1 đổi 1</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">✓</span>
                    <span>Tư Vấn Mua Hàng Miễn Phí</span>
                  </div>
                </div>
                <div className="banner-products">
                  <img
                    src="https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=150"
                    alt="SSD"
                    className="product-thumb"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=150"
                    alt="VR Headset"
                    className="product-thumb"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1625948515291-69613efd103f?w=150"
                    alt="Gaming Controller"
                    className="product-thumb"
                  />
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* === AI Recommendation Sections === */}
      {!searchQuery && !filters.category && (
        <>
          <RecommendationSection
            title="Sản phẩm thịnh hành"
            icon="🔥"
            products={trendingProducts}
            loading={trendingLoading}
            source={trendingSource}
          />
          <RecommendationSection
            title="Bán chạy nhất"
            icon="🏆"
            products={bestSellers}
            loading={bestSellersLoading}
            source={bestSellersSource}
          />
          <VideoReviewSection />
          {user && (
            <RecommendationSection
              title="Gợi ý cho bạn"
              icon="🤖"
              products={personalRecs}
              loading={personalLoading}
              source={personalSource}
              onProductClick={trackClick}
            />
          )}
        </>
      )}

      <div className="container">
        {searchQuery && (
          <>
            <div className="search-results-header">
              <h2>Kết quả tìm kiếm</h2>
              <p className="search-query">"{searchQuery}"</p>
              <p className="search-count">{pagination.totalProducts} sản phẩm</p>
            </div>
          </>
        )}

        {!searchQuery && (
          <>
            {filters.category && (
              <div className="category-header-section">
                <div>
                  <h2 className="category-title">{filters.category}</h2>
                  <p className="category-product-count">{pagination.totalProducts} sản phẩm</p>
                </div>
              </div>
            )}

          </>
        )}

        <div className={searchQuery ? "content-wrapper-full" : "content-wrapper scroll-reveal"}>
          {!searchQuery && (
            <aside className="sidebar">
              {/* Danh mục sản phẩm - Luôn hiển thị */}
              <div className="sidebar-categories-section">
                <h3 className="sidebar-categories-title">Danh mục sản phẩm</h3>
                <div className="sidebar-categories-grid">
                  {categories.length > 0 ? (
                    categories
                      .filter(cat => cat.isActive !== false)
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((category) => (
                        <div
                          key={category._id || category.name}
                          className={`sidebar-category-item ${filters.category === category.name ? 'active' : ''}`}
                          onClick={() => handleCategoryClick(category.name)}
                        >
                          <div className="sidebar-category-icon">
                            {category.icon ? (
                              category.icon.startsWith('http') || category.icon.startsWith('/') ? (
                                <img
                                  src={category.icon}
                                  alt={category.name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = getCategoryImage(category.name);
                                  }}
                                />
                              ) : /^[\p{Emoji}]$/u.test(category.icon) ? (
                                <span style={{ fontSize: '48px' }}>{category.icon}</span>
                              ) : (
                                <img
                                  src={getCategoryImage(category.name)}
                                  alt={category.name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(category.name);
                                  }}
                                />
                              )
                            ) : (
                              <img
                                src={getCategoryImage(category.name)}
                                alt={category.name}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(category.name);
                                }}
                              />
                            )}
                          </div>
                          <p className="sidebar-category-name">{category.name}</p>
                        </div>
                      ))
                  ) : (
                    // Fallback: Hiển thị danh mục hardcode nếu chưa load được từ API
                    [
                      'Laptop',
                      'PC',
                      'Màn hình',
                      'Mainboard',
                      'CPU',
                      'VGA',
                      'RAM',
                      'Ổ cứng',
                      'Case',
                      'Tản nhiệt',
                      'Nguồn',
                      'Bàn phím',
                      'Chuột',
                      'Ghế',
                      'Tai nghe',
                      'Loa',
                      'Console',
                      'Phụ kiện',
                      'Thiết bị VP',
                      'Sạc DP'
                    ].map((categoryName, index) => (
                      <div
                        key={index}
                        className={`sidebar-category-item ${filters.category === categoryName ? 'active' : ''}`}
                        onClick={() => handleCategoryClick(categoryName)}
                      >
                        <div className="sidebar-category-icon">
                          <img
                            src={getCategoryImage(categoryName)}
                            alt={categoryName}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(categoryName);
                            }}
                          />
                        </div>
                        <p className="sidebar-category-name">{categoryName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </aside>
          )}

          <main className="main-content" id="products-section">
            {/* Danh mục con filter - Hiển thị ở trên main content */}
            {filters.category && subcategories.length > 0 && (
              <div className="subcategories-filter-panel">
                <div className="subcategories-header">
                  <h3 className="subcategories-title">
                    <span
                      className="category-badge clickable"
                      onClick={() => handleCategoryClick(filters.category)}
                      title="Click để bỏ chọn danh mục"
                    >
                      {filters.category} ✕
                    </span>
                  </h3>

                  <div className="subcategories-actions">
                    {selectedSubcategories.length > 0 && (
                      <button
                        className="clear-all-btn"
                        onClick={() => {
                          setSelectedSubcategories([]);
                          const params = new URLSearchParams(location.search);
                          params.delete('subcategory');
                          params.set('page', '1');
                          navigate(`/?${params.toString()}`);
                        }}
                      >
                        ✕ Xóa tất cả ({selectedSubcategories.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="subcategories-columns">
                  {(() => {
                    // Định nghĩa các nhóm
                    const groupDefinitions = {
                      brands: {
                        title: 'Thương hiệu',
                        color: '#2563eb',
                        tags: ['ASUS', 'ASUS ROG', 'ASUS TUF', 'ACER', 'ACER Predator', 'ACER Aspire', 'MSI', 'MSI Gaming', 'MSI MAG', 'MSI MPG', 'DELL', 'DELL Alienware', 'DELL XPS', 'HP', 'HP Omen', 'HP Pavilion', 'LENOVO', 'Lenovo Legion', 'Lenovo ThinkPad', 'Apple Macbook', 'Macbook Air', 'Macbook Pro', 'GIGABYTE', 'GIGABYTE AORUS', 'LG', 'LG UltraGear', 'LG Gram', 'Samsung', 'Samsung Odyssey', 'ViewSonic', 'BenQ', 'AOC', 'ASROCK', 'BIOSTAR', 'CORSAIR', 'G.SKILL', 'Kingston', 'TeamGroup', 'ADATA', 'Crucial', 'Western Digital', 'Seagate', 'NZXT', 'Cooler Master', 'Lian Li', 'Thermaltake', 'Phanteks', 'be quiet!', 'Noctua', 'DeepCool', 'ID-COOLING', 'Razer', 'Logitech', 'SteelSeries', 'HyperX']
                      },
                      purposes: {
                        title: 'Nhu cầu',
                        color: '#16a34a',
                        tags: ['Gaming', 'Gaming cao cấp', 'Gaming RTX', 'Gaming GTX', 'Văn phòng', 'Học tập - Sinh viên', 'Đồ họa - Render', 'Đồ họa', 'Thiết kế', 'Streaming', 'Workstation', 'Mỏng nhẹ', 'Ultrabook', 'Laptop Gaming', 'Laptop AI', 'Laptop đồ họa', 'Laptop Sinh viên', 'Laptop Văn Phòng', 'Laptop cảm ứng 2 in 1', 'Laptop mỏng nhẹ']
                      },
                      specs: {
                        title: 'Cấu hình',
                        color: '#9333ea',
                        tags: ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'Intel Ultra 5', 'Intel Ultra 7', 'Intel Ultra 9', 'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'AMD Ryzen AI', 'Apple M1', 'Apple M2', 'Apple M3', 'Laptop i5', 'Laptop i7', 'Laptop i9', 'Laptop Ryzen 5', 'Laptop Ryzen 7', 'Laptop Ultra 5', 'Laptop Ultra 7']
                      },
                      screens: {
                        title: 'Màn hình',
                        color: '#ea580c',
                        tags: ['Full HD', '2K QHD', '4K UHD', '60Hz', '75Hz', '144Hz', '155Hz', '160Hz', '165Hz', '180Hz', '200Hz', '210Hz', '220Hz', '230Hz', '240Hz', '360Hz', 'IPS', 'VA', 'TN', 'OLED', 'Cong', 'Phẳng', 'G-Sync', 'FreeSync', '23.8 inch', '24 inch', '27 inch', '32 inch', '34 inch Ultrawide', '49 inch Super Ultrawide']
                      },
                      prices: {
                        title: 'Mức giá',
                        color: '#dc2626',
                        pattern: /^(Dưới|Từ|Trên)\s+\d+/i
                      }
                    };

                    // Phân loại subcategories vào các nhóm
                    const groups = {
                      brands: [],
                      purposes: [],
                      specs: [],
                      screens: [],
                      prices: [],
                      others: []
                    };

                    subcategories.forEach(sub => {
                      if (groupDefinitions.prices.pattern.test(sub)) {
                        groups.prices.push(sub);
                      } else if (groupDefinitions.brands.tags.includes(sub)) {
                        groups.brands.push(sub);
                      } else if (groupDefinitions.purposes.tags.includes(sub)) {
                        groups.purposes.push(sub);
                      } else if (groupDefinitions.specs.tags.includes(sub)) {
                        groups.specs.push(sub);
                      } else if (groupDefinitions.screens.tags.includes(sub)) {
                        groups.screens.push(sub);
                      } else {
                        groups.others.push(sub);
                      }
                    });

                    // Render từng cột với giới hạn hiển thị
                    const VISIBLE_ITEMS = 5; // Số item hiển thị mặc định

                    const toggleColumnExpand = (groupKey) => {
                      setExpandedColumns(prev =>
                        prev.includes(groupKey)
                          ? prev.filter(k => k !== groupKey)
                          : [...prev, groupKey]
                      );
                    };

                    const renderColumn = (groupKey, groupData) => {
                      if (groupData.length === 0) return null;
                      const def = groupDefinitions[groupKey] || { title: 'Khác', color: '#6b7280' };
                      const isExpanded = expandedColumns.includes(groupKey);
                      const visibleData = isExpanded ? groupData : groupData.slice(0, VISIBLE_ITEMS);
                      const hasMore = groupData.length > VISIBLE_ITEMS;

                      return (
                        <div key={groupKey} className="filter-column">
                          <h4 className="filter-column-title" style={{ color: def.color }}>
                            {def.title}
                          </h4>
                          <ul className="filter-column-list">
                            {visibleData.map((sub, index) => (
                              <li
                                key={index}
                                className={`filter-column-item ${selectedSubcategories.includes(sub) ? 'active' : ''}`}
                                onClick={() => handleSubcategoryToggle(sub)}
                              >
                                {sub}
                              </li>
                            ))}
                          </ul>
                          {hasMore && (
                            <button
                              className="filter-column-toggle"
                              onClick={() => toggleColumnExpand(groupKey)}
                              style={{ borderColor: def.color, color: def.color }}
                            >
                              {isExpanded ? (
                                <>Thu gọn <span className="toggle-icon">▲</span></>
                              ) : (
                                <>Xem thêm ({groupData.length - VISIBLE_ITEMS}) <span className="toggle-icon">▼</span></>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        {renderColumn('brands', groups.brands)}
                        {renderColumn('purposes', groups.purposes)}
                        {renderColumn('specs', groups.specs)}
                        {renderColumn('screens', groups.screens)}
                        {renderColumn('prices', groups.prices)}
                        {renderColumn('others', groups.others)}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {loading ? (
              <div className="loading">Đang tải...</div>
            ) : products.length > 0 ? (
              <>
                <div className={searchQuery ? "products-search-grid" : "products-grid"}>
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                {!searchQuery && pagination.totalPages > 1 && (
                  <nav className="pagination" aria-label="Phân trang sản phẩm">
                    <button
                      disabled={pagination.currentPage === 1}
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      className="pagination-btn"
                    >
                      ← Trước
                    </button>

                    <div className="pagination-numbers">
                      {(() => {
                        const pages = [];
                        const maxVisible = 5;
                        let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisible / 2));
                        let endPage = Math.min(pagination.totalPages, startPage + maxVisible - 1);

                        if (endPage - startPage < maxVisible - 1) {
                          startPage = Math.max(1, endPage - maxVisible + 1);
                        }

                        if (startPage > 1) {
                          pages.push(
                            <button
                              key={1}
                              onClick={() => handlePageChange(1)}
                              className="pagination-number"
                              aria-label="Trang 1"
                            >
                              1
                            </button>
                          );
                          if (startPage > 2) {
                            pages.push(<span key="dots1" className="pagination-dots">...</span>);
                          }
                        }

                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => handlePageChange(i)}
                              className={`pagination-number ${i === pagination.currentPage ? 'active' : ''}`}
                              aria-label={`Trang ${i}`}
                              aria-current={i === pagination.currentPage ? 'page' : undefined}
                            >
                              {i}
                            </button>
                          );
                        }

                        if (endPage < pagination.totalPages) {
                          if (endPage < pagination.totalPages - 1) {
                            pages.push(<span key="dots2" className="pagination-dots">...</span>);
                          }
                          pages.push(
                            <button
                              key={pagination.totalPages}
                              onClick={() => handlePageChange(pagination.totalPages)}
                              className="pagination-number"
                              aria-label={`Trang ${pagination.totalPages}`}
                            >
                              {pagination.totalPages}
                            </button>
                          );
                        }

                        return pages;
                      })()}
                    </div>

                    <button
                      disabled={pagination.currentPage === pagination.totalPages}
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      className="pagination-btn"
                    >
                      Sau →
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="no-products">
                <div className="no-products-icon">📦</div>
                <h3>Không tìm thấy sản phẩm nào</h3>
                {filters.category && (
                  <p>Không có sản phẩm nào trong danh mục "{filters.category}"</p>
                )}
                {(filters.brand || filters.priceRange) && (
                  <p>Thử xóa một số bộ lọc để xem thêm sản phẩm</p>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Categories Grid Section - Chỉ hiển thị ở trang chủ khi chưa lọc */}
        {!searchQuery && !filters.category && (
          <div className="categories-grid-section">
            <h2 className="categories-grid-title">Danh mục sản phẩm</h2>
            <div className="categories-grid">
              {categories.length > 0 ? (
                categories
                  .filter(cat => cat.isActive !== false)
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((category) => (
                    <div
                      key={category._id || category.name}
                      className="category-card"
                      onClick={() => handleCategoryClick(category.name)}
                    >
                      <div className="category-image">
                        {category.icon ? (
                          category.icon.startsWith('http') || category.icon.startsWith('/') ? (
                            <img
                              src={category.icon}
                              alt={category.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = getCategoryImage(category.name);
                              }}
                            />
                          ) : /^[\p{Emoji}]$/u.test(category.icon) ? (
                            <span style={{ fontSize: '64px' }}>{category.icon}</span>
                          ) : (
                            <img
                              src={getCategoryImage(category.name)}
                              alt={category.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/200?text=' + encodeURIComponent(category.name);
                              }}
                            />
                          )
                        ) : (
                          <img
                            src={getCategoryImage(category.name)}
                            alt={category.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/200?text=' + encodeURIComponent(category.name);
                            }}
                          />
                        )}
                      </div>
                      <h3>{category.name}</h3>
                      {category.description && (
                        <div className="category-description-wrapper">
                          <p className={`category-description ${expandedCategories.includes(category._id || category.name) ? 'expanded' : ''}`}>
                            {category.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                // Fallback categories
                [
                  'Laptop',
                  'PC',
                  'Màn hình',
                  'Mainboard',
                  'CPU',
                  'VGA',
                  'RAM',
                  'Ổ cứng',
                  'Case',
                  'Tản nhiệt',
                  'Nguồn',
                  'Bàn phím',
                  'Chuột',
                  'Ghế',
                  'Tai nghe',
                  'Loa',
                  'Console',
                  'Phụ kiện',
                  'Thiết bị VP',
                  'Sạc DP'
                ].map((categoryName, index) => (
                  <div
                    key={index}
                    className="category-card"
                    onClick={() => handleCategoryClick(categoryName)}
                  >
                    <div className="category-image">
                      <img
                        src={getCategoryImage(categoryName)}
                        alt={categoryName}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/200?text=' + encodeURIComponent(categoryName);
                        }}
                      />
                    </div>
                    <h3>{categoryName}</h3>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div >
  );
};

export default Home;
