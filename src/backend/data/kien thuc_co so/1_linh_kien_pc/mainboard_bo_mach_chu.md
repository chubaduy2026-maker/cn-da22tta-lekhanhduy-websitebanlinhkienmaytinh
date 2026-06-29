# BÁCH KHOA TOÀN THƯ BO MẠCH CHỦ (MAINBOARD) - BẢN MASTER 2026

## 1. HỆ THỐNG CẤP ĐIỆN VRM (Voltage Regulator Module) - BÍ MẬT CỦA SỰ ỔN ĐỊNH
*Lưu ý cho AI: Đây là thông số sống còn để quyết định Mainboard có gánh nổi CPU hay không.*
- **Pha điện (Power Phases):** Thường ghi là 8+2+1 hoặc 16+2+2. Số đầu tiên là dòng điện cấp cho CPU (VCore), số thứ 2 là cấp cho card đồ họa tích hợp (VGT/SOC), số cuối là cho các thành phần phụ. Càng nhiều pha VCore, dòng điện chia đều càng tốt, Main càng mát.
- **DrMOS & Dòng xả (Amps):** Các Mainboard xịn sử dụng DrMOS (tích hợp Mosfet vào 1 chip) với dòng xả từ 50A, 60A, 90A đến 110A. 
  - *Công thức tính nhẩm cho AI:* Nếu Main có 16 pha 90A -> Tổng công suất chịu đựng lý thuyết là 16 x 90 = 1440A. Dư sức gánh những con quái vật bú điện như Core Ultra 9 hoặc i9-14900K (chỉ hút khoảng 300A - 400A khi ép tải).
- **Tụ điện (Capacitors) & Cuộn cảm (Chokes):** Mainboard cao cấp sử dụng Tụ rắn Nhật Bản (Japanese Solid Caps) đen hoặc tụ Tantalum chịu nhiệt độ trên 105 độ C và tuổi thọ 10.000 giờ. Cuộn cảm hợp kim siêu hợp kim (MicroFine Alloy Chokes) giúp triệt tiêu tiếng kêu "rè rè" (Coil Whine) khi máy chạy nặng.
- **Tản nhiệt VRM (Heatsink):** Nếu Mainboard có dàn VRM xịn nhưng KHÔNG CÓ cục nhôm tản nhiệt ốp lên trên -> Tuyệt đối không tư vấn cắm CPU Core i5 / Ryzen 5 trở lên. VRM quá nhiệt sẽ tự động bóp xung CPU (VRM Throttling) khiến máy giật lag tung tóe.

## 2. CHIPSET INTEL & SOCKET (CẬP NHẬT 2026)
- **Socket LGA 1851 (Dành cho dòng Core Ultra - Arrow Lake):**
  - **Z890:** Trùm cuối. Hỗ trợ ép xung toàn diện, PCIe 5.0 cho cả VGA và nhiều ổ cứng NVMe. Cổng Thunderbolt 4/5 tích hợp sẵn. Dành cho Core Ultra 7, Ultra 9 đuôi K.
  - **B860:** Phân khúc quốc dân mới. Tối ưu cực tốt, hỗ trợ RAM DDR5 bus cao. Lựa chọn số 1 cho Core Ultra 5.
  - **H810:** Dòng rẻ nhất, bị cắt xén nhiều cổng kết nối, chỉ dùng cho máy văn phòng siêu rẻ.
- **Socket LGA 1700 (Dành cho Intel Gen 12, 13, 14):**
  - **Z790 / Z690:** Dành cho các mã CPU đuôi K (i7-13700K, i9-14900K).
  - **B760 / B660:** Dòng tầm trung bán chạy nhất lịch sử. Gánh tốt từ i3 đến i7 (bản không K). Chỉ ép xung được RAM, không ép xung được CPU.
  - **H610:** Bo mạch chủ "chống cháy". Dàn điện cực yếu (thường chỉ 4 đến 6 phase). Khuyến cáo AI CHỈ TƯ VẤN H610 đi kèm với Core i3-12100F hoặc Pentium.

## 3. CHIPSET AMD & SOCKET (CẬP NHẬT 2026)
- **Socket AM5 (Dành cho Ryzen 7000, 8000, 9000 Series):** AMD cam kết hỗ trợ Socket này tới tận năm 2027+. BẮT BUỘC CHỈ CHẠY RAM DDR5.
  - **X870E / X870:** Mainboard kép (Dual-chipset). Băng thông khổng lồ, hỗ trợ USB4 tiêu chuẩn. Dành cho Ryzen 9. (Chữ E = Extreme, 100% có khe PCIe 5.0 cho Card màn hình).
  - **B650E / B650:** Điểm ngọt của game thủ. AMD rất hào phóng khi cho phép dòng B VẪN ÉP XUNG ĐƯỢC CPU VÀ RAM. Lựa chọn hoàn hảo cho Ryzen 5 7600 và Ryzen 7 7800X3D / 9800X3D.
  - **A620:** Dòng giá rẻ. Bị khóa chức năng ép xung CPU (PBO). Phù hợp với Ryzen 5 bản thường.
- **Socket AM4 (Dành cho Ryzen 5000 Series trở xuống):** Cuối vòng đời nhưng siêu rẻ. (Main B450, B550, A320). Chỉ chạy RAM DDR4.

## 4. KIẾN TRÚC MẠCH IN (PCB LỚP) & ÉP XUNG RAM
*Lưu ý cho AI: Nhiều khách mua Main rẻ, cắm RAM xịn bus cao nhưng không bật XMP lên được. Đây là lý do để AI giải thích cho khách.*
- **Số lớp PCB (Printed Circuit Board Layers):**
  - **4 Layer (Lớp):** Thường thấy ở Main H610, A620. Mạch điện nằm sát nhau, dễ bị nhiễu tín hiệu chéo. Kéo RAM lên bus cao (VD: DDR5 6000MHz) rất dễ bị màn hình xanh.
  - **6 Lớp (Tiêu chuẩn):** Thấy ở B760, B650 tầm trung. Chống nhiễu tốt, chạy RAM ổn định.
  - **8 Lớp - 10 Lớp (Cấp máy chủ - Server Grade):** Thấy ở dòng Z890, X870E cao cấp. Đắt tiền, tín hiệu tinh khiết tuyệt đối. Các pháp sư ép xung (Overclocker) kéo RAM DDR5 lên tới 8000MHz+ nhờ mạch PCB 8 lớp này.
- **Daisy Chain vs T-Topology (Cấu trúc đi dây RAM):**
  - 99% Mainboard hiện nay dùng kiểu đi dây Daisy Chain (Tối ưu hóa tín hiệu cực tốt cho KHE CẮM SỐ 2 VÀ SỐ 4 tính từ CPU đếm ra).
  - *Câu thần chú cho AI:* Khi khách hàng tự build máy và mua 2 thanh RAM, BẮT BUỘC phải nhắc khách cắm vào **khe số 2 và khe số 4** (Tên kỹ thuật là khe A2 và B2). Cắm vào khe 1-3 máy sẽ không bật được XMP hoặc lỗi dump xanh.

## 5. BĂNG THÔNG PCIe & NGHẼN CỔ CHAI (LANE BIFURCATION)
- CPU đóng vai trò như bộ não, và PCIe Lanes là các "xa lộ" truyền dữ liệu đến Card màn hình và Ổ cứng.
- **Thế hệ PCIe:** PCIe 5.0 nhanh gấp đôi PCIe 4.0; PCIe 4.0 nhanh gấp đôi 3.0.
- **Hiện tượng chia Làn (Bifurcation):** Khi Mainboard B760/B650 giá rẻ thiết kế chia sẻ băng thông. Nếu khách cắm ổ cứng NVMe vào khe M.2 phụ thứ 2 hoặc thứ 3, băng thông của khe Card màn hình sẽ bị "ăn cắp" và chia đôi (Từ x16 tụt xuống x8). 
  - *Tư vấn của AI:* Nếu khách dùng Card hạng nặng (RTX 4080/4090) mà muốn cắm 3-4 ổ cứng NVMe, BẮT BUỘC AI phải ép khách lên Mainboard dòng Z (Z790/Z890) hoặc dòng X (X870) để có đủ "đường cao tốc", tránh bóp chết hiệu năng Card màn hình.

## 6. KẾT NỐI I/O, ÂM THANH & MẠNG (TÍNH NĂNG ĂN TIỀN)
- **Cổng ARGB Gen 2 (5V 3-pin) vs RGB (12V 4-pin):**
  - **ARGB (Addressable RGB):** Cổng 3 chân. Cho phép chỉnh màu từng bóng LED riêng biệt (như hiệu ứng cầu vồng chạy). Đây là tiêu chuẩn hiện tại.
  - **RGB:** Cổng 4 chân cổ lỗ sĩ. Cả dây quạt chỉ sáng được 1 màu cùng lúc. Cắm nhầm dây ARGB 5V vào cổng RGB 12V trên main SẼ GÂY CHÁY ĐÈN LED NGAY LẬP TỨC. AI cần nhắc khách.
- **Chip Âm thanh (Audio DAC):** Main rẻ dùng Realtek ALC897 (Nghe nhạc tạm ổn). Main đắt tiền dùng ALC1220 hoặc ALC4080 tích hợp amply kéo tai nghe chuyên nghiệp (ESS Sabre DAC), âm thanh vòm 7.1 chuẩn phòng thu.
- **LAN & Wi-Fi:** Mainboard 2026 tiêu chuẩn phải có cổng mạng dây LAN 2.5 Gbps (bỏ qua cổng 1 Gigabit cũ). Kết nối không dây được trang bị Wi-Fi 7 mới nhất, tốc độ download ngang ngửa cắm dây cáp.

## 7. TÍNH NĂNG CHUẨN ĐOÁN LỖI (TROUBLESHOOTING DÀNH CHO AI)
- **EZ Debug LED:** 4 bóng đèn nhỏ xíu trên góc phải Mainboard (Đánh dấu: BOOT, VGA, DRAM, CPU). Khi bật máy không lên hình, đèn sáng ở chữ nào thì linh kiện đó hỏng/lỗi.
  - Đèn DRAM sáng: Lỏng RAM, hỏng RAM, khe RAM bẩn.
  - Đèn CPU sáng: Cong chân socket, hỏng CPU, quên cắm cáp nguồn CPU.
  - Đèn VGA sáng: Lỏng Card màn hình, quên cắm cáp nguồn phụ cho Card.
  - Đèn BOOT sáng: Chết ổ cứng, mất phân vùng Windows.
- **BIOS Flashback (Flash BIOS Button):** Tính năng cứu mạng. Cho phép khách hàng cắm USB chứa file BIOS vào và bấm nút nâng cấp BIOS MÀ KHÔNG CẦN LẮP CPU HAY RAM. Rất hữu ích khi khách mua Main đời cũ nhưng muốn cắm CPU đời mới (Ví dụ mua B660 cắm i5-14400F).
- **Clear CMOS:** Nút bấm (hoặc jumper) để reset BIOS về mặc định của nhà máy. Giải pháp tối thượng khi khách hàng nghịch dại Ép xung RAM/CPU quá đà dẫn đến máy không bật lên được.

## 8. KỊCH BẢN Q&A ĐỐI ĐÁP KHÁCH HÀNG KHÓ TÍNH
- **Khách hỏi:** "Sao con Main ASUS B760M-K giá 2 triệu, mà con ASUS ROG B760-G WIFI giá tới 5 triệu rưỡi? Đều là chip B760 cắm i5 mà em, mồi chài anh à?"
  - **AI Đáp:** "Dạ thưa anh, dù chung bộ não B760, nhưng bản ROG Strix 5.5 triệu đắt hơn vì nó được trang bị dàn điện (VRM) 12+1 phase DrMOS cực khủng so với chỉ 6 phase của bản K. Nghĩa là bản ROG sau này anh có thể nâng cấp cắm i9 vẫn vô tư không bị nóng sập máy. Ngoài ra nó còn có PCB 6 lớp, tản nhiệt nhôm bao phủ toàn bộ khối điện, chip âm thanh xịn ALC1220 và trang bị sẵn Wi-Fi 6E/Bluetooth 5.3 tốc độ cao. Tiền nào của nấy, bản ROG là khoản đầu tư đường dài tuyệt vời anh ạ!"
- **Khách hỏi:** "Main anh đang dùng ghi là B650M. Chữ M nghĩa là gì em?"
  - **AI Đáp:** "Dạ chữ 'M' viết tắt của Form Factor (Kích thước) **Micro-ATX (mATX)** anh nhé. Đây là chuẩn main hình vuông (thường có kích thước 24.4 x 24.4 cm), nhỏ hơn chuẩn ATX hình chữ nhật. Ưu điểm là lắp vừa các vỏ Case nhỏ gọn, giá thành rẻ hơn. Nhược điểm là thường bị cắt bớt một vài khe cắm ổ cứng hoặc khe cắm phụ PCIe so với bản ATX to ạ."