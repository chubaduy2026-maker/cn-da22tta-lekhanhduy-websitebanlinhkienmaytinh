/**
 * LottieAnimations - Reusable Lottie animation components
 * For micro-interactions and visual feedback
 */

import React from 'react';
import { Player } from '@lottiefiles/react-lottie-player';

// Lottie animation URLs from LottieFiles CDN (free animations)
const ANIMATIONS = {
  loading: 'https://lottie.host/4db68bbd-31f6-4cd8-84eb-189f6ad0f702/Vp9LKOXU9b.json',
  success: 'https://lottie.host/cc639e0b-b8d6-4f68-8a19-7c40a0a4fc6d/FCZC3xRxH2.json',
  error: 'https://lottie.host/ed1f36bf-eda9-4d37-a4f8-dd8d1a83e0ea/1ZKakNNfAn.json',
  cart: 'https://lottie.host/3de0b551-bf82-4e36-8ec6-2a0b16fc4fc9/CVTbUCJpYx.json',
  empty: 'https://lottie.host/75687b4c-8b1d-4cdf-8e7e-49a3598c48d8/JMvGQlwSJT.json',
  search: 'https://lottie.host/e11a1d2c-d34b-4b0e-9c1c-e1a6d6c36b4f/Yy8Y3XUVZV.json',
  heart: 'https://lottie.host/c34ebfde-4da2-4516-bcee-39ce7cee8c27/1vPSLqYEI3.json',
  star: 'https://lottie.host/c7e55a4e-6d16-4ee7-adec-4b3e1c38e7f8/8dqJqKb8yQ.json',
  rocket: 'https://lottie.host/0c69c9a2-f5e0-4b1b-b6e1-9c9a8f0b2c3d/AbCdEfGhIj.json',
  aiThinking: 'https://lottie.host/cc9f6f6e-1e34-4a6f-91a4-f7d4adb0e7f8/AIthinking.json'
};

// Loading spinner with AI theme
export const LoadingAnimation = ({ 
  size = 120, 
  text = 'Đang tải...', 
  showText = true 
}) => (
  <div className="lottie-container loading">
    <Player
      autoplay
      loop
      src={ANIMATIONS.loading}
      style={{ height: size, width: size }}
    />
    {showText && <p className="lottie-text">{text}</p>}
  </div>
);

// Success checkmark
export const SuccessAnimation = ({ 
  size = 100, 
  text = 'Thành công!',
  onComplete = null 
}) => (
  <div className="lottie-container success">
    <Player
      autoplay
      loop={false}
      src={ANIMATIONS.success}
      style={{ height: size, width: size }}
      onEvent={(event) => {
        if (event === 'complete' && onComplete) {
          onComplete();
        }
      }}
    />
    <p className="lottie-text success-text">{text}</p>
  </div>
);

// Error animation
export const ErrorAnimation = ({ 
  size = 100, 
  text = 'Có lỗi xảy ra!' 
}) => (
  <div className="lottie-container error">
    <Player
      autoplay
      loop={false}
      src={ANIMATIONS.error}
      style={{ height: size, width: size }}
    />
    <p className="lottie-text error-text">{text}</p>
  </div>
);

// Cart add animation
export const CartAnimation = ({ 
  size = 60,
  autoplay = true 
}) => (
  <Player
    autoplay={autoplay}
    loop={false}
    src={ANIMATIONS.cart}
    style={{ height: size, width: size }}
  />
);

// Empty state animation
export const EmptyStateAnimation = ({ 
  size = 200, 
  text = 'Không có dữ liệu' 
}) => (
  <div className="lottie-container empty-state">
    <Player
      autoplay
      loop
      src={ANIMATIONS.empty}
      style={{ height: size, width: size }}
    />
    <p className="lottie-text">{text}</p>
  </div>
);

// AI Thinking animation (for recommendation loading)
export const AIThinkingAnimation = ({ 
  size = 80, 
  text = 'AI đang phân tích...' 
}) => (
  <div className="lottie-container ai-thinking">
    <Player
      autoplay
      loop
      src={ANIMATIONS.loading}
      style={{ height: size, width: size }}
    />
    <p className="lottie-text ai-text">{text}</p>
  </div>
);

// Heart like animation
export const HeartAnimation = ({ 
  size = 40,
  isActive = false 
}) => (
  <Player
    autoplay={isActive}
    loop={false}
    src={ANIMATIONS.heart}
    style={{ height: size, width: size }}
  />
);

// Star rating animation  
export const StarAnimation = ({ 
  size = 30,
  filled = false 
}) => (
  <Player
    autoplay={filled}
    loop={false}
    src={ANIMATIONS.star}
    style={{ height: size, width: size }}
  />
);

// Generic Lottie player with custom URL
export const CustomLottie = ({
  src,
  size = 100,
  autoplay = true,
  loop = true,
  onComplete = null
}) => (
  <Player
    autoplay={autoplay}
    loop={loop}
    src={src}
    style={{ height: size, width: size }}
    onEvent={(event) => {
      if (event === 'complete' && onComplete) {
        onComplete();
      }
    }}
  />
);

// CSS styles (inline for component isolation)
const styles = `
.lottie-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lottie-text {
  margin-top: 12px;
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
  text-align: center;
}

.lottie-container.loading .lottie-text {
  color: #3b82f6;
}

.lottie-container.success .lottie-text {
  color: #22c55e;
  font-weight: 600;
}

.lottie-container.error .lottie-text {
  color: #ef4444;
  font-weight: 600;
}

.lottie-container.ai-thinking .lottie-text {
  color: #8b5cf6;
  font-weight: 600;
  background: linear-gradient(135deg, #e63946, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.lottie-container.empty-state .lottie-text {
  color: #94a3b8;
  font-size: 16px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Export all animations
const LottieAnimations = {
  LoadingAnimation,
  SuccessAnimation,
  ErrorAnimation,
  CartAnimation,
  EmptyStateAnimation,
  AIThinkingAnimation,
  HeartAnimation,
  StarAnimation,
  CustomLottie
};

export default LottieAnimations;
