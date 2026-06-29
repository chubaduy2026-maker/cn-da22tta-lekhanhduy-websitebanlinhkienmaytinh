import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBell,
  FiChevronRight,
  FiCommand,
  FiFileText,
  FiGrid,
  FiHome,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiSearch,
  FiSettings,
  FiShoppingBag,
  FiStar,
  FiTag,
  FiUsers,
  FiVideo,
} from 'react-icons/fi';
import { RiRobot2Line } from 'react-icons/ri';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isStaff } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAdmin() && !isStaff()) {
      navigate('/');
    }
  }, [isAdmin, isStaff, navigate]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Đăng xuất',
      text: 'Bạn có chắc muốn đăng xuất?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#6d5efc',
    });

    if (result.isConfirmed) {
      logout();
      navigate('/');
    }
  };

  const menuItems = [
    { id: 'dashboard', path: '/admin', icon: FiBarChart2, label: 'Dashboard', exact: true, roles: ['admin', 'staff'], section: 'dashboard' },
    { id: 'products', path: '/admin/products', icon: FiPackage, label: 'Sản phẩm', roles: ['admin'], section: 'management' },
    { id: 'categories', path: '/admin/categories', icon: FiGrid, label: 'Danh mục', roles: ['admin'], section: 'management' },
    { id: 'orders', path: '/admin/orders', icon: FiShoppingBag, label: 'Đơn hàng', roles: ['admin', 'staff'], section: 'management' },
    { id: 'users', path: '/admin/users', icon: FiUsers, label: 'Người dùng', roles: ['admin'], section: 'management' },
    { id: 'coupons', path: '/admin/coupons', icon: FiTag, label: 'Mã giảm giá', roles: ['admin', 'staff'], section: 'management' },
    { id: 'reviews', path: '/admin/reviews', icon: FiStar, label: 'Đánh giá', roles: ['admin', 'staff'], section: 'management' },
    { id: 'video-reviews', path: '/admin/video-reviews', icon: FiVideo, label: 'Video review', roles: ['admin'], section: 'management' },
    { id: 'tech-news', path: '/admin/tech-news', icon: FiFileText, label: 'Tin tức công nghệ', roles: ['admin'], section: 'management' },
    { id: 'ai', path: '/admin/ai', icon: RiRobot2Line, label: 'AI Assistant', roles: ['admin'], section: 'workspace' },
  ];

  const navSections = [
    { id: 'dashboard', title: 'DASHBOARDS' },
    { id: 'management', title: 'PAGES' },
    { id: 'workspace', title: 'USER INTERFACE' },
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }

    return location.pathname.startsWith(path);
  };

  const getAllowedItems = (sectionId) => menuItems.filter((item) => {
    if (item.section !== sectionId) {
      return false;
    }

    if (isAdmin()) {
      return true;
    }

    return isStaff() && item.roles.includes('staff');
  });

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 992) {
      setSidebarOpen(false);
    }
  };

  const pageMeta = () => {
    const matchedItem = menuItems.find((item) => isActive(item.path, item.exact));

    if (matchedItem) {
      return {
        title: matchedItem.label,
        caption: matchedItem.section === 'dashboard' ? 'Tổng quan hệ thống' : 'Không gian quản trị TechStore',
      };
    }

    return {
      title: 'Trang quản trị',
      caption: 'Không gian quản lý tập trung',
    };
  };

  const renderMenuItem = (item) => (
    <Link
      key={item.path}
      to={item.path}
      className={`nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
      onClick={closeSidebarOnMobile}
    >
      <span className="nav-icon-wrap">
        <item.icon className="nav-icon" />
      </span>
      <span className="nav-label">{item.label}</span>
      <FiChevronRight className="nav-chevron" />
    </Link>
  );

  if (!isAdmin() && !isStaff()) {
    return null;
  }

  const currentPage = pageMeta();
  const avatarSource = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${user.avatar}`)
    : '/img/img-admin-logo/ADMIN.png';

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <button
          type="button"
          className="admin-mobile-overlay"
          aria-label="Đóng menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar z-40 ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-shortcut">
          <FiCommand />
          <span>Tìm nhanh</span>
          <strong>Ctrl K</strong>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => {
            const items = getAllowedItems(section.id);

            if (!items.length) {
              return null;
            }

            return (
              <div key={section.id} className="nav-section">
                <p className="nav-section-title">{section.title}</p>
                <div className="nav-section-items">
                  {items.map((item) => renderMenuItem(item))}
                </div>
              </div>
            );
          })}

          <div className="nav-section nav-utilities">
            <p className="nav-section-title">UTILITY</p>
            <Link to="/" className="nav-item" onClick={closeSidebarOnMobile}>
              <span className="nav-icon-wrap">
                <FiHome className="nav-icon" />
              </span>
              <span className="nav-label">Trang chủ</span>
              <FiChevronRight className="nav-chevron" />
            </Link>
            <button type="button" onClick={handleLogout} className="nav-item logout-btn">
              <span className="nav-icon-wrap">
                <FiLogOut className="nav-icon" />
              </span>
              <span className="nav-label">Đăng xuất</span>
              <FiChevronRight className="nav-chevron" />
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">
              <img
                src={avatarSource}
                alt={user?.name || 'User'}
                className="avatar-image"
                onError={(event) => {
                  event.target.src = '/img/img-admin-logo/ADMIN.png';
                }}
              />
              <span className="avatar-status" />
            </div>
            <div className="admin-details">
              <p className="admin-name">{user?.name}</p>
              <p className="admin-role">{isAdmin() ? 'Administrator' : 'Staff operator'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label="Mở hoặc đóng thanh điều hướng"
              onClick={() => setSidebarOpen((previous) => !previous)}
            >
              <FiMenu />
            </button>

            <div className="topbar-heading">
              <p>{currentPage.caption}</p>
              <h1>{currentPage.title}</h1>
            </div>
          </div>

          <div className="topbar-search-shell">
            <label className="topbar-search">
              <FiSearch />
              <input type="text" placeholder="Tìm kiếm sản phẩm, đơn hàng, khách hàng..." />
            </label>
          </div>

          <div className="topbar-actions">
            <button type="button" className="topbar-icon" aria-label="Thông báo">
              <FiBell />
            </button>
            <button type="button" className="topbar-icon" aria-label="Cài đặt">
              <FiSettings />
            </button>
            <div className="topbar-profile">
              <img
                src={avatarSource}
                alt={user?.name || 'User'}
                className="topbar-profile-avatar"
                onError={(event) => {
                  event.target.src = '/img/img-admin-logo/ADMIN.png';
                }}
              />
              <div className="topbar-profile-meta">
                <strong>{user?.name}</strong>
                <span>{isAdmin() ? 'Admin' : 'Staff'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
