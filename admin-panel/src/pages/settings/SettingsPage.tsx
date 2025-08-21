import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Alert,
  Divider,
  Row,
  Col,
  Avatar,
  Descriptions,
  Modal,
  message,
  Badge,
  Breadcrumb
} from 'antd';
import {
  SettingOutlined,
  LockOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  MailOutlined,
  IdcardOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { kullanici, cikis } = useAuth();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    setLoading(true);
    try {
      await authService.sifreDegistir(values.currentPassword, values.newPassword);
      message.success(t('password_changed_successfully'));
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.mesaj || t('error_changing_password'));
    } finally {
      setLoading(false);
    }
  };

  const showLogoutConfirm = () => {
    confirm({
      title: t('confirm_logout'),
      icon: <ExclamationCircleOutlined />,
      content: t('logout_confirmation_message'),
      okText: t('logout'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk() {
        handleLogout();
      },
    });
  };

  const handleLogout = () => {
    if (cikis) cikis();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'ogretmen': return 'blue';
      case 'ogrenci': return 'green';
      default: return 'default';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'ogretmen': return 'Öğretmen';
      case 'ogrenci': return 'Öğrenci';
      default: return role;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <SettingOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            {t('settings')}
          </Title>
          <Text type="secondary">{t('manage_account_settings')}</Text>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('settings')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Profil Bilgileri */}
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Avatar 
                size={80} 
                icon={<UserOutlined />} 
                style={{ 
                  backgroundColor: getRoleColor(kullanici?.rol || ''),
                  marginBottom: '16px'
                }}
              />
              <Title level={4} style={{ margin: '8px 0' }}>
                {kullanici?.ad} {kullanici?.soyad}
              </Title>
              <Badge 
                color={getRoleColor(kullanici?.rol || '')} 
                text={getRoleName(kullanici?.rol || '')}
              />
            </div>

            <Descriptions column={1} size="small">
              <Descriptions.Item 
                label={
                  <span>
                    <IdcardOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    {t('university_code')}
                  </span>
                }
              >
                <Text strong>{kullanici?.universite_kodu}</Text>
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <span>
                    <MailOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    {t('email')}
                  </span>
                }
              >
                <Text>{kullanici?.eposta}</Text>
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <span>
                    <SafetyOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    {t('account_status')}
                  </span>
                }
              >
                <Badge 
                  status={kullanici?.hesap_durumu === 'aktif' ? 'success' : 'error'}
                  text={kullanici?.hesap_durumu === 'aktif' ? 'Aktif' : 'Pasif'}
                />
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <Button 
                type="primary" 
                danger 
                icon={<LogoutOutlined />}
                onClick={showLogoutConfirm}
                size="large"
                style={{ width: '100%' }}
              >
                {t('logout')}
              </Button>
            </div>
          </Card>
        </Col>

        {/* Sağ Panel - Ayarlar */}
        <Col xs={24} lg={16}>
          {/* Şifre Değiştirme */}
          <Card 
            title={
              <span>
                <KeyOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                {t('change_password')}
              </span>
            }
            style={{ marginBottom: '24px' }}
          >
            <Alert
              message={t('password_security_notice')}
              description={t('password_security_description')}
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handlePasswordSubmit}
              size="large"
              autoComplete="off"
            >
              <Form.Item
                label={t('current_password')}
                name="currentPassword"
                rules={[
                  { required: true, message: t('current_password_required') },
                  { min: 6, message: t('password_min_length') }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                  placeholder={t('enter_current_password')}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Form.Item
                label={t('new_password')}
                name="newPassword"
                rules={[
                  { required: true, message: t('new_password_required') },
                  { min: 6, message: t('password_min_length') }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                  placeholder={t('enter_new_password')}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Form.Item
                label={t('confirm_password')}
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: t('confirm_password_required') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('password_mismatch')));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                  placeholder={t('confirm_new_password')}
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  style={{
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none'
                  }}
                >
                  {loading ? t('changing_password') : t('change_password')}
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* Güvenlik Bilgileri */}
          <Card 
            title={
              <span>
                <SafetyOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                {t('security_information')}
              </span>
            }
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                message={t('security_tips_title')}
                description={
                  <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
                    <li>{t('security_tip_1')}</li>
                    <li>{t('security_tip_2')}</li>
                    <li>{t('security_tip_3')}</li>
                    <li>{t('security_tip_4')}</li>
                  </ul>
                }
                type="warning"
                showIcon
              />

              <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: '13px' }}>
                {t('security_footer_note')}
              </Paragraph>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;