import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { facultyService } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
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
  Avatar,
  message
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  BankOutlined,
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;

const FacultiesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFaculties = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await facultyService.getAllFaculties();
      setFaculties(data || []);
    } catch (err) {
      console.error('Error fetching faculties:', err);
      setError(t('error_loading_faculties'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculties();
  }, []);

  const handleDeleteFaculty = async (id: string) => {
    if (window.confirm(t('confirm_delete_faculty'))) {
      try {
        await facultyService.deleteFaculty(id);
        message.success(t('faculty_deleted_successfully'));
        fetchFaculties();
      } catch (err) {
        console.error('Error deleting faculty:', err);
        message.error(t('error_deleting_faculty'));
      }
    }
  };

  const filteredFaculties = useMemo(() => {
    return faculties.filter(faculty =>
      faculty.ad.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faculties, searchTerm]);

  // İstatistikleri hesapla
  const stats = useMemo(() => {
    const totalFaculties = faculties.length;
    
    return {
      totalFaculties
    };
  }, [faculties]);

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
          icon={<BankOutlined />}
          size="small"
        />
      ),
    },
    {
      title: t('faculty_name'),
      dataIndex: 'ad',
      key: 'ad',
      sorter: (a: any, b: any) => a.ad.localeCompare(b.ad),
      render: (text: string) => (
        <Text strong style={{ color: '#1890ff' }}>{text}</Text>
      ),
    },
    {
      title: t('location'),
      key: 'location',
      render: (record: any) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <EnvironmentOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
          {record.enlem && record.boylam ? (
            <Text type="secondary">
              {record.enlem.toFixed(4)}, {record.boylam.toFixed(4)}
            </Text>
          ) : (
            <Text type="secondary" italic>Konum belirtilmemiş</Text>
          )}
        </div>
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
              onClick={() => navigate(`/faculties/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDeleteFaculty(record.id)}
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
              <BankOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('faculty_management')}
            </Title>
            <Text type="secondary">{t('manage_university_faculties')}</Text>
          </div>
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={fetchFaculties}
              loading={loading}
            >
              {t('refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/faculties/add')}
            >
              {t('add_faculty')}
            </Button>
          </Space>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('faculties')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* İstatistik Kartları */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <StatCard
            title={t('total_faculties')}
            value={stats.totalFaculties}
            icon={<BankOutlined />}
            color="#1890ff"
          />
        </Col>
      </Row>

      {/* Filtreler */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder={t('search_faculties_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={16}>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">
                {filteredFaculties.length} / {faculties.length} {t('faculties_showing')}
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

      {/* Fakülte Tablosu */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredFaculties}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} / ${total} ${t('faculties')}`,
          }}
          scroll={{ x: 800 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default FacultiesPage;
