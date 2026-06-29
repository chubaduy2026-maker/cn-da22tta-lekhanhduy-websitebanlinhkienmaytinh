import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiSearch, FiUser, FiLogOut, FiSettings, FiCpu, FiPackage, FiPhone, FiMenu, FiLogIn, FiMoon, FiSun } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Header.css';

const Header = ({ onSearch }) => {
  const navigate = useNavigate();
  const { getCartItemCount } = useCart();
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const dropdownRef = React.useRef(null);

  const handleClickOutside = (event) => {
    if (showUserMenu && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setShowUserMenu(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    }
  };

  const handleLogoClick = () => {
    setSearchTerm('');
    if (onSearch) {
      onSearch('');
    }
    // Scroll về đầu trang
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const handleCategoriesClick = () => {
    // Nếu không ở trang chủ, chuyển về trang chủ trước
    if (window.location.pathname !== '/') {
      navigate('/');
      // Chờ 1 chút để trang load xong rồi scroll
      setTimeout(() => {
        scrollToSidebar();
      }, 100);
    } else {
      scrollToSidebar();
    }
  };

  const scrollToSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const headerHeight = 80; // Chiều cao của header
      const sidebarTop = sidebar.getBoundingClientRect().top + window.pageYOffset - headerHeight;
      window.scrollTo({
        top: sidebarTop,
        behavior: 'smooth'
      });
    }
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo" onClick={handleLogoClick}>
            <FiCpu className="logo-icon" />
            <div className="logo-text">
              <span className="logo-title">TechStore</span>
              <span className="logo-subtitle">Linh kiện máy tính</span>
            </div>
          </Link>

          <button
            className="categories-button"
            onClick={handleCategoriesClick}
          >
            <FiMenu size={18} />
            <span>Danh mục</span>
          </button>

          <form className="search-form" onSubmit={handleSearch}>
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </form>

          <nav className="nav">
            <button
              type="button"
              className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
              onClick={toggleTheme}
              aria-label={isDark ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'}
              title={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              <span className="theme-toggle-thumb" aria-hidden="true">
                {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
              </span>
            </button>

            <a href="tel:0348137209" className="hotline-link">
              <FiPhone size={18} />
              <span>Hotline: 0348137209</span>
            </a>

            {isAuthenticated ? (
              <div className="user-menu-container" ref={dropdownRef}>
                <button
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <FiUser size={20} />
                  <span>{user?.name}</span>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-info">
                      <p className="user-name">{user?.name}</p>
                      {user?.role !== 'staff' && <p className="user-email">{user?.email}</p>}
                      <span className="user-role-badge">
                        {isAdmin() ? 'Admin' : (user?.role === 'staff' ? 'Nhân viên' : 'Khách hàng')}
                      </span>
                    </div>

                    {(isAdmin() || user?.role === 'staff') && (
                      <Link to="/admin" className="header-dropdown-item" onClick={() => setShowUserMenu(false)}>
                        <FiSettings /> Quản trị
                      </Link>
                    )}

                    <Link to="/profile" className="header-dropdown-item" onClick={() => setShowUserMenu(false)}>
                      <FiUser /> Thông tin cá nhân
                    </Link>

                    {!isAdmin() && user?.role !== 'staff' && (
                      <Link to="/my-orders" className="header-dropdown-item" onClick={() => setShowUserMenu(false)}>
                        <FiPackage /> Đơn hàng của tôi
                      </Link>
                    )}

                    <button onClick={handleLogout} className="header-dropdown-item logout">
                      <FiLogOut /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="login-button">
                <FiLogIn size={20} />
                <span>Đăng nhập</span>
                <span className="login-glow"></span>
              </Link>
            )}

            <Link to="/cart" className="cart-link">
              <FiShoppingCart size={24} />
              {getCartItemCount() > 0 && (
                <span className="cart-badge">{getCartItemCount()}</span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
