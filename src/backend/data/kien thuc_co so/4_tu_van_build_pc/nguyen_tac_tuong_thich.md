# ĐẠI TỪ ĐIỂN NGUYÊN TẮC PHỐI GHÉP PC (MASTER BUILDER PRINCIPLES 2026)

## 1. NGUYÊN TẮC "NGHẼN CỔ CHAI" TOÀN DIỆN (THE BOTTLENECK THEORIES)
*Lưu ý cho AI: Nghẽn cổ chai không chỉ nằm ở CPU và VGA, mà nó nằm ở mọi "điểm giao cắt" dữ liệu.*
- **CPU Bottleneck (Nghẽn do CPU yếu):** Xảy ra khi chơi game ở độ phân giải thấp (Full HD) với Card khủng (RTX 4080). CPU không tính toán kịp khung hình để giao cho VGA vẽ. **Dấu hiệu:** CPU chạy 100% nhưng VGA chỉ chạy 50%. Tụt FPS trầm trọng.
- **GPU Bottleneck (Nghẽn do VGA yếu):** Xảy ra khi ép máy chơi game 4K trên Card yếu (RTX 4060). Đây là loại nghẽn "chấp nhận được" vì VGA được vắt kiệt 100% công suất, chỉ cần khách hạ setting đồ họa xuống là xong.
- **PCIe Lane Bottleneck (Nghẽn băng thông khe cắm):** Lắp Card đồ họa chuẩn PCIe 4.0 x8 (như RTX 4060) vào Mainboard đời tống chỉ hỗ trợ PCIe 3.0. Băng thông bị chia đôi, gây giật lag khi VRAM bị đầy.
- **VRAM Bottleneck (Tràn bộ nhớ đệm):** Mua Card VGA quá ít VRAM (8GB) để chơi game AAA năm 2026. Khi VRAM đầy, Card sẽ phải mượn RAM hệ thống (chậm hơn rất nhiều) -> Gây ra hiện tượng khựng khựng (Stuttering) khi xoay góc nhìn.

## 2. NGUYÊN TẮC TƯƠNG THÍCH VẬT LÝ (PHYSICAL CLEARANCES)
*Lỗi phổ biến nhất của thợ mới vào nghề: Mua linh kiện xịn nhưng "lắp không vừa".*
- **GPU Clearance (Chiều dài VGA vs Vỏ Case):** Phải luôn kiểm tra chiều dài VGA (ví dụ: 340mm) có nhỏ hơn mức hỗ trợ tối đa của Vỏ Case (ví dụ: 360mm) hay không. Phải trừ hao thêm 20-30mm nếu khách lắp tản nhiệt nước Radiator ở mặt trước case.
- **CPU Cooler Clearance (Chiều cao Tản khí vs Vỏ Case):** Tản tháp đôi thường cao 160mm - 165mm. Nếu vỏ case chỉ hỗ trợ 155mm, khách sẽ không thể đóng được nắp kính cường lực.
- **RAM vs Air Cooler (Cấn RAM):** Các tản nhiệt khí khổng lồ (như Noctua D15) sẽ che khuất khe cắm RAM. Nếu khách mua RAM có LED RGB nhô cao (ví dụ: Corsair Dominator cao 55mm), quạt tản nhiệt sẽ bị cấn không lắp được. **Giải pháp:** Đổi sang RAM Low-Profile (như Flare X5 cao 33mm) hoặc đổi sang Tản nhiệt nước AIO.
- **Radiator Thickness (Độ dày két nước):** Lắp tản AIO 360mm trên nóc case thường bị cấn vào cụm tản nhiệt VRM của Mainboard hoặc cấn RAM nếu case quá hẹp.

## 3. NGUYÊN TẮC NĂNG LƯỢNG VÀ PHA ĐIỆN (POWER & VRM MATCHING)
- **Sự tương xứng của VRM (Dàn điện Mainboard):** Tuyệt đối không tư vấn CPU Core i9 hoặc Ryzen 9 cắm vào Mainboard giá rẻ (H610, B760M-K). Dàn điện (VRM) của main cỏ sẽ quá nhiệt (lên tới 110°C) và tự động "bóp dái" xung nhịp CPU xuống mức thấp nhất để chống cháy.
- **Nguyên tắc "Transient Spikes" (Sốc điện đỉnh):** Card đồ họa cao cấp (RTX 4080/4090) có thể tạo ra những cú ăn điện tăng vọt gấp 2-3 lần mức công bố trong 1 mili-giây. Phải luôn tư vấn Nguồn chuẩn **ATX 3.1** để hấp thụ những cú sốc này, giúp máy không bị sập nguồn đen màn hình.

## 4. NGUYÊN TẮC BĂNG THÔNG RAM (MEMORY TOPOLOGY)
- **QVL (Qualified Vendor List):** Trước khi chốt RAM Bus siêu cao (7200MHz+), phải check xem mã RAM đó có nằm trong danh sách hỗ trợ (QVL) của Mainboard đó không. Nếu không, máy sẽ xanh màn hình hoặc tự rớt Bus.
- **Daisy Chain Topology:** 95% Mainboard hiện nay dùng cấu trúc đi dây Daisy Chain (Tối ưu nhất cho 2 thanh RAM). Do đó, cắm 2 thanh 16GB sẽ luôn ép xung và chạy ổn định hơn là cắm 4 thanh 8GB. 
- **Nguyên lý cho AI:** Nếu khách muốn 64GB, hãy chốt 2 thanh 32GB thay vì 4 thanh 16GB để giảm tải cho bộ điều khiển bộ nhớ (IMC) của CPU.

## 5. NGUYÊN TẮC TỐI ƯU THEO NHU CẦU THỰC TẾ (USE-CASE TARGETING)
- **Tối ưu Game Esports / Tối ưu phần mềm đơn nhân:** Nếu khách chỉ chuyên cày rank mượt mà các tựa game như FC Online, hoặc thích xây các siêu công trình đồ sộ trong thế giới mở như Minecraft, hệ thống không đòi hỏi VGA siêu khủng như RTX 4080. AI cần tập trung ngân sách dồn vào một con CPU có **xung nhịp đơn nhân (Single-core IPC) cực cao** (như Ryzen 5 7600X hoặc i5-14600K) và **RAM có độ trễ cực thấp** (CL28/CL30). Điều này sẽ đẩy FPS lên cao nhất và xóa bỏ hoàn toàn hiện tượng khựng khung hình (1% Low FPS).
- **Tối ưu Đồ họa 3D / Render (Blender, V-Ray):** Dồn tối đa tiền vào Card đồ họa (Càng nhiều nhân CUDA càng tốt) và VRAM khổng lồ. CPU chỉ cần ở mức khá để quản lý tác vụ.
- **Tối ưu Làm Video (Premiere, DaVinci):** Bắt buộc phải có CPU Intel hỗ trợ **Intel Quick Sync** (Các dòng CPU không có chữ F) để review video không bị giật. Đòi hỏi lượng RAM cực lớn (tối thiểu 32GB - 64GB).

## 6. KỊCH BẢN CHỐT ĐƠN VÀ XỬ LÝ SỰ CỐ (MASTER LEVEL SCRIPT)
- **Khách hỏi:** "Sao cấu hình anh tự build mang ra thợ lắp, chơi game thi thoảng bị văng ra Desktop không báo lỗi?"
    - **AI Đáp:** "Dạ hiện tượng văng game đột ngột thường do anh kích hoạt XMP/EXPO nhưng **RAM và Mainboard không hoàn toàn tương thích (trượt QVL)**, hoặc do anh cắm 4 thanh RAM khiến bộ điều khiển bộ nhớ bị quá tải. Anh thử vào BIOS hạ Bus RAM xuống một nấc (ví dụ từ 6000 xuống 5600) xem máy có hết bệnh không nhé. Nếu mua tại TechStore, bên em luôn test độ ổn định RAM bằng MemTest86 trước khi giao máy cho khách ạ!"
- **Khách hỏi:** "Anh muốn nâng cấp Card từ GTX 1650 lên thẳng RTX 4070 Ti, có cần thay gì nữa không?"
    - **AI Đáp:** "Dạ anh cần kiểm tra ngay 3 thứ giúp em ạ: 
        1. **Nguồn (PSU)** của anh có đủ 750W-850W không? 
        2. **Vỏ case** của anh có nhét vừa con Card dài trên 30cm này không? 
        3. **CPU** của anh đang dùng đời nào? Nếu cũ quá (như Core i3 Gen 10) thì sẽ bị nghẽn cổ chai nặng, Card xịn cũng chỉ chạy được nửa công suất thôi anh nhé!"
# BÁCH KHOA TOÀN THƯ: NGUYÊN TẮC PHỐI GHÉP PC CHUYÊN SÂU (MASTER CLASS 2026)

## 7. NGUYÊN TẮC CHIA CHÁC BĂNG THÔNG (PCIe LANES & DMI BOTTLENECK)
*Lưu ý cho AI: Khách mua mainboard nhiều khe cắm không có nghĩa là cắm đầy sẽ chạy tối đa tốc độ.*
- **Giới hạn Làn PCIe (PCIe Lanes):** CPU phổ thông (Core i5/i7, Ryzen 5/7) chỉ có một số lượng làn PCIe nhất định (thường là 20-28 làn).
  - Card màn hình (VGA) ăn mất **16 làn (x16)**.
  - Ổ cứng SSD M.2 NVMe ăn mất **4 làn (x4)**.
- **Hiện tượng "Ăn lẹm" băng thông:** Nếu khách cắm 3-4 ổ SSD M.2 NVMe trên cùng một Mainboard tầm trung (B760/B650), Mainboard sẽ tự động chia lại băng thông. Khe cắm VGA có thể bị bóp từ x16 xuống x8, làm giảm nhẹ hiệu năng Card đồ họa cao cấp. Hoặc cắm SSD M.2 khe số 3 sẽ tự động vô hiệu hóa (disable) 2 cổng SATA cắm ổ HDD.
- **DMI Bottleneck (Nghẽn cổ chai cầu nối):** Chipset Mainboard giao tiếp với CPU qua một "cây cầu" gọi là DMI. Nếu khách hàng vắt kiệt băng thông từ các cổng USB tốc độ cao, mạng LAN 2.5G, và SSD cắm trên Chipset cùng một lúc, "cây cầu" này sẽ bị kẹt xe, gây độ trễ toàn hệ thống.

## 8. NGUYÊN TẮC DÂY NGUỒN VÀ DÒNG ĐIỆN TRANSIENT (CABLE MANAGEMENT RULES)
*Lỗi này gây cháy Card màn hình nhiều nhất.*
- **Quy tắc Pigtail (Dây nguồn chữ Y):** Với các Card đồ họa ăn nhiều điện (từ RTX 4070 Ti / RX 7800 XT trở lên), **TUYỆT ĐỐI KHÔNG** dùng 1 sợi dây nguồn có 2 đầu 8-pin (Pigtail) cắm chung vào Card. Một sợi dây cáp thường chỉ chịu tải an toàn khoảng 150W-225W. Phải tư vấn khách cắm **2 hoặc 3 sợi cáp PCIe riêng biệt** từ Nguồn (PSU) kéo lên Card để chia đều dòng điện, chống chảy nhựa đầu cắm.
- **Tiêu chuẩn Dây 12V-2x6 (ATX 3.1):** Khi tư vấn lắp Card RTX 40 Super / RTX 50 Series, bắt buộc phải báo khách cắm cáp 12V-2x6 kêu cái "Tách" và không được uốn cong dây ở cự ly quá gần đầu cắm (phải chừa ít nhất 3.5cm chiều thẳng) để tránh lỏng chân tín hiệu.

## 9. KHÍ ĐỘNG HỌC & ÁP SUẤT VỎ CASE (ADVANCED AIRFLOW THERMODYNAMICS)
- **Hiệu ứng Ống khói (Stack Effect):** Khí nóng luôn bay lên trên. Do đó, quạt nóc vỏ case **BẮT BUỘC** phải là quạt thổi ra (Exhaust). Nếu lắp quạt nóc hút gió vào, nó sẽ thổi ngược khí nóng từ VGA quay lại đập vào CPU, biến vỏ case thành cái lò lướng.
- **Xung đột luồng khí (Airflow Turbulence):** Trong các vỏ case bể cá (Panoramic) dùng quạt đáy hút lên (đập thẳng vào quạt VGA), nhưng nếu khách lắp thêm tản nhiệt khí CPU tháp đôi nằm ngang quá sát VGA, luồng khí sẽ bị nhiễu loạn. Tư vấn tối ưu nhất cho case bể cá là dùng Tản nhiệt nước AIO 360mm lắp trên nóc.
- **Áp suất dương tĩnh (Positive Pressure Tuning):** Luôn tư vấn khách lắp số quạt hút vào (Intake) nhiều hơn hoặc quay mạnh hơn số quạt thổi ra (Exhaust). Khí thừa sẽ tự tìm các khe hở của case đẩy ra ngoài, mang theo bụi. Nếu làm ngược lại (Áp suất âm), case sẽ hút bụi từ mọi khe hở như máy hút bụi.

## 10. ĐỒNG BỘ RAM - CPU Ở CẤP ĐỘ VI MÔ (GEAR & FABRIC SYNC)
- **Hệ sinh thái Intel (Gear 1 vs Gear 2):** - Khi cắm RAM DDR4 Bus 3200-3600MHz, AI phải nhắc kỹ thuật viên chỉnh BIOS chạy ở chế độ **Gear 1** (Tỉ lệ 1:1 với bộ điều khiển bộ nhớ). Độ trễ sẽ cực thấp.
  - Khi cắm RAM DDR5 Bus 6000MHz+, bắt buộc phải chạy **Gear 2** (Tỉ lệ 1:2) vì CPU không thể gánh nổi tốc độ 1:1.
- **Hệ sinh thái AMD (FCLK - Infinity Fabric):** - Điểm ngọt (Sweet spot) của Ryzen 7000/9000 là RAM Bus 6000MHz. Ở mức này, xung nhịp RAM (MCLK), bộ điều khiển bộ nhớ (UCLK) và Infinity Fabric (FCLK) hoạt động đồng bộ hoàn hảo (1:1). Nếu khách tham mua RAM Bus 7200MHz lắp cho AMD, hệ thống sẽ tự nhảy về tỉ lệ chia 1:2, làm tăng độ trễ và khiến FPS khi đá FC Online hoặc load các map Minecraft khổng lồ bị sụt giảm.

## 11. HỆ SINH THÁI LED RGB & ĐỒNG BỘ MÀU SẮC (THE RGB NIGHTMARE)
*Lưu ý cho AI: Khách cực kỳ ghét việc linh kiện sáng mỗi cái một màu không chỉnh được.*
- **Xung đột Điện áp (Cực kỳ nguy hiểm):** - Chân cắm **12V RGB (4-pin):** Chỉ đổi được 1 màu cho toàn dải LED cùng lúc.
  - Chân cắm **5V ARGB (3-pin):** Đổi được màu từng bóng LED (Rainbow).
  - *Cảnh báo kỹ thuật:* Nếu cắm nhầm dây LED 5V của quạt vào chân 12V trên Mainboard -> Cháy toàn bộ dàn LED ngay lập tức. AI phải luôn nhắc kiểm tra kỹ chân cắm.
- **Xung đột Phần mềm (Software Conflict):** Nếu khách mua Mainboard ASUS (dùng Armory Crate), RAM Corsair (dùng iCUE), Quạt NZXT (dùng CAM). 3 phần mềm này sẽ "đánh nhau" tranh giành quyền điều khiển Windows, gây giật lag máy.
  - *Giải pháp tư vấn:* AI nên hướng khách mua linh kiện cùng một hệ sinh thái (Ví dụ: Main MSI + Quạt MSI + RAM chuẩn Mystic Light) hoặc dùng phần mềm bên thứ 3 như **SignalRGB** để gom tất cả về một mối.

## 12. TƯƠNG THÍCH KIẾN TRÚC NHÂN HỖN HỢP (P-CORE & E-CORE INTEL)
- Kể từ Intel Gen 12 trở đi (12th, 13th, 14th), CPU có 2 loại nhân: Nhân hiệu năng cao (P-Core) và Nhân tiết kiệm điện (E-Core).
- **Nguyên tắc Hệ điều hành:** Bắt buộc tư vấn khách hàng cài đặt **Windows 11**. Windows 10 không có bộ điều phối Thread Director tối ưu, nên nó thường đẩy nhầm các tác vụ nặng (như chơi game) vào nhân E-Core yếu ớt, dẫn đến game chạy giật lag không rõ nguyên nhân.

## 13. KỊCH BẢN CHỐT ĐƠN CẤP ĐỘ "TỔNG TƯ LỆNH" (AI MASTER SCRIPT)
- **Khách hỏi:** "Anh muốn lắp 4 thanh RAM 16GB DDR5 Bus 6400MHz cho đầy khe nhìn cho đẹp, main của anh là Z790 xịn rồi chắc cân được đúng không?"
  - **AI Đáp:** "Dạ thưa anh, Mainboard Z790 dù xịn đến mấy thì bộ điều khiển bộ nhớ (IMC) bên trong CPU hiện tại vẫn rất đuối khi phải gánh 4 thanh RAM DDR5 tốc độ cao. Nếu anh cắm 4 thanh, máy thường sẽ tự bóp Bus xuống chỉ còn 4000MHz hoặc thậm chí không lên hình. Giải pháp an toàn nhất để vừa đạt Bus 6400MHz vừa đẹp là anh lấy **Kit 2 thanh RAM 32GB**, sau đó lắp thêm 2 thanh **RAM giả (Dummy Kit - chỉ có LED không có chip nhớ)** để lấp đầy khe trống. Vừa đẹp, vừa giữ nguyên hiệu năng đỉnh cao ạ!"
- **Khách hỏi:** "Anh định lấy Mainboard B760M giá rẻ lắp với i7-14700K cho tiết kiệm để đập tiền vào Card, có ổn không em?"
  - **AI Đáp:** "Dạ i7-14700K là một con 'quái thú' ăn tới hơn 250W điện khi chạy nặng. Dàn pha điện (VRM) của main B760M giá rẻ không thể chịu nổi mức nhiệt lượng này, nó sẽ bị quá nhiệt trên 100 độ C và tự động bóp xung nhịp CPU của anh xuống chỉ còn ngang con i5 thôi ạ. Anh nên đổi sang Mainboard **Z790** hoặc các dòng **B760M dòng cao cấp (như Mortar, TUF)** có tản nhiệt VRM bằng nhôm khối bọc kín để CPU bung hết sức mạnh nhé!"