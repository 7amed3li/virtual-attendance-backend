import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { departmentService, facultyService } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  Input, 
  Button, 
  Table, 
  Space, 
  Tooltip, 
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Breadcrumb,
  Alert,
  Avatar,
  message,
  Tag
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ApartmentOutlined,
  SearchOutlined,
  ReloadOutlined,
  BankOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;

const DepartmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [facultyFilter, setFacultyFilter] = useState<string | undefined>(undefined);

  const fetchDepartmentsAndFaculties = async () => {
    try {
      setLoading(true);
      setError('');
      const [departmentsData, facultiesData] = await Promise.all([
        departmentService.getAllDepartments(),
        facultyService.getAllFaculties()
      ]);
      setDepartments(departmentsData || []);
      setFaculties(facultiesData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(t('error_loading_departments'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentsAndFaculties();
  }, []);

  const handleDeleteDepartment = async (id: number) => {
    if (window.confirm(t('confirm_delete_department'))) {
      try {
        await departmentService.deleteDepartment(id);
        message.success(t('department_deleted_successfully'));
        fetchDepartmentsAndFaculties();
      } catch (err) {
        console.error('Error deleting department:', err);
        message.error(t('error_deleting_department'));
      }
    }
  };

  const getFacultyNameById = (id: number) => {
    const faculty = faculties.find(f => f.id === id);
    return faculty ? faculty.ad : t('unknown_faculty');
  };

  const getFacultyColor = (facultyName: string) => {
    const colors = ['blue', 'green', 'orange', 'purple', 'red', 'cyan'];
    const index = facultyName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // İstatistikleri hesapla
  const stats = useMemo(() => {
    const totalDepartments = departments.length;
    const facultyCount = new Set(departments.map(d => d.fakulte_id)).size;
    const avgPerFaculty = facultyCount > 0 ? Math.round(totalDepartments / facultyCount) : 0;
    
    return {
      totalDepartments,
      facultyCount,
      avgPerFaculty
    };
  }, [departments]);

  const filteredDepartments = useMemo(() => {
    return departments.filter(department => {
      const facultyName = getFacultyNameById(department.fakulte_id) || '';
      const matchesSearch = 
        department.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        facultyName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFaculty = !facultyFilter || department.fakulte_id === facultyFilter;
      
      return matchesSearch && matchesFaculty;
    });
  }, [departments, searchTerm, facultyFilter, faculties]);

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
      title: '',
      key: 'icon',
      width: 60,
      render: () => (
        <Avatar 
          style={{ backgroundColor: '#1890ff' }}
          icon={<ApartmentOutlined />}
          size="small"
        />
      ),
    },
    {
      title: t('department_name'),
      dataIndex: 'ad',
      key: 'ad',
      sorter: (a: any, b: any) => a.ad.localeCompare(b.ad),
      render: (text: string) => (
        <Text strong style={{ color: '#1890ff' }}>{text}</Text>
      ),
    },
    {
      title: t('faculty'),
      dataIndex: 'fakulte_id',
      key: 'fakulte_id',
      render: (id: number) => {
        const facultyName = getFacultyNameById(id);
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <BankOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
            <Tag color={getFacultyColor(facultyName)}>
              {facultyName}
            </Tag>
          </div>
        );
      },
      sorter: (a: any, b: any) => getFacultyNameById(a.fakulte_id).localeCompare(getFacultyNameById(b.fakulte_id)),
      filters: faculties.map(f => ({ text: f.ad, value: f.id })),
      onFilter: (value: any, record: any) => record.fakulte_id === value,
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
              onClick={() => navigate(`/departments/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDeleteDepartment(record.id)}
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
              <ApartmentOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('department_management')}
            </Title>
            <Text type="secondary">{t('manage_university_departments')}</Text>
          </div>
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchDepartmentsAndFaculties}
              loading={loading}
            >
              {t('refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/departments/add')}
            >
              {t('add_department')}
            </Button>
          </Space>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('departments')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* İstatistik Kartları */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8} md={8}>
          <StatCard
            title={t('total_departments')}
            value={stats.totalDepartments}
            icon={<ApartmentOutlined />}
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={8} md={8}>
          <StatCard
            title={t('total_faculties')}
            value={stats.facultyCount}
            icon={<BankOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={8} md={8}>
          <StatCard
            title={t('avg_per_faculty')}
            value={stats.avgPerFaculty}
            icon={<ApartmentOutlined />}
            color="#722ed1"
          />
        </Col>
      </Row>

      {/* Filtreler */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder={t('search_departments_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder={t('filter_by_faculty')}
              value={facultyFilter}
              onChange={setFacultyFilter}
              allowClear
              style={{ width: '100%' }}
            >
              {faculties.map(faculty => (
                <Select.Option key={faculty.id} value={faculty.id}>
                  {faculty.ad}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">
                {filteredDepartments.length} / {departments.length} {t('departments_showing')}
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

      {/* Bölüm Tablosu */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredDepartments}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} / ${total} ${t('departments')}`,
          }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default DepartmentsPage;
