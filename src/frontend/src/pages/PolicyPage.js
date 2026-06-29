import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiTruck, FiRefreshCw, FiCreditCard, FiHelpCircle, FiFileText, FiLock } from 'react-icons/fi';
import './PolicyPage.css';

const policyData = {
  'chinh-sach-doi-tra': {
    title: 'Chính sách đổi trả',
    icon: FiRefreshCw,
    content: [
      {
        heading: '1. Điều kiện đổi trả',
        text: `- Sản phẩm còn nguyên tem, nhãn mác và chưa qua sử dụng
- Sản phẩm còn đầy đủ phụ kiện đi kèm (nếu có)
- Hóa đơn mua hàng còn nguyên vẹn
- Thời gian đổi trả trong vòng 7 ngày kể từ ngày mua hàng`
      },
      {
        heading: '2. Các trường hợp được đổi trả',
        text: `- Sản phẩm bị lỗi kỹ thuật từ nhà sản xuất
- Sản phẩm không đúng mô tả hoặc không đúng như đơn đặt hàng
- Sản phẩm bị hư hỏng trong quá trình vận chuyển`
      },
      {
        heading: '3. Quy trình đổi trả',
        text: `Bước 1: Liên hệ hotline 0348 137 209 hoặc email Leduytctv2019@gmail.com
Bước 2: Cung cấp thông tin đơn hàng và lý do đổi trả
Bước 3: Gửi sản phẩm về địa chỉ cửa hàng
Bước 4: TechStore kiểm tra và xử lý trong vòng 3-5 ngày làm việc`
      },
      {
        heading: '4. Chi phí đổi trả',
        text: `- Nếu lỗi từ TechStore: Miễn phí hoàn toàn
- Nếu khách hàng đổi ý: Khách hàng chịu phí vận chuyển 2 chiều`
      }
    ]
  },
  'chinh-sach-bao-hanh': {
    title: 'Chính sách bảo hành',
    icon: FiShield,
    content: [
      {
        heading: '1. Thời gian bảo hành',
        text: `- Linh kiện máy tính: 12-36 tháng tùy sản phẩm
- Laptop: 12-24 tháng
- Phụ kiện: 3-12 tháng
- Thời gian bảo hành được tính từ ngày mua hàng`
      },
      {
        heading: '2. Điều kiện bảo hành',
        text: `- Sản phẩm còn trong thời hạn bảo hành
- Tem bảo hành còn nguyên vẹn, không bị rách, tẩy xóa
- Sản phẩm bị lỗi kỹ thuật do nhà sản xuất
- Có hóa đơn mua hàng hoặc phiếu bảo hành`
      },
      {
        heading: '3. Trường hợp không được bảo hành',
        text: `- Sản phẩm hết thời hạn bảo hành
- Tem bảo hành bị rách, mờ hoặc không còn nguyên vẹn
- Sản phẩm bị hư hỏng do va đập, ngấm nước, cháy nổ
- Sản phẩm đã được sửa chữa bởi bên thứ ba
- Lỗi do sử dụng sai cách hoặc nguồn điện không ổn định`
      },
      {
        heading: '4. Quy trình bảo hành',
        text: `Bước 1: Mang sản phẩm đến cửa hàng hoặc gửi qua đường bưu điện
Bước 2: Nhân viên tiếp nhận và kiểm tra sản phẩm
Bước 3: Xử lý bảo hành trong 7-14 ngày làm việc
Bước 4: Thông báo và trả sản phẩm cho khách hàng`
      }
    ]
  },
  'chinh-sach-van-chuyen': {
    title: 'Chính sách vận chuyển',
    icon: FiTruck,
    content: [
      {
        heading: '1. Phạm vi giao hàng',
        text: `- Giao hàng toàn quốc qua các đối tác vận chuyển uy tín
- Giao hàng nội thành Trà Vinh trong ngày
- Giao hàng các tỉnh thành khác: 2-5 ngày làm việc`
      },
      {
        heading: '2. Phí vận chuyển',
        text: `- Miễn phí giao hàng cho đơn hàng từ 500.000đ trở lên
- Đơn hàng dưới 500.000đ: Phí ship từ 20.000đ - 50.000đ tùy khu vực
- Giao hàng hỏa tốc: Phụ thu thêm 30.000đ - 100.000đ`
      },
      {
        heading: '3. Thời gian giao hàng',
        text: `- Nội thành Trà Vinh: 1-3 giờ (giao trong ngày)
- Các tỉnh lân cận: 1-2 ngày
- Các tỉnh xa: 3-5 ngày
- Lưu ý: Thời gian có thể thay đổi vào dịp lễ, Tết`
      },
      {
        heading: '4. Kiểm tra hàng khi nhận',
        text: `- Khách hàng được quyền kiểm tra sản phẩm trước khi thanh toán
- Kiểm tra số lượng, chủng loại sản phẩm
- Kiểm tra tình trạng bao bì, tem niêm phong
- Nếu có vấn đề, vui lòng từ chối nhận hàng và liên hệ ngay hotline`
      }
    ]
  },
  'huong-dan-mua-hang': {
    title: 'Hướng dẫn mua hàng',
    icon: FiHelpCircle,
    content: [
      {
        heading: '1. Tìm kiếm sản phẩm',
        text: `- Sử dụng thanh tìm kiếm để tìm sản phẩm mong muốn
- Duyệt theo danh mục sản phẩm
- Lọc sản phẩm theo giá, thương hiệu, tính năng`
      },
      {
        heading: '2. Thêm vào giỏ hàng',
        text: `- Click vào sản phẩm để xem chi tiết
- Chọn số lượng và nhấn "Thêm vào giỏ hàng"
- Tiếp tục mua sắm hoặc tiến hành thanh toán`
      },
      {
        heading: '3. Đặt hàng',
        text: `- Kiểm tra giỏ hàng và nhấn "Tiến hành thanh toán"
- Điền thông tin giao hàng đầy đủ
- Chọn phương thức thanh toán
- Xác nhận đơn hàng`
      },
      {
        heading: '4. Theo dõi đơn hàng',
        text: `- Đăng nhập tài khoản để xem trạng thái đơn hàng
- Nhận thông báo qua email/SMS khi đơn hàng được xử lý
- Liên hệ hotline nếu cần hỗ trợ`
      }
    ]
  },
  'huong-dan-thanh-toan': {
    title: 'Hướng dẫn thanh toán',
    icon: FiCreditCard,
    content: [
      {
        heading: '1. Thanh toán khi nhận hàng (COD)',
        text: `- Phương thức phổ biến và tiện lợi nhất
- Thanh toán bằng tiền mặt khi nhận hàng
- Được kiểm tra hàng trước khi thanh toán
- Áp dụng cho tất cả đơn hàng toàn quốc`
      },
      {
        heading: '2. Chuyển khoản ngân hàng',
        text: `Thông tin chuyển khoản:
- Ngân hàng: Vietcombank
- Số tài khoản: 1234567890
- Chủ tài khoản: CÔNG TY TNHH TECHSTORE
- Nội dung: [Mã đơn hàng] - [Số điện thoại]`
      },
      {
        heading: '3. Ví điện tử ZaloPay',
        text: `- Thanh toán nhanh chóng qua ứng dụng ZaloPay
- Quét mã QR để thanh toán
- Hỗ trợ nhiều nguồn tiền: thẻ ngân hàng, ví ZaloPay
- Nhận thông báo thanh toán thành công ngay lập tức`
      },
      {
        heading: '4. Thẻ tín dụng/Ghi nợ',
        text: `- Chấp nhận Visa, Mastercard, JCB
- Thanh toán an toàn với bảo mật 3D Secure
- Không lưu trữ thông tin thẻ của khách hàng
- Hỗ trợ trả góp 0% qua một số ngân hàng`
      }
    ]
  },
  'dieu-khoan-su-dung': {
    title: 'Điều khoản sử dụng',
    icon: FiFileText,
    content: [
      {
        heading: '1. Điều khoản chung',
        text: `- Website TechStore cung cấp dịch vụ mua bán linh kiện máy tính
- Người dùng phải đủ 18 tuổi hoặc có sự đồng ý của phụ huynh
- Người dùng chịu trách nhiệm bảo mật thông tin tài khoản`
      },
      {
        heading: '2. Quyền và nghĩa vụ của người dùng',
        text: `- Cung cấp thông tin chính xác khi đăng ký và đặt hàng
- Không sử dụng website cho mục đích bất hợp pháp
- Tôn trọng quyền sở hữu trí tuệ của TechStore`
      },
      {
        heading: '3. Quyền và nghĩa vụ của TechStore',
        text: `- Cung cấp sản phẩm đúng mô tả và chất lượng cam kết
- Bảo mật thông tin khách hàng
- Hỗ trợ khách hàng trong quá trình mua sắm`
      },
      {
        heading: '4. Giới hạn trách nhiệm',
        text: `- TechStore không chịu trách nhiệm cho thiệt hại gián tiếp
- Không đảm bảo website hoạt động liên tục không gián đoạn
- Có quyền thay đổi điều khoản mà không cần thông báo trước`
      }
    ]
  },
  'chinh-sach-bao-mat': {
    title: 'Chính sách bảo mật',
    icon: FiLock,
    content: [
      {
        heading: '1. Thu thập thông tin',
        text: `TechStore thu thập các thông tin sau:
- Thông tin cá nhân: họ tên, email, số điện thoại, địa chỉ
- Thông tin giao dịch: lịch sử mua hàng, phương thức thanh toán
- Thông tin kỹ thuật: IP, trình duyệt, thiết bị sử dụng`
      },
      {
        heading: '2. Mục đích sử dụng',
        text: `- Xử lý đơn hàng và giao hàng
- Liên hệ hỗ trợ khách hàng
- Gửi thông tin khuyến mãi (nếu khách hàng đồng ý)
- Cải thiện chất lượng dịch vụ`
      },
      {
        heading: '3. Bảo vệ thông tin',
        text: `- Sử dụng mã hóa SSL cho tất cả giao dịch
- Không chia sẻ thông tin với bên thứ ba không liên quan
- Hạn chế quyền truy cập thông tin khách hàng
- Thường xuyên cập nhật hệ thống bảo mật`
      },
      {
        heading: '4. Quyền của khách hàng',
        text: `- Yêu cầu xem, sửa đổi thông tin cá nhân
- Yêu cầu xóa thông tin khỏi hệ thống
- Từ chối nhận email quảng cáo
- Liên hệ Leduytctv2019@gmail.com để thực hiện các yêu cầu trên`
      }
    ]
  }
};

const PolicyPage = () => {
  const { slug } = useParams();
  const policy = policyData[slug];

  if (!policy) {
    return (
      <div className="policy-page">
        <div className="policy-container">
          <div className="policy-not-found">
            <h2>Không tìm thấy trang</h2>
            <p>Trang bạn đang tìm kiếm không tồn tại.</p>
            <Link to="/" className="back-home-btn">
              <FiArrowLeft /> Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const IconComponent = policy.icon;

  return (
    <div className="policy-page">
      <div className="policy-container">
        {/* Breadcrumb */}
        <div className="policy-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <span>{policy.title}</span>
        </div>

        {/* Header */}
        <div className="policy-header">
          <div className="policy-icon">
            <IconComponent size={32} />
          </div>
          <h1>{policy.title}</h1>
        </div>

        {/* Content */}
        <div className="policy-content">
          {policy.content.map((section, index) => (
            <div key={index} className="policy-section">
              <h2>{section.heading}</h2>
              <div className="section-text">
                {section.text.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="policy-contact">
          <h3>Cần hỗ trợ thêm?</h3>
          <p>Liên hệ với chúng tôi qua:</p>
          <div className="contact-methods">
            <a href="tel:0348137209" className="contact-method">
              📞 Hotline: 0348 137 209
            </a>
            <a href="mailto:Leduytctv2019@gmail.com" className="contact-method">
              ✉️ Email: Leduytctv2019@gmail.com
            </a>
          </div>
        </div>

        {/* Back button */}
        <Link to="/" className="back-btn">
          <FiArrowLeft /> Quay lại trang chủ
        </Link>
      </div>
    </div>
  );
};

export default PolicyPage;
