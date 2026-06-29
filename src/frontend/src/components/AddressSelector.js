import React, { useState, useEffect } from 'react';
import './AddressSelector.css';

// Danh sách 63 tỉnh thành Việt Nam chính thức
const PROVINCES = [
  // 5 Thành phố trực thuộc Trung ương
  { code: 1, name: 'Thành phố Hà Nội' },
  { code: 79, name: 'Thành phố Hồ Chí Minh' },
  { code: 31, name: 'Thành phố Hải Phòng' },
  { code: 48, name: 'Thành phố Đà Nẵng' },
  { code: 92, name: 'Thành phố Cần Thơ' },
  
  // Miền Bắc
  { code: 2, name: 'Tỉnh Hà Giang' },
  { code: 4, name: 'Tỉnh Cao Bằng' },
  { code: 6, name: 'Tỉnh Bắc Kạn' },
  { code: 8, name: 'Tỉnh Tuyên Quang' },
  { code: 10, name: 'Tỉnh Lào Cai' },
  { code: 11, name: 'Tỉnh Điện Biên' },
  { code: 12, name: 'Tỉnh Lai Châu' },
  { code: 14, name: 'Tỉnh Sơn La' },
  { code: 15, name: 'Tỉnh Yên Bái' },
  { code: 17, name: 'Tỉnh Hòa Bình' },
  { code: 19, name: 'Tỉnh Thái Nguyên' },
  { code: 20, name: 'Tỉnh Lạng Sơn' },
  { code: 22, name: 'Tỉnh Quảng Ninh' },
  { code: 24, name: 'Tỉnh Bắc Giang' },
  { code: 25, name: 'Tỉnh Phú Thọ' },
  { code: 26, name: 'Tỉnh Vĩnh Phúc' },
  { code: 27, name: 'Tỉnh Bắc Ninh' },
  { code: 30, name: 'Tỉnh Hải Dương' },
  { code: 33, name: 'Tỉnh Hưng Yên' },
  { code: 34, name: 'Tỉnh Thái Bình' },
  { code: 35, name: 'Tỉnh Hà Nam' },
  { code: 36, name: 'Tỉnh Nam Định' },
  { code: 37, name: 'Tỉnh Ninh Bình' },
  
  // Miền Trung
  { code: 38, name: 'Tỉnh Thanh Hóa' },
  { code: 40, name: 'Tỉnh Nghệ An' },
  { code: 42, name: 'Tỉnh Hà Tĩnh' },
  { code: 44, name: 'Tỉnh Quảng Bình' },
  { code: 45, name: 'Tỉnh Quảng Trị' },
  { code: 46, name: 'Tỉnh Thừa Thiên Huế' },
  { code: 49, name: 'Tỉnh Quảng Nam' },
  { code: 51, name: 'Tỉnh Quảng Ngãi' },
  { code: 52, name: 'Tỉnh Bình Định' },
  { code: 54, name: 'Tỉnh Phú Yên' },
  { code: 56, name: 'Tỉnh Khánh Hòa' },
  { code: 58, name: 'Tỉnh Ninh Thuận' },
  { code: 60, name: 'Tỉnh Bình Thuận' },
  
  // Tây Nguyên
  { code: 62, name: 'Tỉnh Kon Tum' },
  { code: 64, name: 'Tỉnh Gia Lai' },
  { code: 66, name: 'Tỉnh Đắk Lắk' },
  { code: 67, name: 'Tỉnh Đắk Nông' },
  { code: 68, name: 'Tỉnh Lâm Đồng' },
  
  // Miền Nam
  { code: 70, name: 'Tỉnh Bình Phước' },
  { code: 72, name: 'Tỉnh Tây Ninh' },
  { code: 74, name: 'Tỉnh Bình Dương' },
  { code: 75, name: 'Tỉnh Đồng Nai' },
  { code: 77, name: 'Tỉnh Bà Rịa - Vũng Tàu' },
  { code: 80, name: 'Tỉnh Long An' },
  { code: 82, name: 'Tỉnh Tiền Giang' },
  { code: 83, name: 'Tỉnh Bến Tre' },
  { code: 84, name: 'Tỉnh Trà Vinh' },
  { code: 86, name: 'Tỉnh Vĩnh Long' },
  { code: 87, name: 'Tỉnh Đồng Tháp' },
  { code: 89, name: 'Tỉnh An Giang' },
  { code: 91, name: 'Tỉnh Kiên Giang' },
  { code: 93, name: 'Tỉnh Hậu Giang' },
  { code: 94, name: 'Tỉnh Sóc Trăng' },
  { code: 95, name: 'Tỉnh Bạc Liêu' },
  { code: 96, name: 'Tỉnh Cà Mau' }
];

const AddressSelector = ({ value, onChange, required = false }) => {
  const [provinces] = useState(PROVINCES);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  
  const [loading, setLoading] = useState(false);

  // Parse existing value if provided
  useEffect(() => {
    if (value) {
      const parts = value.split(', ');
      if (parts.length >= 1) setDetailedAddress(parts[0]);
    }
  }, [value]);

  const fetchDistricts = async (provinceCode) => {
    try {
      setLoading(true);
      const response = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
      const data = await response.json();
      setDistricts(data.districts || []);
      setWards([]);
    } catch (error) {
      console.error('Error fetching districts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWards = async (districtCode) => {
    try {
      setLoading(true);
      const response = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
      const data = await response.json();
      setWards(data.wards || []);
    } catch (error) {
      console.error('Error fetching wards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProvinceChange = (e) => {
    const provinceCode = e.target.value;
    const provinceName = e.target.options[e.target.selectedIndex].text;
    
    setSelectedProvince(provinceCode);
    setSelectedDistrict('');
    setSelectedWard('');
    setDistricts([]);
    setWards([]);
    
    if (provinceCode) {
      fetchDistricts(provinceCode);
      updateFullAddress(detailedAddress, '', '', provinceName);
    } else {
      updateFullAddress(detailedAddress, '', '', '');
    }
  };

  const handleDistrictChange = (e) => {
    const districtCode = e.target.value;
    const districtName = e.target.options[e.target.selectedIndex].text;
    const provinceName = provinces.find(p => p.code.toString() === selectedProvince)?.name || '';
    
    setSelectedDistrict(districtCode);
    setSelectedWard('');
    setWards([]);
    
    if (districtCode) {
      fetchWards(districtCode);
      updateFullAddress(detailedAddress, '', districtName, provinceName);
    } else {
      updateFullAddress(detailedAddress, '', '', provinceName);
    }
  };

  const handleWardChange = (e) => {
    const wardName = e.target.value;
    const districtName = districts.find(d => d.code.toString() === selectedDistrict)?.name || '';
    const provinceName = provinces.find(p => p.code.toString() === selectedProvince)?.name || '';
    
    setSelectedWard(wardName);
    updateFullAddress(detailedAddress, wardName, districtName, provinceName);
  };

  const handleDetailedAddressChange = (e) => {
    const address = e.target.value;
    const wardName = selectedWard;
    const districtName = districts.find(d => d.code.toString() === selectedDistrict)?.name || '';
    const provinceName = provinces.find(p => p.code.toString() === selectedProvince)?.name || '';
    
    setDetailedAddress(address);
    updateFullAddress(address, wardName, districtName, provinceName);
  };

  const updateFullAddress = (detailed, ward, district, province) => {
    const parts = [detailed, ward, district, province].filter(Boolean);
    const fullAddress = parts.join(', ');
    onChange(fullAddress);
  };

  return (
    <div className="address-selector">
      <div className="form-row">
        <div className="form-group">
          <label>Tỉnh/Thành phố {required && <span className="required">*</span>}</label>
          <select 
            value={selectedProvince} 
            onChange={handleProvinceChange}
            required={required}
            disabled={loading}
          >
            <option value="">-- Chọn Tỉnh/Thành phố --</option>
            {provinces.map(province => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Quận/Huyện {required && <span className="required">*</span>}</label>
          <select 
            value={selectedDistrict} 
            onChange={handleDistrictChange}
            required={required}
            disabled={!selectedProvince || loading}
          >
            <option value="">-- Chọn Quận/Huyện --</option>
            {districts.map(district => (
              <option key={district.code} value={district.code}>
                {district.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Phường/Xã {required && <span className="required">*</span>}</label>
          <select 
            value={selectedWard} 
            onChange={handleWardChange}
            required={required}
            disabled={!selectedDistrict || loading}
          >
            <option value="">-- Chọn Phường/Xã --</option>
            {wards.map(ward => (
              <option key={ward.code} value={ward.name}>
                {ward.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Số nhà, tên đường {required && <span className="required">*</span>}</label>
          <input 
            type="text"
            value={detailedAddress}
            onChange={handleDetailedAddressChange}
            placeholder="Ví dụ: 123 Nguyễn Văn Linh"
            required={required}
          />
        </div>
      </div>

      {value && (
        <div className="address-preview">
          <strong>Địa chỉ đầy đủ:</strong>
          <p>{value || 'Chưa nhập đủ thông tin'}</p>
        </div>
      )}
    </div>
  );
};

export default AddressSelector;
