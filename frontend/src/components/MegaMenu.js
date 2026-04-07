import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronRight, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { API_BASE_URL } from '../config/apiConfig';
import './MegaMenu.css';

// Number of items to show per column before showing "Xem thêm"
const INITIAL_ITEMS_SHOW = 5;

const MegaMenu = () => {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [expandedFilters, setExpandedFilters] = useState({}); // Track which filters are expanded
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  // Đọc category từ URL để set activeCategory
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const categoryFromURL = searchParams.get('category');
    if (categoryFromURL) {
      setActiveCategory(categoryFromURL);
    }
  }, [location.search]);

  useEffect(() => {
    if (activeCategory) {
      fetchFilters(activeCategory);
    }
  }, [activeCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      const data = await response.json();
      console.log('Categories data:', data);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      setCategories([]);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/brands/list`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch brands');
      }
      
      const data = await response.json();
      const brandsData = Array.isArray(data) ? data : [];
      
      // Đảm bảo mỗi brand là string
      const processedBrands = brandsData
        .map(brand => {
          if (typeof brand === 'string') return brand;
          if (typeof brand === 'object' && brand !== null) {
            return brand.name || brand.value || brand.label || String(brand);
          }
          return String(brand);
        })
        .filter(brand => brand && brand.trim() !== '');
      
      // Nếu không có data, dùng brands mẫu
      if (processedBrands.length === 0) {
        setBrands(['ASUS', 'ACER', 'MSI', 'LENOVO', 'DELL', 'HP']);
      } else {
        setBrands(processedBrands);
      }
    } catch (error) {
      console.error('Lỗi khi lấy thương hiệu:', error);
      setBrands(['ASUS', 'ACER', 'MSI', 'LENOVO', 'DELL', 'HP']);
    }
  };

  const fetchFilters = async (categoryName) => {
    if (!categoryName) return;
    
    try {
      const url = `${API_BASE_URL}/filters?category=${encodeURIComponent(categoryName)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Không thể tải bộ lọc, status:', response.status);
        setFilters({ [categoryName]: [] });
        return;
      }
      
      const data = await response.json();
      
      // QUAN TRỌNG: Merge vào filters state thay vì ghi đè
      setFilters(prevFilters => ({
        ...prevFilters,
        [categoryName]: Array.isArray(data) ? data : []
      }));
    } catch (error) {
      console.error('Lỗi khi lấy bộ lọc:', error);
      setFilters({ [categoryName]: [] });
    }
  };

  const handleCategoryClick = (categoryName) => {
    console.log('🖱️ MegaMenu - Category clicked:', categoryName);
    // GIỮ các filter hiện tại, chỉ thay đổi category
    const params = new URLSearchParams(location.search);
    params.set('category', categoryName);
    params.set('page', '1'); // Reset về trang 1
    const newUrl = `/?${params.toString()}`;
    console.log('🔗 Navigating to:', newUrl);
    navigate(newUrl);
    // window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBrandClick = (brand) => {
    // GIỮ các filter hiện tại, chỉ thay đổi brand
    const params = new URLSearchParams(location.search);
    params.set('brand', brand);
    params.set('page', '1'); // Reset về trang 1
    navigate(`/?${params.toString()}`);
    // window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterClick = (categoryName, filterName, value) => {
    // Map old filter names to new ones
    const filterNameMap = {
      'giatien': 'priceRange',
      'gia': 'priceRange',
      'giaban': 'priceRange'
    };
    
    const actualFilterName = filterNameMap[filterName] || filterName;
    
    // Đảm bảo value là số, không phải chữ tiếng Việt
    let actualValue = value;
    if (actualFilterName === 'priceRange') {
      // Nếu value là tiếng Việt, convert sang số
      const priceMap = {
        'dưới 15 triệu': '0-15000000',
        'từ 15 - 20 triệu': '15000000-20000000',
        'trên 20 triệu': '20000000-999999999'
      };
      actualValue = priceMap[value.toLowerCase()] || value;
    }
    
    // GIỮ TẤT CẢ params hiện tại, chỉ thêm/sửa category và filter mới
    const params = new URLSearchParams(location.search);
    params.set('category', categoryName);
    params.set(actualFilterName, actualValue);
    params.set('page', '1');
    
    const url = `/?${params.toString()}`;
    navigate(url);
    // window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCategoryIcon = (categoryName) => {
    // Tìm category trong state để lấy icon từ database
    const category = categories.find(cat => cat.name === categoryName);
    
    if (category && category.icon) {
      // Nếu là đường dẫn ảnh
      if (category.icon.startsWith('http') || category.icon.startsWith('/')) {
        return (
          <img 
            src={category.icon} 
            alt={categoryName}
            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
            onError={(e) => e.target.style.display = 'none'}
          />
        );
      }
      // Nếu là emoji
      return category.icon;
    }
    
    // Fallback emoji nếu không có icon
    const name = categoryName.toLowerCase();
    if (name.includes('laptop')) return '💻';
    if (name.includes('pc') || name.includes('máy tính')) return '🖥️';
    if (name.includes('cpu') || name.includes('bộ xử lý')) return '⚙️';
    if (name.includes('vga') || name.includes('card')) return '🎮';
    if (name.includes('ram') || name.includes('bộ nhớ')) return '🔲';
    if (name.includes('ssd') || name.includes('ổ cứng')) return '💾';
    if (name.includes('case') || name.includes('nguồn')) return '📦';
    if (name.includes('màn hình')) return '🖼️';
    if (name.includes('bàn phím')) return '⌨️';
    if (name.includes('chuột')) return '🖱️';
    if (name.includes('tai nghe')) return '🎧';
    if (name.includes('ghế')) return '🪑';
    return '📱';
  };

  // Group filters by category
  const groupedFilters = activeCategory && filters[activeCategory] ? filters[activeCategory] : [];
  
  console.log('Active category:', activeCategory);
  console.log('All filters state:', filters);
  console.log('Grouped filters for current category:', groupedFilters);

  // Toggle expand/collapse for a filter column
  const toggleFilterExpand = (filterId) => {
    setExpandedFilters(prev => ({
      ...prev,
      [filterId]: !prev[filterId]
    }));
  };

  // Reset expanded state when category changes
  useEffect(() => {
    setExpandedFilters({});
  }, [activeCategory]);

  return (
    <div 
      className="mega-menu"
      onMouseLeave={() => {
        // Delay reset để cho phép click vào filter
        setTimeout(() => {
          setActiveCategory(null);
        }, 200);
      }}
    >
      <div className="mega-menu-container">
        <div className="mega-menu-content"
          onMouseEnter={() => {
            // Giữ activeCategory khi hover vào content
          }}
        >
          <div className="categories-list">
            {Array.isArray(categories) && categories.map((category, index) => {
              try {
                const categoryName = typeof category === 'string' ? category : (category?.name || '');
                const categoryId = typeof category === 'string' ? category : (category?._id || category?.name || `cat-${index}`);
                
                // Bỏ qua nếu không có tên category hợp lệ
                if (!categoryName || typeof categoryName !== 'string') return null;
                
                return (
                  <div
                    key={categoryId}
                    className={`category-item ${activeCategory === categoryName ? 'active' : ''}`}
                    onMouseEnter={() => {
                      setActiveCategory(categoryName);
                    }}
                    onClick={() => {
                      handleCategoryClick(categoryName);
                    }}
                  >
                    <span className="category-icon">{getCategoryIcon(categoryName)}</span>
                    <span className="category-name">{String(categoryName)}</span>
                    <FiChevronRight className="category-arrow" />
                  </div>
                );
              } catch (err) {
                console.error('Error rendering category:', category, err);
                return null;
              }
            })}
          </div>

          {/* Filters panel khi có activeCategory */}
          {activeCategory && (
            <div 
              className="filters-panel-grid"
              onMouseEnter={() => {
                // Giữ activeCategory khi hover vào filter panel
              }}
            >
              {/* Dynamic Filters - Chỉ hiển thị bộ lọc từ Admin */}
              {groupedFilters.length > 0 && groupedFilters.map((filter, filterIndex) => {
                try {
                  // Đảm bảo filter là object hợp lệ
                  if (!filter || typeof filter !== 'object') return null;
                  
                  const filterId = filter._id || `filter-${filterIndex}`;
                  const filterDisplayName = filter.displayName || filter.name || '';
                  const filterName = filter.name || '';
                  const filterOptions = Array.isArray(filter.options) ? filter.options : [];
                  
                  // Chỉ render nếu có displayName và options
                  if (!filterDisplayName || filterOptions.length === 0) return null;
                  
                  const isExpanded = expandedFilters[filterId];
                  const hasMoreItems = filterOptions.length > INITIAL_ITEMS_SHOW;
                  const displayedOptions = isExpanded ? filterOptions : filterOptions.slice(0, INITIAL_ITEMS_SHOW);

                  return (
                    <div key={filterId} className="filter-column">
                      <h5 className="filter-column-title">{String(filterDisplayName)}</h5>
                      <div className="filter-items">
                        {displayedOptions.map((option, index) => {
                          try {
                            let displayText = '';
                            let optionValue = '';
                            if (typeof option === 'string') {
                              displayText = option;
                              optionValue = option;
                            } else if (typeof option === 'object' && option !== null) {
                              displayText = String(option.label || option.value || '');
                              optionValue = String(option.value || option.label || '');
                            } else {
                              displayText = String(option);
                              optionValue = String(option);
                            }
                            if (!displayText) return null;
                            return (
                              <button
                                key={`${filterId}-opt-${index}`}
                                className="filter-item-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFilterClick(activeCategory, filterName, optionValue);
                                }}
                              >
                                {displayText}
                              </button>
                            );
                          } catch (optErr) {
                            console.error('Error rendering option:', option, optErr);
                            return null;
                          }
                        })}
                        {/* Nút Xem thêm / Thu gọn */}
                        {hasMoreItems && (
                          <button
                            className="filter-show-more"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFilterExpand(filterId);
                            }}
                          >
                            {isExpanded ? (
                              <>
                                <FiChevronUp /> Thu gọn
                              </>
                            ) : (
                              <>
                                <FiChevronDown /> Xem thêm ({filterOptions.length - INITIAL_ITEMS_SHOW})
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                } catch (filterErr) {
                  console.error('Error rendering filter:', filter, filterErr);
                  return null;
                }
              })}
                {/* Dev badge removed in production */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MegaMenu;
