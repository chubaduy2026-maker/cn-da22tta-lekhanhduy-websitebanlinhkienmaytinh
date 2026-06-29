import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiUsers, FiTrash2, FiRefreshCw, FiSearch, FiShield, FiUser, FiLock, FiUnlock } from 'react-icons/fi';
import Swal from 'sweetalert2';
import './AdminUsers.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/users`, {
        params: { page: currentPage, limit: 20 },
        headers: { Authorization: `Bearer ${token}` }
      });

      setUsers(response.data.users || response.data);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách users:', error);
      Swal.fire('Lỗi', 'Không thể tải danh sách người dùng!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    const result = await Swal.fire({
      title: 'Xác nhận',
      text: `Bạn có chắc muốn thay đổi quyền user này thành "${newRole}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/admin/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Swal.fire('Thành công', 'Cập nhật quyền thành công!', 'success');
      fetchUsers();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi khi cập nhật quyền!', 'error');
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const action = currentStatus ? 'khóa' : 'mở khóa';
    const result = await Swal.fire({
      title: 'Xác nhận',
      text: `Bạn có chắc muốn ${action} user này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/admin/users/${userId}/toggle-status`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Swal.fire('Thành công', `Đã ${action} user thành công!`, 'success');
      fetchUsers();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || `Có lỗi khi ${action} user!`, 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc muốn xóa user này? Hành động này không thể hoàn tác!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_URL}/admin/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Swal.fire('Đã xóa!', 'Đã xóa user thành công!', 'success');
      fetchUsers();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi khi xóa user!', 'error');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(user => {
    const matchRole = roleFilter === 'all' || user.role === roleFilter;
    const matchSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchRole && matchSearch;
  });

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="admin-users">
      <div className="users-header">
        <h1>
          <FiUsers /> Quản lý Người dùng
        </h1>
        <button className="btn-refresh" onClick={fetchUsers}>
          <FiRefreshCw /> Làm mới
        </button>
      </div>

      <div className="users-filters">
        <div className="filter-group">
          <FiShield className="filter-icon" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="role-filter"
          >
            <option value="all">Tất cả quyền</option>
            <option value="customer">Khách hàng</option>
            <option value="staff">Nhân viên</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="search-group">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="users-stats">
          <span className="stat-item">
            Tổng: <strong>{filteredUsers.length}</strong> người dùng
          </span>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Quyền</th>
              <th>Trạng thái</th>
              <th>Ngày đăng ký</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  Không có người dùng nào
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td className="user-name">
                    <div className="name-with-icon">
                      {user.role === 'admin' ? <FiShield className="admin-icon" /> : <FiUser className="user-icon" />}
                      <strong>{user.name}</strong>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role === 'admin' ? 'Quản trị viên' : (user.role === 'staff' ? 'Nhân viên' : 'Khách hàng')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.isActive !== false ? 'active' : 'inactive'}`}>
                      {user.isActive !== false ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td className="user-date">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="user-actions">
                    <select
                      className="role-select"
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user._id, e.target.value)}
                      title="Thay đổi quyền"
                    >
                      <option value="customer">Khách hàng</option>
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản trị viên</option>
                    </select>

                    <button
                      className={`btn-toggle ${user.isActive !== false ? 'lock' : 'unlock'}`}
                      onClick={() => handleToggleStatus(user._id, user.isActive !== false)}
                      title={user.isActive !== false ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                    >
                      {user.isActive !== false ? <FiLock /> : <FiUnlock />}
                    </button>

                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteUser(user._id)}
                      title="Xóa người dùng"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {
        totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn-page"
            >
              Trước
            </button>
            <span className="page-info">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn-page"
            >
              Sau
            </button>
          </div>
        )
      }
    </div >
  );
}

export default AdminUsers;

