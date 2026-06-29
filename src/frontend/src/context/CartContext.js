import React, { createContext, useContext, useState, useEffect } from 'react';
import { cartAPI } from '../services/api';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [], totalAmount: 0 });
  const [loading, setLoading] = useState(false);

  // Lấy giỏ hàng khi load
  useEffect(() => {
    fetchCart();
  }, []);

  // Lắng nghe thay đổi token (login/logout) để reload giỏ hàng
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        // Token thay đổi -> reload giỏ hàng
        fetchCart();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Lắng nghe event custom từ login/logout
    window.addEventListener('auth-change', fetchCart);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', fetchCart);
    };
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await cartAPI.getCart();
      // Đảm bảo cart luôn có cấu trúc đúng
      if (response.data && typeof response.data === 'object') {
        setCart({
          items: response.data.items || [],
          totalAmount: response.data.totalAmount || 0,
          ...response.data
        });
      } else {
        setCart({ items: [], totalAmount: 0 });
      }
    } catch (error) {
      console.error('Lỗi khi lấy giỏ hàng:', error);
      // Giữ nguyên cart hiện tại hoặc reset về mặc định
      setCart({ items: [], totalAmount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId, quantity = 1) => {
    try {
      const response = await cartAPI.addToCart(productId, quantity);
      if (response.data.cart) {
        setCart({
          items: response.data.cart.items || [],
          totalAmount: response.data.cart.totalAmount || 0,
          ...response.data.cart
        });
      }
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error('Chi tiết lỗi addToCart:', error);
      console.error('Error response:', error.response);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Lỗi khi thêm vào giỏ hàng' 
      };
    }
  };

  const updateCartItem = async (productId, quantity) => {
    try {
      const response = await cartAPI.updateCart(productId, quantity);
      setCart(response.data.cart);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const response = await cartAPI.removeFromCart(productId);
      setCart(response.data.cart);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  };

  const clearCart = async () => {
    try {
      const response = await cartAPI.clearCart();
      setCart(response.data.cart);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  };

  const getCartItemCount = () => {
    if (!cart || !cart.items || !Array.isArray(cart.items)) {
      return 0;
    }
    return cart.items.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
        fetchCart,
        getCartItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
