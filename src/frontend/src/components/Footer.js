import React from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiClock, FiFacebook, FiInstagram, FiYoutube, FiChevronRight, FiShield, FiTruck, FiCreditCard, FiHelpCircle, FiRefreshCw } from 'react-icons/fi';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      {/* Top Wave Decoration */}
      <div className="footer-wave">
        <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 50L48 45.7C96 41.3 192 32.7 288 30.2C384 27.7 480 31.3 576 38.5C672 45.7 768 56.3 864 58.8C960 61.3 1056 55.7 1152 48.5C1248 41.3 1344 32.7 1392 28.3L1440 24V100H1392C1344 100 1248 100 1152 100C1056 100 960 100 864 100C768 100 672 100 576 100C480 100 384 100 288 100C192 100 96 100 48 100H0V50Z" fill="#1f2937"/>
        </svg>
      </div>

      <div className="footer-main">
        <div className="footer-container">
          {/* Brand Section */}
          <div className="footer-section footer-brand">
            <div className="brand-logo">
              <span className="logo-icon">🖥️</span>
              <h2 className="logo-text">TechStore</h2>
            </div>
            <p className="footer-about">
              Chuyên cung cấp các sản phẩm công nghệ chính hãng với giá tốt nhất. 
              Cam kết chất lượng, bảo hành uy tín và dịch vụ chăm sóc khách hàng tận tâm.
            </p>
            <div className="footer-social">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-link facebook">
                <FiFacebook />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-link instagram">
                <FiInstagram />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="social-link youtube">
                <FiYoutube />
              </a>
            </div>
          </div>

          {/* Support Links Section */}
          <div className="footer-section">
            <h3 className="footer-title">
              <FiHelpCircle className="title-icon" />
              Hỗ trợ khách hàng
            </h3>
            <ul className="footer-links">
              <li>
                <Link to="/chinh-sach-doi-tra">
                  <FiRefreshCw className="link-icon" />
                  <span>Chính sách đổi trả</span>
                  <FiChevronRight className="arrow-icon" />
                </Link>
              </li>
              <li>
                <Link to="/chinh-sach-bao-hanh">
                  <FiShield className="link-icon" />
                  <span>Chính sách bảo hành</span>
                  <FiChevronRight className="arrow-icon" />
                </Link>
              </li>
              <li>
                <Link to="/chinh-sach-van-chuyen">
                  <FiTruck className="link-icon" />
                  <span>Chính sách vận chuyển</span>
                  <FiChevronRight className="arrow-icon" />
                </Link>
              </li>
              <li>
                <Link to="/huong-dan-mua-hang">
                  <FiHelpCircle className="link-icon" />
                  <span>Hướng dẫn mua hàng</span>
                  <FiChevronRight className="arrow-icon" />
                </Link>
              </li>
              <li>
                <Link to="/huong-dan-thanh-toan">
                  <FiCreditCard className="link-icon" />
                  <span>Hướng dẫn thanh toán</span>
                  <FiChevronRight className="arrow-icon" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div className="footer-section">
            <h3 className="footer-title">
              <FiPhone className="title-icon" />
              Liên hệ với chúng tôi
            </h3>
            <ul className="footer-contact-list">
              <li className="contact-item">
                <div className="contact-icon">
                  <FiMapPin size={16} />
                </div>
                <div className="contact-info">
                  <span className="contact-label">Địa chỉ</span>
                  <span className="contact-value">126 Nguyễn Thiện Thành, Phường 5, Trà Vinh</span>
                </div>
              </li>
              <li className="contact-item">
                <div className="contact-icon">
                  <FiPhone size={16} />
                </div>
                <div className="contact-info">
                  <span className="contact-label">Hotline</span>
                  <a href="tel:0348137209" className="contact-value highlight">0348 137 209</a>
                </div>
              </li>
              <li className="contact-item">
                <div className="contact-icon">
                  <FiMail size={16} />
                </div>
                <div className="contact-info">
                  <span className="contact-label">Email</span>
                  <a href="mailto:Leduytctv2019@gmail.com" className="contact-value">Leduytctv2019@gmail.com</a>
                </div>
              </li>
              <li className="contact-item">
                <div className="contact-icon">
                  <FiClock size={16} />
                </div>
                <div className="contact-info">
                  <span className="contact-label">Giờ làm việc</span>
                  <span className="contact-value">8:00 - 21:00 (T2 - CN)</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Map Section */}
          <div className="footer-section footer-map-section">
            <h3 className="footer-title">
              <FiMapPin className="title-icon" />
              Vị trí cửa hàng
            </h3>
            <div className="footer-map">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3929.5!2d106.3447!3d9.9347!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31a0175f1c9d1e51%3A0x1c9d1e51c9d1e51c!2s126%20Nguy%E1%BB%85n%20Thi%E1%BB%87n%20Th%C3%A0nh%2C%20Ph%C6%B0%E1%BB%9Dng%205%2C%20Tr%C3%A0%20Vinh%2C%20Vi%E1%BB%87t%20Nam!5e0!3m2!1svi!2s!4v1703318400000!5m2!1svi!2s"
                width="100%"
                height="160"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="TechStore Location"
              ></iframe>
            </div>
            <a 
              href="https://www.google.com/maps/search/126+Nguyễn+Thiện+Thành,+Phường+5,+Trà+Vinh,+Việt+Nam" 
              target="_blank" 
              rel="noopener noreferrer"
              className="view-map-btn"
            >
              <FiMapPin size={14} />
              Xem trên Google Maps
            </a>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p className="copyright">&copy; 2025 TechStore. Tất cả quyền được bảo lưu.</p>
          <div className="footer-bottom-links">
            <Link to="/dieu-khoan-su-dung">Điều khoản sử dụng</Link>
            <span className="divider">|</span>
            <Link to="/chinh-sach-bao-mat">Chính sách bảo mật</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
