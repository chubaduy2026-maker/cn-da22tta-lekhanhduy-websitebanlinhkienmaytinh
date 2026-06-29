import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Cuộn lên đầu trang khi route thay đổi
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Cuộn ngay lập tức
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
