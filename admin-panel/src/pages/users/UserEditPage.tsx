import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { userService, facultyService, departmentService } from '../../services/api';
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
  Alert,
  Badge
} from 'antd';
import { 
  ArrowLeftOutlined, 
  EditOutlined, 
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

interface Faculty {
  id: number;
  ad: string;
}

interface Department {
  id: number;
  ad: string;
  fakulte_id: number;
}

const UserEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [form] = Form.useForm();
  const [faculties, setFaculties] = useState<{ label: string; value: number }[]>([]);
  const [departments, setDepartments] = useState<{ label: string; value: number; fakulte_id: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState('ogrenci');
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    const fetchData = async () => {
      try {
        const [facultiesData, departmentsData] = await Promise.all([
          facultyService.getAllFaculties(),
          departmentService.getAllDepartments(),
        ]);
        setFaculties(facultiesData.map((f: Faculty) => ({ label: f.ad, value: f.id })));
        setDepartments(
          departmentsData.map((d: Department) => ({
            label: d.ad,
            value: d.id,
            fakulte_id: d.fakulte_id,
          }))
        );
      } catch (err) {
        console.error('Error fetching faculties/departments:', err);
        message.error(t('error_loading_prerequisites'));
      }
    };

    fetchData();
  }, [isAdmin, navigate, t]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;

      try {
        const userData = await userService.getUserById(id);
        setUserData(userData);
        setSelectedRole(userData.rol || 'ogrenci');
        form.setFieldsValue({
          universite_kodu: userData.universite_kodu || '',
          ad: userData.ad || '',
          soyad: userData.soyad || '',
          eposta: userData.eposta || '',
          rol: userData.rol || 'ogrenci',
          hesap_durumu: userData.hesap_durumu || 'aktif',
          bolum_id: userData.bolum_id || '',
          fakulte_id: userData.fakulte_id || '',
        });
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching user:', error);
        message.error(error.response?.data?.mesaj || t('error_loading_user'));
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, t, form]);

  const onFinish = async (values: any) => {
    if (!id) return;

    setSaving(true);
    try {
      await userService.updateUser(id, values);
      message.success(t('user_updated_successfully'));
      navigate('/users');
    } catch (error: any) {
      console.error('Error updating user:', error);
      message.error(error.response?.data?.mesaj || t('error_updating_user'));
    } finally {
      setSaving(false);
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

  const filteredDepartments = departments.filter(
    (dept) => !form.getFieldValue('fakulte_id') || dept.fakulte_id.toString() === form.getFieldValue('fakulte_id')
  );

  if (loading) {
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
              <EditOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('edit_user')}
            </Title>
            <Text type="secondary">{t('edit_user_information')}</Text>
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
          <Breadcrumb.Item>{t('edit_user')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            <Alert
              message={t('user_edit_notice')}
              description={t('user_edit_notice_description')}
              type="warning"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
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
              </Row>

              <Row gutter={[16, 0]}>
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
                <Col xs={24} md={12}>
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
                </Col>
              </Row>

              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <SafetyOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('role_and_permissions')}
                </span>
              </Divider>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
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
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="hesap_durumu"
                    label={t('account_status')}
                    rules={[{ required: true, message: t('field_required') }]}
                  >
                    <Select
                      placeholder={t('select_status')}
                      style={{ borderRadius: '8px' }}
                      options={[
                        { 
                          label: (
                            <Space>
                              <Badge status="success" />
                              {t('active')}
                            </Space>
                          ), 
                          value: 'aktif' 
                        },
                        { 
                          label: (
                            <Space>
                              <Badge status="error" />
                              {t('inactive')}
                            </Space>
                          ), 
                          value: 'pasif' 
                        },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

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
                      onChange={() => form.setFieldsValue({ bolum_id: '' })}
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
                      options={filteredDepartments}
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
                    loading={saving}
                    size="large"
                    style={{
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                      border: 'none',
                      minWidth: '120px'
                    }}
                  >
                    {saving ? t('updating_user') : t('update_user')}
                  </Button>
                  <Button 
                    onClick={() => navigate('/users')}
                    size="large"
                    style={{ borderRadius: '8px' }}
                  >
                    {t('cancel')}
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
                  {form.getFieldValue('ad') || userData?.ad || t('first_name')} {form.getFieldValue('soyad') || userData?.soyad || t('last_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {form.getFieldValue('universite_kodu') || userData?.universite_kodu || t('university_code')}
                </Text>
              </div>
            </div>

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('email')}:</Text>
                <Text>{form.getFieldValue('eposta') || userData?.eposta || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('role')}:</Text>
                <Text style={{ color: getRoleColor(selectedRole) }}>
                  {selectedRole === 'admin' ? t('admin') : 
                   selectedRole === 'ogretmen' ? t('teacher') : t('student')}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('status')}:</Text>
                <Text style={{ color: form.getFieldValue('hesap_durumu') === 'aktif' ? '#52c41a' : '#ff4d4f' }}>
                  {form.getFieldValue('hesap_durumu') === 'aktif' ? t('active') : t('inactive')}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('faculty')}:</Text>
                <Text>{faculties.find(f => f.value === form.getFieldValue('fakulte_id'))?.label || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('department')}:</Text>
                <Text>{filteredDepartments.find(d => d.value === form.getFieldValue('bolum_id'))?.label || '-'}</Text>
              </div>
            </Space>

            <Divider />

            <Alert
              message={t('changes_will_be_saved')}
              description={t('user_will_receive_updated_permissions')}
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserEditPage;