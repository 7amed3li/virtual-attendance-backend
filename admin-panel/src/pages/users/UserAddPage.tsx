import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import api, { userService, departmentService, facultyService, type User } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Button, 
  Form, 
  Input, 
  Select, 
  Card, 
  message, 
  Spin, 
  Row, 
  Col,
  Typography,
  Breadcrumb,
  Space,
  Avatar,
  Divider,
  Alert
} from 'antd';
import { 
  ArrowLeftOutlined, 
  UserAddOutlined, 
  UserOutlined,
  LockOutlined,
  MailOutlined,
  IdcardOutlined,
  BankOutlined,
  ApartmentOutlined,
  TeamOutlined,
  SafetyOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const UserAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [form] = Form.useForm();
  const [faculties, setFaculties] = useState<{ label: string; value: string }[]>([]);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('ogrenci');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    const fetchInitialData = async () => {
      try {
        const [facultiesData, departmentsData] = await Promise.all([
          facultyService.getAllFaculties(),
          departmentService.getAllDepartments(),
        ]);
        setFaculties(facultiesData.map((f: any) => ({ label: f.ad, value: f.id })));
        setDepartments(departmentsData.map((d: any) => ({ label: d.name || d.ad, value: d.id })));
      } catch (err) {
        console.error('Error fetching data:', err);
        message.error(t('error_loading_prerequisites'));
      } finally {
        setPageLoading(false);
      }
    };

    fetchInitialData();
  }, [isAdmin, navigate, t]);

  const onFinish = async (values: Partial<User>) => {
    setLoading(true);
    try {
      await userService.addUser(values);
      message.success(t('user_added_successfully'));
      navigate('/users');
    } catch (err: any) {
      console.error('Error adding user:', err);
      message.error(err.response?.data?.mesaj || t('error_adding_user'));
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#ff4d4f';
      case 'ogretmen': return '#1890ff';
      case 'ogrenci': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <SafetyOutlined />;
      case 'ogretmen': return <UserOutlined />;
      case 'ogrenci': return <TeamOutlined />;
      default: return <UserOutlined />;
    }
  };

  if (pageLoading) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <UserAddOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('add_user')}
            </Title>
            <Text type="secondary">{t('add_new_user_to_system')}</Text>
          </div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/users')}
            size="large"
          >
            {t('back_to_users')}
          </Button>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('users')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('add_user')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            <Alert
              message={t('user_creation_notice')}
              description={t('user_creation_notice_description')}
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                rol: 'ogrenci',
                hesap_durumu: 'aktif',
                fakulte_id: '',
                bolum_id: '',
              }}
              size="large"
            >
              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <IdcardOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('basic_information')}
                </span>
              </Divider>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="universite_kodu"
                    label={t('university_code')}
                    rules={[{ required: true, message: t('field_required') }]}
                  >
                    <Input 
                      prefix={<IdcardOutlined style={{ color: '#1890ff' }} />}
                      placeholder={t('university_code_placeholder')} 
                      style={{ borderRadius: '8px' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="sifre"
                    label={t('password')}
                    rules={[
                      { required: true, message: t('field_required') },
                      { min: 6, message: t('password_min_length') },
                    ]}
                  >
                    <Input.Password 
                      prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                      placeholder={t('password_placeholder')} 
                      style={{ borderRadius: '8px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="ad"
                    label={t('first_name')}
                    rules={[{ required: true, message: t('field_required') }]}
                  >
                    <Input 
                      prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                      placeholder={t('first_name_placeholder')} 
                      style={{ borderRadius: '8px' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="soyad"
                    label={t('last_name')}
                    rules={[{ required: true, message: t('field_required') }]}
                  >
                    <Input 
                      prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                      placeholder={t('last_name_placeholder')} 
                      style={{ borderRadius: '8px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="eposta"
                label={t('email')}
                rules={[
                  { required: true, message: t('field_required') },
                  { type: 'email', message: t('invalid_email') },
                ]}
              >
                <Input 
                  prefix={<MailOutlined style={{ color: '#1890ff' }} />}
                  placeholder={t('email_placeholder')} 
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <SafetyOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('role_and_permissions')}
                </span>
              </Divider>

              <Form.Item
                name="rol"
                label={t('role')}
                rules={[{ required: true, message: t('field_required') }]}
              >
                <Select
                  placeholder={t('select_role')}
                  style={{ borderRadius: '8px' }}
                  onChange={setSelectedRole}
                  options={[
                    { 
                      label: (
                        <Space>
                          <SafetyOutlined style={{ color: '#ff4d4f' }} />
                          {t('admin')}
                        </Space>
                      ), 
                      value: 'admin' 
                    },
                    { 
                      label: (
                        <Space>
                          <UserOutlined style={{ color: '#1890ff' }} />
                          {t('teacher')}
                        </Space>
                      ), 
                      value: 'ogretmen' 
                    },
                    { 
                      label: (
                        <Space>
                          <TeamOutlined style={{ color: '#52c41a' }} />
                          {t('student')}
                        </Space>
                      ), 
                      value: 'ogrenci' 
                    },
                  ]}
                />
              </Form.Item>

              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <BankOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('organizational_information')}
                </span>
              </Divider>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="fakulte_id"
                    label={t('faculty')}
                    rules={[{ required: true, message: t('field_required') }]}
                  >
                    <Select
                      showSearch
                      placeholder={t('select_faculty')}
                      style={{ borderRadius: '8px' }}
                      suffixIcon={<BankOutlined style={{ color: '#1890ff' }} />}
                      options={faculties}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="bolum_id"
                    label={t('department')}
                    rules={[{ required: true, message: t('field_required') }]}
                  >
                    <Select
                      showSearch
                      placeholder={t('select_department')}
                      style={{ borderRadius: '8px' }}
                      suffixIcon={<ApartmentOutlined style={{ color: '#1890ff' }} />}
                      options={departments}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '32px', marginBottom: 0 }}>
                <Space size="middle">
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    size="large"
                    style={{
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                      border: 'none',
                      minWidth: '120px'
                    }}
                  >
                    {loading ? t('adding_user') : t('add_user')}
                  </Button>
                  <Button 
                    onClick={() => form.resetFields()}
                    size="large"
                    style={{ borderRadius: '8px' }}
                  >
                    {t('reset')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Sağ Panel - Preview */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <span>
                <UserOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                {t('user_preview')}
              </span>
            }
            style={{ position: 'sticky', top: '24px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Avatar 
                size={80} 
                icon={getRoleIcon(selectedRole)}
                style={{ 
                  backgroundColor: getRoleColor(selectedRole),
                  marginBottom: '16px'
                }}
              />
              <div>
                <Text strong style={{ fontSize: '16px' }}>
                  {form.getFieldValue('ad') || t('first_name')} {form.getFieldValue('soyad') || t('last_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {form.getFieldValue('universite_kodu') || t('university_code')}
                </Text>
              </div>
            </div>

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('email')}:</Text>
                <Text>{form.getFieldValue('eposta') || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('role')}:</Text>
                <Text style={{ color: getRoleColor(selectedRole) }}>
                  {selectedRole === 'admin' ? t('admin') : 
                   selectedRole === 'ogretmen' ? t('teacher') : t('student')}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('faculty')}:</Text>
                <Text>{faculties.find(f => f.value === form.getFieldValue('fakulte_id'))?.label || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('department')}:</Text>
                <Text>{departments.find(d => d.value === form.getFieldValue('bolum_id'))?.label || '-'}</Text>
              </div>
            </Space>

            <Divider />

            <Alert
              message={t('account_status')}
              description={t('new_account_will_be_active')}
              type="success"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserAddPage;