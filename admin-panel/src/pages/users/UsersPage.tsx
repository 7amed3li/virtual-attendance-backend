import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api, { userService } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  Input, 
  Button, 
  Table, 
  Space, 
  Tooltip, 
  Tag, 
  Select, 
  message,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Breadcrumb,
  Alert,
  Avatar,
  Badge,

} from 'antd';
import {
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  CrownOutlined,
  CheckCircleOutlined,

  SearchOutlined,

  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useRef } from "react";
import * as XLSX from "xlsx";

const { Title, Text } = Typography;
const { Search } = Input;

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  
  // Toplu silme için state'ler
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await userService.getAllUsers();
      setUsers(data.data || data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(t('error_loading_users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (id: string) => {
    if (window.confirm(t('confirm_delete_user'))) {
      try {
        await userService.deleteUser(id);
        message.success(t('user_deleted_successfully'));
        fetchUsers();
      } catch (err) {
        console.error('Error deleting user:', err);
        message.error(t('error_deleting_user'));
      }
    }
  };

  // Toplu silme fonksiyonu
  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      message.warning('Lütfen silmek istediğiniz kullanıcıları seçin');
      return;
    }

    const confirmMessage = `Seçilen ${selectedUsers.length} kullanıcıyı silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`;
    
    if (window.confirm(confirmMessage)) {
      setBulkDeleteLoading(true);
      try {
        // Backend'e toplu silme isteği gönder
        await userService.bulkDeleteUsers(selectedUsers);
        
        message.success(`${selectedUsers.length} kullanıcı başarıyla silindi`);
        setSelectedUsers([]); // Seçimleri temizle
        fetchUsers(); // Listeyi yenile
      } catch (err) {
        console.error('Error bulk deleting users:', err);
        message.error('Kullanıcılar silinirken hata oluştu');
      } finally {
        setBulkDeleteLoading(false);
      }
    }
  };

  // Tümünü seç/seçimi kaldır
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const allUserIds = filteredUsers.map(user => user.id);
      setSelectedUsers(allUserIds);
    } else {
      setSelectedUsers([]);
    }
  };

  // Tekil seçim
  const handleSelectUser = (userId: string, selected: boolean) => {
    if (selected) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleExcelImportClick = () => {
    fileInputRef.current?.click();
  };

  // استبدل الدالة القديمة بهذه الدالة الجديدة
  const handleExcelFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return; // إذا لم يختر المستخدم ملفًا، لا تفعل شيئًا
    }

    // استخدم FormData لإرسال الملف
    const formData = new FormData();
    formData.append('excelFile', file); // 'excelFile' هو الاسم الذي يتوقعه الخادم

    try {
      // استخدم axios instance الذي قمنا بإعداده في api.ts
      // تأكد من أنك قمت بعمل import لـ 'api' من '../../services/api'
      // المسار هنا صحيح لأنه سيتم دمجه مع baseURL
      const response = await api.post('/kullanici/import-excel', formData, {
        headers: {
          // يقوم المتصفح بتعيين هذا تلقائيًا عند استخدام FormData
          'Content-Type': 'multipart/form-data',
        },
      });

      // تحقق من نجاح الاستجابة
      if (response.status === 200 && response.data.success) {
        message.success('Kullanıcılar başarıyla içe aktarıldı!');
        fetchUsers(); // أعد تحميل قائمة المستخدمين
      } else {
        // عرض رسالة خطأ من الخادم إذا كانت موجودة
        message.error(response.data.error || 'Kullanıcılar içe aktarılırken bir hata oluştu.');
      }

    } catch (err: any) {
      console.error('Excel import fetch error:', err);
      // عرض رسالة خطأ أكثر تفصيلاً من الخادم
      const errorMessage = err.response?.data?.error || err.message || 'Sunucuya bağlanırken bir hata oluştu.';
      message.error(errorMessage);
    }
  };


const handleExportExcel = () => {
  // تحقق أولاً إذا كان هناك بيانات لتصديرها
  if (filteredUsers.length === 0) {
    message.warning('Dışa aktarılacak kullanıcı bulunmuyor.');
    return; // أوقف الدالة إذا لم يكن هناك مستخدمين
  }

  // 1. قم بتنسيق البيانات التي تريد تصديرها
  //    هنا نختار الأعمدة التي نريدها ونغير أسماءها للغة التركية
  const dataToExport = filteredUsers.map(user => ({
    'Üniversite Kodu': user.universite_kodu,
    'Adı': user.ad,
    'Soyadı': user.soyad,
    'E-posta': user.eposta,
    'Rol': user.rol,
    'Hesap Durumu': user.hesap_durumu
  }));

  // 2. قم بإنشاء ورقة العمل من البيانات الحقيقية
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kullanıcılar');

  // 3. (اختياري) قم بتحديد عرض الأعمدة لجعل الملف أجمل
  worksheet['!cols'] = [
    { wch: 20 }, // عرض عمود "Üniversite Kodu"
    { wch: 20 }, // عرض عمود "Adı"
    { wch: 20 }, // عرض عمود "Soyadı"
    { wch: 30 }, // عرض عمود "E-posta"
    { wch: 15 }, // عرض عمود "Rol"
    { wch: 15 }  // عرض عمود "Hesap Durumu"
  ];

  // 4. قم بإنشاء اسم ملف ديناميكي يحتوي على تاريخ اليوم
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const fileName = `Kullanicilar_${today}.xlsx`;

  // 5. قم بتنزيل الملف الذي تم إنشاؤه
  XLSX.writeFile(workbook, fileName);
};


  // İstatistikleri hesapla
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const studentCount = users.filter(u => u.rol === 'ogrenci').length;
    const teacherCount = users.filter(u => u.rol === 'ogretmen').length;
    const adminCount = users.filter(u => u.rol === 'admin').length;
    const activeCount = users.filter(u => u.hesap_durumu === 'aktif').length;
    const inactiveCount = users.filter(u => u.hesap_durumu === 'pasif').length;
    
    return {
      totalUsers,
      studentCount,
      teacherCount,
      adminCount,
      activeCount,
      inactiveCount,
      activePercentage: totalUsers > 0 ? Math.round((activeCount / totalUsers) * 100) : 0
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.eposta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.universite_kodu.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = !roleFilter || user.rol === roleFilter;
      const matchesStatus = !statusFilter || user.hesap_durumu === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'ogretmen': return 'blue';
      case 'ogrenci': return 'green';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <CrownOutlined />;
      case 'ogretmen': return <UserOutlined />;
      case 'ogrenci': return <TeamOutlined />;
      default: return <UserOutlined />;
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'aktif' ? 'success' : 'error';
  };



  const StatCard = ({ title, value, icon, color, suffix = '' }: any) => (
    <Card size="small" style={{ height: '100%', background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`, color: 'white', border: 'none' }}>
      <Statistic
        title={<span style={{ color: 'white', opacity: 0.9 }}>{title}</span>}
        value={value}
        suffix={suffix}
        prefix={<span style={{ fontSize: 24, marginRight: 8 }}>{icon}</span>}
        valueStyle={{ color: 'white', fontWeight: 'bold' }}
      />
    </Card>
  );

  const columns = [
    {
      title: 'Avatar',
      key: 'avatar',
      width: 60,
      render: (record: any) => (
        <Avatar 
          style={{ backgroundColor: getRoleColor(record.rol) }}
          icon={getRoleIcon(record.rol)}
        />
      ),
    },
    {
      title: t('university_code'),
      dataIndex: 'universite_kodu',
      key: 'universite_kodu',
      sorter: (a: any, b: any) => a.universite_kodu.localeCompare(b.universite_kodu),
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: t('full_name'),
      key: 'fullName',
      sorter: (a: any, b: any) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`),
      render: (record: any) => (
        <div>
          <Text strong>{`${record.ad} ${record.soyad}`}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.eposta}</Text>
        </div>
      ),
    },
    {
      title: t('role'),
      dataIndex: 'rol',
      key: 'rol',
      filters: [
        { text: 'Admin', value: 'admin' },
        { text: 'Öğretmen', value: 'ogretmen' },
        { text: 'Öğrenci', value: 'ogrenci' },
      ],
      onFilter: (value: any, record: any) => record.rol === value,
      render: (role: string) => (
        <Tag color={getRoleColor(role)} icon={getRoleIcon(role)}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Tag>
      ),
    },
    {
      title: t('status'),
      dataIndex: 'hesap_durumu',
      key: 'hesap_durumu',
      filters: [
        { text: 'Aktif', value: 'aktif' },
        { text: 'Pasif', value: 'pasif' },
      ],
      onFilter: (value: any, record: any) => record.hesap_durumu === value,
      render: (status: string) => (
        <Badge 
          status={getStatusColor(status) as any}
          text={status.charAt(0).toUpperCase() + status.slice(1)}
        />
      ),
    },
    {
      title: t('actions'),
      key: 'actions',
      width: 120,
      render: (record: any) => (
        <Space size="small">
          <Tooltip title={t('edit')}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => navigate(`/users/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDeleteUser(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <TeamOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('user_management')}
            </Title>
            <Text type="secondary">{t('manage_system_users')}</Text>
          </div>
          <Space>
            {/* Toplu silme butonu - seçim varsa göster */}
            {selectedUsers.length > 0 && (
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={handleBulkDelete}
                loading={bulkDeleteLoading}
              >
                {selectedUsers.length} Kullanıcıyı Sil
              </Button>
            )}
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchUsers}
              loading={loading}
            >
              {t('refresh')}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
            >
              {t('export_to_excel')}
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleExcelImportClick}
            >
              {t('import_excel')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/users/add')}
            >
              {t('add_user')}
            </Button>
          </Space>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('users')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* İstatistik Kartları */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title={t('total_users')}
            value={stats.totalUsers}
            icon={<TeamOutlined />}
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title={t('students')}
            value={stats.studentCount}
            icon={<TeamOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title={t('teachers')}
            value={stats.teacherCount}
            icon={<UserOutlined />}
            color="#722ed1"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title={t('active_users')}
            value={`${stats.activePercentage}%`}
            icon={<CheckCircleOutlined />}
            color="#13c2c2"
          />
        </Col>
      </Row>

      {/* Filtreler */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder={t('search_users_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder={t('filter_by_role')}
              value={roleFilter}
              onChange={setRoleFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="ogretmen">Öğretmen</Select.Option>
              <Select.Option value="ogrenci">Öğrenci</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder={t('filter_by_status')}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="aktif">Aktif</Select.Option>
              <Select.Option value="pasif">Pasif</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">
                {filteredUsers.length} / {users.length} {t('users_showing')}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
          onClose={() => setError('')}
        />
      )}

      {/* Kullanıcı Tablosu */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedUsers,
            onChange: (selectedRowKeys: React.Key[]) => {
              setSelectedUsers(selectedRowKeys as string[]);
            },
            onSelectAll: (selected: boolean) => {
              handleSelectAll(selected);
            },
            onSelect: (record: any, selected: boolean) => {
              handleSelectUser(record.id, selected);
            },
            getCheckboxProps: (record: any) => ({
              // Admin kullanıcısını silmeyi engelle (isteğe bağlı)
              disabled: record.rol === 'admin' && record.universite_kodu === 'ADMIN001',
              name: record.ad,
            }),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} / ${total} ${t('users')}`,
          }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>

      {/* Hidden file input for Excel import */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".xlsx,.xls"
        onChange={handleExcelFileChange}
      />
    </div>
  );
};

export default UsersPage;
