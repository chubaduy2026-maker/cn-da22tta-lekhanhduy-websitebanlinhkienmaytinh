/**
 * RecommendationSection - Reusable component for displaying AI recommendations
 * 
 * Features:
 * - GSAP scroll-trigger animations
 * - Framer Motion staggered reveals
 * - CSS hover effects
 * - Loading skeleton with shimmer
 * - Source indicator badges
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ProductCard from './ProductCard';
import './RecommendationSection.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

const headerVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.3, type: "spring", stiffness: 200 }
  }
};

const RecommendationSection = ({ 
  title = 'Gợi ý cho bạn', 
  icon = '🤖',
  products = [], 
  loading = false, 
  source = null,
  onProductClick = null,
  maxDisplay = 12,
  emptyMessage = 'Chưa có gợi ý nào'
}) => {
  const sectionRef = useRef(null);
  const gridRef = useRef(null);

  // GSAP scroll-triggered parallax effect
  useEffect(() => {
    if (!sectionRef.current || loading || products.length === 0) return;

    const ctx = gsap.context(() => {
      // Title animation on scroll
      gsap.fromTo(
        ".recommendation-title",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 85%",
            end: "top 50%",
            toggleActions: "play none none reverse"
          }
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [loading, products.length]);

  if (loading) {
    return (
      <div className="recommendation-section">
        <h2 className="recommendation-title">
          <span role="img" aria-label="icon">{icon}</span> {title}
        </h2>
        <div className="recommendation-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div 
              key={i} 
              className="recommendation-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="skeleton-image shimmer" />
              <div className="skeleton-text shimmer" />
              <div className="skeleton-text short shimmer" />
              <div className="skeleton-price shimmer" />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return null;
  }

  const displayProducts = products.slice(0, maxDisplay);

  return (
    <motion.div 
      ref={sectionRef}
      className="recommendation-section"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
    >
      <motion.div className="recommendation-header" variants={headerVariants}>
        <h2 className="recommendation-title">
          <motion.span 
            role="img" 
            aria-label="icon"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {icon}
          </motion.span>{' '}
          {title}
        </h2>
        <AnimatePresence>
          {source && (
            <motion.span 
              className={`rec-source-badge rec-source-${source}`}
              variants={badgeVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {source === 'python-ai' && '⚡ Deep Learning'}
              {source === 'v2' && '⚡ AI Nâng cao'}
              {source === 'v1' && '📊 AI Classic'}
              {source === 'nodejs-fallback' && '📊 Classic'}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      
      <motion.div 
        ref={gridRef}
        className="recommendation-grid"
        variants={containerVariants}
      >
        {displayProducts.map((product, index) => (
          <motion.div 
            key={product._id} 
            className="recommendation-item"
            variants={itemVariants}
            onClick={() => onProductClick && onProductClick(product._id)}
            whileHover={{ 
              y: -5,
              transition: { duration: 0.2 }
            }}
          >
            <ProductCard product={product} index={index} />
            {product.score && (
              <motion.div 
                className="rec-score-indicator"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
              >
                <div 
                  className="rec-score-bar" 
                  style={{ width: `${Math.min(product.score * 100, 100)}%` }}
                />
              </motion.div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default RecommendationSection;
