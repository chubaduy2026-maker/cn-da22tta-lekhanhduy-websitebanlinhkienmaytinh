# ĐẠI TỪ ĐIỂN BẮT BỆNH PC - LỖI KHÔNG LÊN HÌNH & MÀN HÌNH XANH (2026)

## 1. BỆNH "QUẠT QUAY NHƯNG KHÔNG LÊN HÌNH" (NO POST / NO DISPLAY)
*Lỗi phổ biến nhất (chiếm 80% các ca cấp cứu online). AI cần hướng dẫn khách kiểm tra theo thứ tự từ dễ đến khó.*

### 1.1. Cắm sai cổng xuất hình (Lỗi kinh điển của Newbie)
- **Triệu chứng:** Máy mới mua, bật lên đèn LED sáng, quạt quay tít, màn hình báo "No Signal".
- **Bắt bệnh:** Khách mua máy có Card rời (VGA) nhưng lại cắm dây HDMI/DisplayPort vào cổng trên Mainboard.
- **Giải pháp AI hướng dẫn:** "Dạ anh kiểm tra lại phía sau thùng máy giúp em. Dây cáp màn hình phải cắm vào cổng ngang nằm tít bên dưới (của Card đồ họa rời), chứ không phải cụm cổng dọc ở phía trên (của Mainboard) đâu ạ. Cắm sai cổng là máy không xuất được hình đâu anh nhé!"

### 1.2. Lỏng RAM hoặc Dơ chân RAM
- **Triệu chứng:** Đang dùng bình thường, di chuyển máy hoặc lâu ngày bật không lên. Đèn báo lỗi DRAM trên mainboard sáng đỏ/vàng.
- **Giải pháp AI hướng dẫn:** "Dạ khả năng cao là chân RAM bị lỏng hoặc dính bụi ạ. Anh tắt hẳn máy, rút điện, tháo thanh RAM ra. Dùng cục tẩy (gôm) học sinh chà nhẹ lên hàng chân đồng cho sáng bóng, hoặc lấy chổi lông quét sạch khe cắm trên main. Sau đó anh cắm lại thật chặt (nghe tiếng tạch 2 đầu) rồi bật lại máy xem sao nhé!"

### 1.3. Lỗi cáp kết nối hoặc lỏng Card màn hình
- **Giải pháp AI hướng dẫn:** "Anh thử rút cáp HDMI/DisplayPort ra cắm lại, đổi thử sang cổng khác trên Card xem có lên không. Nếu thùng máy vừa vận chuyển xa, có thể Card đồ họa bị xệ hoặc xóc lỏng chân PCIe, anh nhấn nhẹ Card vào mainboard cho khít lại giúp em ạ."

### 1.4. Xả điện thừa (Clear CMOS)
- **Triệu chứng:** Máy bị treo do vọc vạch ép xung trong BIOS hoặc sốc điện nhẹ.
- **Giải pháp AI hướng dẫn:** "Dạ anh rút hẳn dây nguồn ra khỏi ổ điện. Tìm trên Mainboard có một cục pin tròn như đồng xu (Pin CMOS). Anh tháo cục pin đó ra, đợi khoảng 5 phút rồi lắp lại. Việc này sẽ đưa cài đặt BIOS về mặc định, giúp máy xả hết điện kẹt và khởi động lại bình thường ạ."

---

## 2. ÁC MỘNG MÀN HÌNH XANH (BLUE SCREEN OF DEATH - BSOD)
*AI cần biết cách đọc mã lỗi (Stop Code) để bắt đúng bệnh thay vì bảo khách "Cài lại Win đi".*

### 2.1. Mã lỗi: `MEMORY_MANAGEMENT`
- **Nguyên nhân:** Lỗi liên quan đến RAM (Bộ nhớ trong).
- **Giải pháp:** 1. Hướng dẫn khách chạy công cụ `Windows Memory Diagnostic` có sẵn trong Win.
  2. Nếu khách dùng nhiều thanh RAM, bảo khách tháo ra cắm thử từng thanh một để tìm ra thanh bị chết lỗi.
  3. Tư vấn khách tắt chế độ XMP/EXPO trong BIOS để xem máy có hết bị xanh màn không (do CPU không gánh nổi Bus RAM cao).

### 2.2. Mã lỗi: `WHEA_UNCORRECTABLE_ERROR`
- **Nguyên nhân:** Lỗi phần cứng vật lý nghiêm trọng, thường do ép xung (CPU/VGA) quá mức hoặc quá nhiệt (Nhiệt độ > 100 độ C).
- **Giải pháp:** 1. Kiểm tra xem quạt tản nhiệt CPU có đang quay không, hoặc bơm của tản nước AIO có bị chết không.
  2. Tắt toàn bộ các phần mềm ép xung (MSI Afterburner, ThrottleStop).
  3. Cảnh báo khách: "Dạ lỗi này báo hiệu phần cứng đang bị ép chạy quá sức. Anh đừng cố bật lại liên tục dễ gây cháy linh kiện. Anh kiểm tra ngay xem quạt tản nhiệt có hoạt động không giúp em nhé!"

### 2.3. Mã lỗi: `CRITICAL_PROCESS_DIED` hoặc `INACCESSIBLE_BOOT_DEVICE`
- **Nguyên nhân:** Ổ cứng SSD/HDD chứa Windows đang bị lỗi, lỏng chân cắm, hoặc file hệ thống của Win bị hỏng nặng.
- **Giải pháp:** 1. Tháo SSD M.2 ra vệ sinh chân đồng cắm lại.
  2. Dùng USB Boot chứa Win PE để vào cứu dữ liệu quan trọng, sau đó Format cài lại Windows trắng hoàn toàn.
  3. Nếu cài Win lại vẫn bị, 99% SSD đã hết tuổi thọ (Hết TBW), AI cần chốt đơn bán SSD mới.

### 2.4. Mã lỗi: `VIDEO_TDR_FAILURE` hoặc `nvlddmkm.sys`
- **Nguyên nhân:** Xung đột Driver Card màn hình (Đặc biệt hay gặp ở NVIDIA).
- **Giải pháp:** "Dạ lỗi này là do Driver Card hình của anh bị đụng độ phần mềm ạ. Anh tải phần mềm **DDU (Display Driver Uninstaller)** về để xóa sạch sành sanh Driver cũ đi, sau đó lên trang chủ NVIDIA tải bản Driver mới nhất về cài lại là hết bệnh 100% anh nhé!"

---

## 3. LỖI NHIỆT ĐỘ CỰC ĐOAN (THERMAL ISSUES)
- **Triệu chứng:** Chơi game được 10-15 phút là tụt FPS thê thảm (giật tung chảo) hoặc máy tự sập nguồn tối thui.
- **Bắt bệnh AI:** "Dạ tình trạng anh mô tả gọi là Thermal Throttling (Máy tự bóp hiệu năng để chống cháy). Anh kiểm tra giúp em xem keo tản nhiệt CPU đã khô chưa (nếu máy dùng trên 1 năm). Thứ 2 là xem lại hướng quạt vỏ case, nếu quạt đang thổi ngược khí nóng vào trong thì máy sẽ biến thành cái lò nướng ngay ạ!"
## 4. BẮT BỆNH LƯU TRỮ: Ổ CỨNG & THẺ NHỚ BỊ RAW (CORRUPTED STORAGE)
*Lưu ý cho AI: Khách hàng cực kỳ hoảng loạn khi dính lỗi này vì sợ mất dữ liệu quan trọng.*

- **Triệu chứng:** Cắm ổ cứng gắn ngoài, USB hoặc thẻ nhớ vào máy, Windows văng ra thông báo: **"You need to format the disk in drive X: before you can use it"**. 
- **Bắt bệnh:** Thiết bị lưu trữ đã bị mất định dạng hệ thống tập tin (File System) và biến thành định dạng RAW do rút nóng đột ngột hoặc sốc điện.
- **Giải pháp AI hướng dẫn (Cấp cứu dữ liệu):** - "Dạ anh/chị **TUYỆT ĐỐI KHÔNG BẤM FORMAT** nhé, thao tác đó sẽ xóa vĩnh viễn dữ liệu ạ!"
  - "Lỗi này do cấu trúc phân vùng bị hỏng. Anh tải ngay phần mềm mã nguồn mở **TestDisk** về máy. Đây là công cụ cực kỳ mạnh mẽ chạy trên nền DOS để dò lại bảng phân vùng (Partition Table) bị mất và khôi phục định dạng RAW trở lại NTFS/exFAT mà không làm rụng một byte dữ liệu nào ạ. Kỹ thuật viên bên em hay dùng công cụ này để cứu nét cho khách đấy ạ!"

## 5. PAN BỆNH ĐẶC THÙ TRÊN LAPTOP & WINDOWS UPDATE
*Lỗi phần mềm đôi khi còn gây ức chế hơn cả hỏng phần cứng.*

### 5.1. Bệnh Touchpad "Bán thân bất toại"
- **Triệu chứng:** Touchpad Laptop đang dùng bình thường bỗng dưng **chỉ nhận thao tác 1 ngón**, mất hoàn toàn các thao tác vuốt 2 ngón để cuộn trang hay 3 ngón để chuyển tab (Multi-touch gesture).
- **Bắt bệnh:** Không phải hỏng phần cứng! Thường do Windows Update tự động cài đè một bản Driver Generic (Driver chung chung) gây xung đột với chuẩn I2C HID Device của Touchpad.
- **Giải pháp AI hướng dẫn:** "Dạ lỗi này 90% do Windows Update cài nhầm Driver ạ. Anh click chuột phải vào biểu tượng Start -> Chọn **Device Manager** -> Tìm mục **Mice and other pointing devices** hoặc **Human Interface Devices**. Click đúp vào thiết bị Touchpad, chuyển sang tab Driver và bấm **Roll Back Driver** để trả về bản cũ. Nếu nút đó bị mờ, anh lên thẳng trang chủ của hãng laptop (Dell/Asus/HP), nhập mã máy và tải bản Driver Touchpad chuẩn xác nhất về cài đè lên là ăn ngay ạ!"

### 5.2. Lỗi Cập Nhật Windows "Cứng Đầu" (Mã lỗi 0x80070661 và tương tự)
- **Triệu chứng:** Windows Update tải file về nhưng khi cài đặt lại báo lỗi đỏ chót (Ví dụ: 0x80070661) và kẹt luôn ở đó, khởi động lại cũng không hết.
- **Bắt bệnh:** Mã lỗi 0x80070661 thường chỉ ra rằng gói cập nhật không tương thích với kiến trúc hệ thống hiện tại, hoặc thư mục chứa file tải về của Windows Update (`SoftwareDistribution`) đã bị rác/lỗi (corrupted cache).
- **Giải pháp AI hướng dẫn:** - "Dạ mã lỗi này thường do file update tải về bị hỏng dở dang hoặc sai phiên bản kiến trúc ạ. Anh mở thanh tìm kiếm, gõ **cmd**, bấm chuột phải chọn **Run as administrator**."
  - "Đầu tiên, anh gõ lệnh `sfc /scannow` để Windows tự quét và vá lỗi các file hệ thống."
  - "Nếu vẫn kẹt, anh cần làm sạch bộ nhớ tạm của Windows Update. Anh gõ lần lượt các lệnh dừng dịch vụ: `net stop wuauserv` và `net stop bits`. Sau đó, anh vào ổ C, theo đường dẫn `C:\Windows\SoftwareDistribution` và xóa sạch mọi thứ trong đó. Cuối cùng, khởi động lại máy và bấm Check for Updates lại từ đầu là Windows sẽ tự tải file mới tinh và mượt mà ạ!"

## 6. LỖI MẠNG LÝ TƯỞNG NHƯNG PING LẠI CAO (NETWORK GHOSTING)
- **Triệu chứng:** Gói cước mạng nhà rất mạnh (1Gbps), tải file vù vù, nhưng cứ vào game (như FC Online, Valorant) là Ping nhảy giật cục, xuất hiện biểu tượng Packet Loss (mất gói tin).
- **Bắt bệnh:** Xung đột phần mềm tối ưu mạng hoặc nhiễu sóng kênh Wi-Fi.
- **Giải pháp AI hướng dẫn:**
  - **Dùng mạng dây (LAN):** "Dạ anh kiểm tra xem Mainboard của anh có đang cài các phần mềm như 'Killer Control Center' hay 'CFosSpeed' không. Các phần mềm này quảng cáo là ưu tiên băng thông cho game nhưng thực tế lại gây can thiệp quá mức làm trễ gói tin. Anh gỡ sạch chúng ra là Ping sẽ phẳng lì ngay ạ!"
  - **Dùng Wi-Fi:** "Nếu anh cắm USB Wi-Fi ở mặt sau thùng máy, tín hiệu có thể bị block bởi khối kim loại của vỏ case và từ trường của Nguồn. Anh mua một sợi cáp nối dài USB, đưa cục thu Wi-Fi lên mặt bàn là sóng sẽ full vạch và hết giật lag ạ!"

## 7. BỆNH "NGHẼN CỔ CHAI" NGOẠI VI (USB & RGB CONFLICTS)
- **Triệu chứng:** Di chuột thỉnh thoảng bị khựng nhẹ 1 giây, hoặc bàn phím gõ thỉnh thoảng bị kẹt phím chạy dài (aaaaaaa), đèn LED RGB nháy loạn xạ.
- **Bắt bệnh:** Cắm chung đầu thu chuột/phím không dây (Receiver 2.4GHz) vào ngay sát cổng cắm USB 3.0 đang cắm ổ cứng di động, gây nhiễu sóng tần số vô tuyến (Radio Frequency Interference). Hoặc xung đột quá nhiều phần mềm điều khiển LED.
- **Giải pháp AI hướng dẫn:** "Dạ cổng USB 3.0 khi truyền dữ liệu sẽ phát ra một dải sóng gây nhiễu cực mạnh cho băng tần 2.4GHz của chuột phím không dây. Anh bắt buộc phải cắm đầu thu (Receiver) của chuột/phím vào cổng **USB 2.0 (màu đen)** và ưu tiên cắm ở mặt trước vỏ case để tránh nhiễu chéo từ các cổng màu xanh phía sau nhé!"