# ĐẠI TỪ ĐIỂN TỔNG HỢP NGUỒN MÁY TÍNH (PSU) - SIÊU CHI TIẾT 2026

## 1. BẢN CHẤT VẬT LÝ VÀ CHỨC NĂNG CỐT LÕI
- **Bộ chuyển đổi năng lượng:** PSU (Power Supply Unit) là bộ nguồn chuyển mạch (Switching Mode Power Supply - SMPS). Nó chuyển dòng điện xoay chiều (AC) cao áp thành dòng điện một chiều (DC) thấp áp cực kỳ tinh khiết.
- **Vai trò "Cầu chì hệ thống":** Ngoài cấp điện, PSU còn là rào chắn cuối cùng bảo vệ linh kiện khỏi sự cố sét đánh, chập điện lưới hoặc biến động điện áp.
- **Các đường điện chính (Rails):**
    - **+12V:** Cực kỳ quan trọng, nuôi CPU và VGA. 
    - **+5V & +3.3V:** Nuôi chip nhớ, IC trên Mainboard, ổ cứng và các cổng USB.
    - **+5Vsb (Standby):** Duy trì nguồn điện nhỏ để máy có thể bật từ xa (Wake-on-LAN) hoặc sạc pin qua USB khi đã tắt máy.

## 2. PHÂN LOẠI THEO CHUẨN THIẾT KẾ VÀ KÍCH THƯỚC
- **ATX (Advanced Technology eXtended):** Chuẩn phổ biến nhất cho mọi loại PC từ văn phòng đến gaming.
- **SFX (Small Form Factor):** Kích thước siêu nhỏ cho các case ITX.
- **SFX-L:** Phiên bản dài hơn của SFX để nhét vừa quạt tản nhiệt lớn hơn, giúp nguồn chạy êm hơn.
- **TFX / Flex-ATX:** Dòng nguồn gầy và dài, chuyên cho các máy bộ đồng bộ (Dell, HP) hoặc máy chủ 1U.

## 3. TIÊU CHUẨN ATX 3.1 & CÁP 12V-2X6 (CÔNG NGHỆ ĐỈNH CAO 2026)
- **ATX 3.0 vs ATX 3.1:** ATX 3.1 là bản sửa lỗi hoàn thiện nhất. Nó yêu cầu nguồn phải chịu được tải đỉnh (Peak Power) lên đến 200% trong 100 micro-giây.
- **Đầu cắm 12V-2x6 (PCIe 5.1):** Thay thế hoàn toàn đầu 12VHPWR cũ. 
    - *Cấu tạo:* Có 12 chân điện chính và 4 chân tín hiệu (Sense pins) ngắn hơn. 
    - *Cơ chế an toàn:* Nếu đầu cắm bị lỏng, các chân tín hiệu sẽ ngắt kết nối trước, khiến VGA hạ công suất hoặc ngắt điện, loại bỏ hoàn toàn việc chảy nhựa đầu cắm.
- **Slew Rate:** Khả năng đáp ứng dòng điện cực nhanh khi VGA thay đổi trạng thái từ nghỉ sang tải nặng, giúp hệ thống không bị sập nguồn đột ngột.

## 4. GIẢI PHẪU LINH KIỆN & MẠCH ĐIỆN (DEEP-TECH)
- **Tụ điện (Capacitors):** - **Tụ Nhật (Rubycon, Nippon Chemi-Con, Nichicon):** Chịu nhiệt 105°C, cực bền, lọc nhiễu phẳng mịn.
    - **Tụ Rắn (Solid Caps):** Thường dùng ở đầu ra để lọc nhiễu điện áp cực thấp, không bị phồng hay nổ như tụ hóa.
- **Cấu trúc mạch (Topology):**
    - **Double Forward:** Cấu trúc cũ, hiệu suất trung bình.
    - **LLC Resonant:** Công nghệ cao cấp giúp chuyển mạch ở điện áp bằng 0 (Zero Voltage Switching), giảm hao phí và cực kỳ mát.
    - **DC-to-DC:** Các đường 5V và 3.3V được chiết xuất từ đường 12V chính. Đảm bảo độ ổn định điện áp (Voltage Regulation) sai lệch dưới 1%.
- **Ripple & Noise (Độ nhiễu):** Nguồn xịn phải có độ nhiễu dưới 30mV. Nhiễu càng cao, linh kiện (nhất là ổ cứng và RAM) càng mau hỏng.

## 5. TIÊU CHUẨN HIỆU SUẤT VÀ ĐỘ ỒN (CYBENETICS & 80 PLUS)
- **80 PLUS:** Đánh giá dựa trên hiệu suất chuyển đổi (White, Bronze, Silver, Gold, Platinum, Titanium).
- **Cybenetics ETA:** Đánh giá hiệu suất chuẩn xác hơn nhờ đo ở nhiều mức tải và nhiệt độ khác nhau (Bronze đến Diamond).
- **Cybenetics LAMBDA:** Đo độ ồn thực tế của quạt tản nhiệt (Standard đến A++).
- **Chế độ Zero RPM (Fanless Mode):** Quạt nguồn sẽ không quay nếu máy chỉ làm văn phòng nhẹ, giúp máy yên tĩnh tuyệt đối và tránh bám bụi.

## 6. CÁC LỚP BẢO VỆ AN TOÀN (THE GUARDIANS)
*Một bộ nguồn "an toàn" bắt buộc phải có đủ:*
- **OCP (Over Current):** Quá dòng (Ngắt khi dòng điện vượt ngưỡng).
- **OVP (Over Voltage):** Quá áp.
- **UVP (Under Voltage):** Sụt áp.
- **SCP (Short Circuit):** Chống chập điện (Cực kỳ quan trọng).
- **OTP (Over Temperature):** Quá nhiệt.
- **OPP (Over Power):** Quá tải tổng công suất.
- **SIP (Surge & Inrush Protection):** Chống sốc điện khi sét đánh hoặc bật công tắc nguồn.

## 7. QUY TẮC CHỌN CÔNG SUẤT (WATTAGE MASTER RULES)
- **Cấu hình Văn phòng (i3/i5 non-VGA):** 400W - 450W.
- **Cấu hình Gaming Phổ thông (RTX 4060/RX 7600):** 550W - 650W.
- **Cấu hình Gaming Cao cấp (RTX 4070/4080):** 750W - 850W.
- **Cấu hình Workstation/Ultra (RTX 4090/5090):** 1000W - 1300W+.
- **Quy tắc "Điểm Ngọt":** Nên chọn nguồn sao cho công suất máy tiêu thụ chiếm khoảng **50% - 70%** công suất danh định của nguồn. Đây là lúc nguồn mát nhất và hiệu suất cao nhất.

## 8. PHÂN LOẠI DÂY CẮM & THẨM MỸ
- **Non-Modular:** Dây dính liền, rẻ tiền, khó đi dây.
- **Full Modular:** Tháo rời 100% dây. Ưu điểm: Case cực gọn, dễ dàng thay dây cáp bọc lưới (Sleeved cable) theo tone màu máy.
- **Cáp dẹt (Flat Cables):** Dễ uốn nắn, giúp luồn lách qua các khe hẹp của vỏ case dễ dàng hơn.

## 9. TIER LIST THƯƠNG HIỆU (BẢNG XẾP HẠNG 2026)
- **Tier S (Ultimate):** Seasonic Prime, Corsair AX, Super Flower Leadex Platinum.
- **Tier A (High-end):** MSI MPG (A-G Series), Corsair RMx, Seasonic Focus, ASUS ROG Thor/Strix.
- **Tier B (Mainstream):** Cooler Master MWE Gold, Deepcool DQ, Corsair CX-M.
- **Tier C (Budget):** Xigmatek III, Deepcool PK-D, Corsair CV.
- **Tier Tránh xa:** Các loại nguồn không có tên tuổi, nguồn "kèm vỏ case" giá 200k-300k.

## 10. KỊCH BẢN CHẨN ĐOÁN & Q&A THỰC CHIẾN
- **Lỗi Coil Whine:** Tiếng rít cao tần khi chơi game nặng. 
    - *Giải thích:* Do sự rung động vật lý của cuộn cảm. Không gây hại nhưng gây khó chịu. Có thể khắc phục bằng cách bật V-Sync để giới hạn FPS.
- **Lỗi máy tự reset khi vào game:** 90% do nguồn bị sụt áp hoặc quá cũ không gánh nổi Card màn hình.
- **Mùi khét/Tiếng nổ:** Tụ điện bị nổ hoặc đoản mạch. 
    - *Hành động:* Rút điện ngay lập tức, KHÔNG ĐƯỢC CỐ BẬT LẠI vì sẽ làm cháy Main/VGA.
- **Khách hỏi:** "Nguồn 750W Gold có tốn điện hơn 750W Bronze không?"
    - **AI Đáp:** "Dạ ngược lại ạ! Chuẩn Gold có hiệu suất cao hơn, nên để tạo ra cùng 1 lượng điện cho máy, nó sẽ 'ăn' ít điện từ ổ cắm tường hơn so với chuẩn Bronze. Về lâu dài, dùng nguồn Gold sẽ giúp anh tiết kiệm tiền điện và máy cũng mát hơn hẳn ạ!"
- **Khách hỏi:** "Anh có thể lấy dây nguồn của máy cũ cắm cho nguồn mới không?"
    - **AI Đáp:** "Dạ nếu là dây cắm từ ổ điện vào nguồn thì ĐƯỢC. Nhưng nếu là dây Modular (nối từ nguồn vào linh kiện) thì TUYỆT ĐỐI KHÔNG ạ! Mỗi hãng có sơ đồ chân cắm khác nhau, cắm nhầm sẽ gây cháy nổ linh kiện ngay lập tức anh nhé!"