import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiLayers, FiTag, FiChevronDown, FiChevronRight, FiSearch } from 'react-icons/fi';
import './AdminSubcategories.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminSubcategories() {
  const [categories, setCategories] = useState([]);
  const [subcategoriesData, setSubcategoriesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      fetchAllSubcategories();
    }
  }, [categories]);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/categories/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data);
      // Auto expand all categories
      const expanded = {};
      response.data.forEach(cat => {
        expanded[cat.name] = true;
      });
      setExpandedCategories(expanded);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
    }
  };

  const fetchAllSubcategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const data = {};
      
      for (const cat of categories) {
        try {
          const response = await axios.get(`${API_URL}/categories/subcategories/${encodeURIComponent(cat.name)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          data[cat.name] = response.data || [];
        } catch (err) {
          data[cat.name] = [];
        }
      }
      
      setSubcategoriesData(data);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục con:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const getFilteredCategories = () => {
    if (!selectedCategory && !searchTerm) {
      return categories;
    }
    
    return categories.filter(cat => {
      if (selectedCategory && cat.name !== selectedCategory) {
        return false;
      }
      
      if (searchTerm) {
        const subs = subcategoriesData[cat.name] || [];
        const hasMatchingSubcategory = subs.some(sub => 
          sub.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return hasMatchingSubcategory || cat.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      
      return true;
    });
  };

  const getFilteredSubcategories = (categoryName) => {
    const subs = subcategoriesData[categoryName] || [];
    if (!searchTerm) return subs;
    
    return subs.filter(sub => 
      sub.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getTotalSubcategories = () => {
    return Object.values(subcategoriesData).reduce((total, subs) => total + subs.length, 0);
  };

  if (loading) {
    return (
      <div className="admin-subcategories">
        <div className="loading-spinner">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="admin-subcategories">
      <div className="page-header">
        <div className="header-left">
          <FiLayers className="page-icon" />
          <div>
            <h1>Quản lý danh mục con</h1>
            <p>Tổng cộng {getTotalSubcategories()} danh mục con trong {categories.length} danh mục chính</p>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm danh mục con..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="category-filter"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map(cat => (
            <option key={cat._id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="subcategories-list">
        {getFilteredCategories().map(cat => {
          const subs = getFilteredSubcategories(cat.name);
          const isExpanded = expandedCategories[cat.name];
          
          return (
            <div key={cat._id} className="category-section">
              <div 
                className="category-header"
                onClick={() => toggleCategory(cat.name)}
              >
                <div className="category-info">
                  {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                  <span className="category-icon">
                    {cat.icon?.startsWith('http') || cat.icon?.startsWith('/') ? (
                      <img src={cat.icon} alt={cat.name} />
                    ) : (
                      cat.icon || '📦'
                    )}
                  </span>
                  <span className="category-name">{cat.name}</span>
                </div>
                <span className="subcategory-count">
                  {subs.length} danh mục con
                </span>
              </div>
              
              {isExpanded && (
                <div className="subcategories-grid">
                  {subs.length > 0 ? (
                    subs.map((sub, index) => (
                      <div key={index} className="subcategory-tag">
                        <FiTag className="tag-icon" />
                        <span>{sub}</span>
                      </div>
                    ))
                  ) : (
                    <div className="no-subcategories">
                      Không có danh mục con nào
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdminSubcategories;
