import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom'; // 1. تم استيراد Link هنا
import { authService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Space,
  Divider,
  Row,
  Col,
  Image,
  Spin
} from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { giris, kullanici } = useAuth();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (kullanici) {
      navigate('/dashboard', { replace: true });
    }
  }, [kullanici, navigate]);

  const handleSubmit = async (values: { universite_kodu: string; sifre: string }) => {
    setError('');
    setLoading(true);
    
    try {
      const { token, kullanici } = await authService.giris(values.universite_kodu, values.sifre);
      
      if (kullanici.rol !== 'admin') {
        setError(`Bu admin paneline sadece yönetici yetkisine sahip kullanıcılar erişebilir. Sizin rolünüz: ${kullanici.rol}`);
        setLoading(false);
        return;
      }
      
      await giris(token, kullanici);
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.response?.data?.mesaj || t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Row gutter={[32, 32]} style={{ width: '100%', maxWidth: '1200px' }}>
        {/* Sol Panel - Bilgi */}
        <Col xs={24} lg={12} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ color: 'white', textAlign: 'center', width: '100%' }}>
            <div style={{ marginBottom: '32px' }}>
              <Image
                src="/logos/university_logo.png"
                alt="University Logo"
                width={120}
                height={120}
                preview={false}
                fallback="/logos/university_logo.png"
                style={{ borderRadius: '50%', marginBottom: '20px' }}
              />
            </div>
            
            <Title level={1} style={{ color: 'white', marginBottom: '16px' }}>
              QR Kod Tabanlı Yoklama Sistemi
            </Title>
            
            <Paragraph style={{ fontSize: '18px', color: 'rgba(255,255,255,0.9)', marginBottom: '32px' }}>
              Tokat Gaziosmanpaşa Üniversitesi
            </Paragraph>
          </div>
        </Col>

        {/* Sağ Panel - Login Form */}
        <Col xs={24} lg={12} style={{ display: 'flex', alignItems: 'center' }}>
          <Card
            style={{
              width: '100%',
              maxWidth: '400px',
              margin: '0 auto',
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              border: 'none'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                <LoginOutlined style={{ marginRight: '8px' }} />
                Sisteme Giriş
              </Title>
              <Text type="secondary">Lütfen giriş bilgilerinizi giriniz</Text>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                style={{ marginBottom: '24px' }}
                closable
                onClose={() => setError('')}
              />
            )}

            <Form
              form={form}
              name="login"
              layout="vertical"
              onFinish={handleSubmit}
              onFinishFailed={onFinishFailed}
              size="large"
              autoComplete="off"
            >
              <Form.Item
                label="Üniversite Kodu"
                name="universite_kodu"
                rules={[
                  { required: true, message: 'Lütfen üniversite kodunuzu giriniz!' },
                  { min: 3, message: 'Üniversite kodu en az 3 karakter olmalıdır!' }
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                  placeholder="Üniversite kodunuzu giriniz"
                  style={{ borderRadius: '8px', height: '48px' }}
                />
              </Form.Item>

              <Form.Item
                label="Şifre"
                name="sifre"
                rules={[
                  { required: true, message: 'Lütfen şifrenizi giriniz!' },
                  { min: 6, message: 'Şifre en az 6 karakter olmalıdır!' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#1890ff' }} />}
                  placeholder="Şifrenizi giriniz"
                  style={{ borderRadius: '8px', height: '48px' }}
                />
              </Form.Item>

              {/* 2. تم تعديل هذا الجزء لإضافة الرابط */}
              <Row justify="end" style={{ marginTop: '-16px', marginBottom: '24px' }}>
                <Col>
                  <Link to="/sifremi-unuttum">Şifrenizi mi unuttunuz?</Link>
                </Col>
              </Row>

              <Form.Item style={{ marginBottom: '16px' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                  style={{
                    height: '48px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none',
                    fontWeight: 'bold'
                  }}
                  icon={<LoginOutlined />}
                >
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Button>
              </Form.Item>
            </Form>

            <Divider>
              <Text type="secondary">Güvenli Giriş</Text>
            </Divider>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Space direction="vertical" size="small">
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Bu sistem şifreli bağlantı kullanır
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Giriş bilgilerinizi kimseyle paylaşmayınız
                </Text>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <Card style={{ padding: '20px', borderRadius: '12px' }}>
            <Space direction="vertical" align="center">
              <Spin size="large" />
              <Text>Giriş yapılıyor...</Text>
            </Space>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
