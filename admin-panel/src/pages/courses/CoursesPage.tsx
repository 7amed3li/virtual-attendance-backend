import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { courseService, departmentService, userService } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  Select, 
  Input, 
  Button, 
  Table, 
  Space, 
  Tooltip,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Breadcrumb,
  Alert,
  Tag,
  Badge,
  Avatar,
  message
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  BookOutlined,
  UserOutlined,
  BarChartOutlined,
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;

const CoursesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [coursesData, departmentsData, usersData] = await Promise.all([
        courseService.getAllCourses(),
        departmentService.getAllDepartments(),
        userService.getAllUsers()
      ]);
      
      const processedCourses = Array.isArray(coursesData) ? coursesData : (coursesData as any).data;
      console.log('🔍 Courses data:', processedCourses);
      
      setCourses(processedCourses);
      setDepartments(departmentsData.map((d: any) => ({ label: d.ad, value: d.id })));
      setUsers(usersData.data || usersData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(t('error_loading_courses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [t]);

  const getUserNameById = (id: number) => {
    const user = users.find(u => u.id === id);
    return user ? `${user.ad} ${user.soyad}` : t('unknown_instructor');
  };
  
  const getDepartmentNameById = (id: number) => {
    const department = departments.find(d => d.value === id);
    return department ? department.label : t('unknown_department');
  };

  const handleDeleteCourse = async (id: string) => {
    if (window.confirm(t('confirm_delete_course'))) {
      try {
        await courseService.deleteCourse(id);
        message.success(t('course_deleted_successfully'));
        setCourses(courses.filter(course => course.id !== id));
      } catch (err) {
        console.error('Error deleting course:', err);
        message.error(t('error_deleting_course'));
      }
    }
  };

  // İstatistikleri hesapla
  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const departmentCount = new Set(courses.map(c => c.bolum_id)).size;
    
    return {
      totalCourses,
      departmentCount
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const instructorName = getUserNameById(course.ogretmen_id) || '';
      const matchesSearch = 
        course.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.kod && course.kod.toLowerCase().includes(searchTerm.toLowerCase())) ||
        instructorName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = !departmentFilter || course.bolum_id === departmentFilter;
      
      return matchesSearch && matchesDepartment;
    });
  }, [courses, searchTerm, departmentFilter, users]);

  const getSemesterColor = (semester: string) => {
    switch (semester) {
      case 'Güz': return 'orange';
      case 'Bahar': return 'green';
      case 'Yaz': return 'blue';
      default: return 'default';
    }
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
      title: '',
      key: 'icon',
      width: 50,
      render: () => (
        <Avatar 
          style={{ backgroundColor: '#1890ff' }}
          icon={<BookOutlined />}
          size="small"
        />
      ),
    },
    {
      title: t('course_code'),
      dataIndex: 'kod',
      key: 'kod',
      sorter: (a: any, b: any) => (a.kod || '').localeCompare(b.kod || ''),
      render: (text: string) => (
        <Text strong style={{ color: '#1890ff' }}>{text || 'N/A'}</Text>
      ),
    },
    {
      title: t('course_name'),
      dataIndex: 'ad',
      key: 'ad',
      sorter: (a: any, b: any) => a.ad.localeCompare(b.ad),
      render: (text: string, record: any) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <div style={{ marginTop: '4px' }}>
            {record.donem && (
              <Tag color={getSemesterColor(record.donem)}>
                {record.donem}
              </Tag>
            )}
            {record.akademik_yil && (
              <Tag color="blue">
                {record.akademik_yil}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t('instructor'),
      dataIndex: 'ogretmen_id',
      key: 'ogretmen_id',
      render: (id: number) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: '8px', backgroundColor: '#52c41a' }} />
          <Text>{getUserNameById(id)}</Text>
        </div>
      ),
    },
    {
      title: t('department'),
      dataIndex: 'bolum_id',
      key: 'bolum_id',
      filters: departments.map(d => ({ text: d.label, value: d.value })),
      onFilter: (value: any, record: any) => record.bolum_id === value,
      render: (id: number) => (
        <Text type="secondary">{getDepartmentNameById(id)}</Text>
      ),
    },
    {
      title: t('students'),
      key: 'ogrenci_sayisi',
      align: 'center' as const,
      sorter: (a: any, b: any) => (a.ogrenci_sayisi || 0) - (b.ogrenci_sayisi || 0),
      render: (record: any) => (
        <Badge 
          count={record.ogrenci_sayisi || 0} 
          style={{ backgroundColor: '#52c41a' }}
          overflowCount={999}
        />
      ),
    },
    {
      title: 'Ders Saati',
      key: 'ders_saat',
      align: 'center' as const,
      sorter: (a: any, b: any) => (a.ders_saat || 0) - (b.ders_saat || 0),
      render: (record: any) => {
        if (!record.ders_saat) return <Text type="secondary">-</Text>;
        
        return (
          <Tag color="blue" style={{ margin: 0 }}>
            {record.ders_saat}:00
          </Tag>
        );
      },
    },
    {
      title: t('actions'),
      key: 'actions',
      width: 200,
      render: (record: any) => (
        <Space size="small">
          <Tooltip title="Öğrenci Yönetimi">
            <Button
              type="default"
              icon={<TeamOutlined />}
              size="small"
              onClick={() => navigate(`/courses/${record.id}/students`)}
            />
          </Tooltip>
          <Tooltip title={t('view_attendance')}>
            <Button
              type="default"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => navigate(`/courses/${record.id}/attendance`)}
            />
          </Tooltip>
          <Tooltip title={t('edit')}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => navigate(`/courses/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDeleteCourse(record.id)}
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
              <BookOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('course_management')}
            </Title>
            <Text type="secondary">{t('manage_courses_and_schedules')}</Text>
          </div>
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
            >
              {t('refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/courses/add')}
            >
              {t('add_course')}
            </Button>
          </Space>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('courses')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* İstatistik Kartları */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={12}>
          <StatCard
            title={t('total_courses')}
            value={stats.totalCourses}
            icon={<BookOutlined />}
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={12} md={12}>
          <StatCard
            title={t('departments')}
            value={stats.departmentCount}
            icon={<BarChartOutlined />}
            color="#fa8c16"
          />
        </Col>
      </Row>

      {/* Filtreler */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder={t('search_courses_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder={t('filter_by_department')}
              value={departmentFilter}
              onChange={setDepartmentFilter}
              allowClear
              style={{ width: '100%' }}
              options={departments}
            />
          </Col>
          <Col xs={24} sm={12} md={12}>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">
                {filteredCourses.length} / {courses.length} {t('courses_showing')}
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

      {/* Ders Tablosu */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredCourses}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} / ${total} ${t('courses')}`,
          }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default CoursesPage;
