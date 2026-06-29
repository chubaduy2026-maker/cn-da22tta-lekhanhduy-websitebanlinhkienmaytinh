import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ChatbotBox from './components/ChatbotBox';
import GiftBox from './components/GiftBox';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import MyOrders from './pages/MyOrders';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import ZaloPayCallback from './pages/ZaloPayCallback';
import Profile from './pages/Profile';
import PolicyPage from './pages/PolicyPage';
import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import AdminProducts from './pages/Admin/AdminProducts';
import AdminCategories from './pages/Admin/AdminCategories';
import AdminOrders from './pages/Admin/AdminOrders';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminAI from './pages/Admin/AdminAI';
import AdminReviews from './pages/Admin/AdminReviews';
import AdminCoupons from './pages/Admin/AdminCoupons';
import AdminSubcategories from './pages/Admin/AdminSubcategories';
import AdminVideoReviews from './pages/Admin/AdminVideoReviews';
import AdminTechNews from './pages/Admin/AdminTechNews';
import './App.css';
import './theme-overrides.css';

// Protected Route cho Admin
const AdminRoute = ({ children }) => {
  const { isAdmin, isStaff, loading } = useAuth();

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (isAdmin() || isStaff()) ? children : <Navigate to="/login" />;
};

// Layout cho trang customer
const CustomerLayout = ({ children, onSearch }) => {
  const navigate = useNavigate();

  const handleSearchWithRedirect = (query) => {
    onSearch(query);
    if (query && window.location.pathname !== '/') {
      navigate('/');
    }
  };

  return (
    <>
      <Header onSearch={handleSearchWithRedirect} />
      <main className="customer-main">
        {children}
      </main>
      <GiftBox />
      <ChatbotBox />
      <Footer />
    </>
  );
};

function AppContent() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  return (
    <div className="App">
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Admin Routes */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/add" element={<AdminProducts openAddModal={true} />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="subcategories" element={<AdminSubcategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="video-reviews" element={<AdminVideoReviews />} />
          <Route path="tech-news" element={<AdminTechNews />} />
          <Route path="ai" element={<AdminAI />} />
        </Route>

        {/* Customer Routes */}
        <Route path="/" element={
          <CustomerLayout onSearch={handleSearch}>
            <Home searchQuery={searchQuery} />
          </CustomerLayout>
        } />
        <Route path="/product/:id" element={
          <CustomerLayout onSearch={handleSearch}>
            <ProductDetail />
          </CustomerLayout>
        } />
        <Route path="/cart" element={
          <CustomerLayout onSearch={handleSearch}>
            <Cart />
          </CustomerLayout>
        } />
        <Route path="/checkout" element={
          <CustomerLayout onSearch={handleSearch}>
            <Checkout />
          </CustomerLayout>
        } />
        <Route path="/order-success/:orderId" element={
          <CustomerLayout onSearch={handleSearch}>
            <OrderSuccess />
          </CustomerLayout>
        } />
        <Route path="/zalopay/callback" element={<ZaloPayCallback />} />
        <Route path="/my-orders" element={
          <CustomerLayout onSearch={handleSearch}>
            <MyOrders />
          </CustomerLayout>
        } />
        <Route path="/profile" element={
          <CustomerLayout onSearch={handleSearch}>
            <Profile />
          </CustomerLayout>
        } />

        {/* Policy Pages */}
        <Route path="/:slug" element={
          <CustomerLayout onSearch={handleSearch}>
            <PolicyPage />
          </CustomerLayout>
        } />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <ScrollToTop />
            <AppContent />
          </Router>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
