/**
 * AnimatedButton - Button with click ripple effect and hover animations
 * Uses Framer Motion for animations
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AnimatedButton.css';

const AnimatedButton = ({
  children,
  onClick,
  variant = 'primary', // primary, secondary, danger, success, ghost
  size = 'medium', // small, medium, large
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    if (disabled || loading) return;

    // Create ripple effect
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rippleId = Date.now();

    setRipples(prev => [...prev, { id: rippleId, x, y }]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== rippleId));
    }, 600);

    // Call original onClick
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      className={`animated-button ${variant} ${size} ${fullWidth ? 'full-width' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled || loading}
      whileHover={{ 
        scale: disabled ? 1 : 1.02,
        boxShadow: disabled ? 'none' : '0 8px 25px rgba(0,0,0,0.15)'
      }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.span
            key={ripple.id}
            className="ripple"
            initial={{ 
              width: 0, 
              height: 0, 
              opacity: 0.5,
              x: ripple.x,
              y: ripple.y
            }}
            animate={{ 
              width: 500, 
              height: 500, 
              opacity: 0,
              x: ripple.x - 250,
              y: ripple.y - 250
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>

      {/* Loading spinner */}
      {loading && (
        <motion.span 
          className="loading-spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Icon left */}
      {icon && iconPosition === 'left' && !loading && (
        <motion.span 
          className="button-icon left"
          initial={{ x: -5, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {icon}
        </motion.span>
      )}

      {/* Button content */}
      <span className="button-content">
        {children}
      </span>

      {/* Icon right */}
      {icon && iconPosition === 'right' && !loading && (
        <motion.span 
          className="button-icon right"
          initial={{ x: 5, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {icon}
        </motion.span>
      )}
    </motion.button>
  );
};

export default AnimatedButton;
