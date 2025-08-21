// src/pages/forgot/ResetPasswordPage.tsx

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, notification, Card, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authService } from '../../services/api'; // تأكد من أن المسار صحيح

const { Title, Text } = Typography;

const ResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>(); // الحصول على التوكن من الرابط
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    if (!token) {
        notification.error({ message: 'Geçersiz Bağlantı', description: 'Sıfırlama linki eksik veya hatalı.' });
        setLoading(false);
        return;
    }
    try {
      // هذه الدالة يجب أن تكون موجودة في api.ts
      await authService.resetPassword(token, values.yeni_sifre);
      notification.success({
        message: 'Başarılı!',
        description: 'Şifreniz başarıyla değiştirildi. Şimdi giriş yapabilirsiniz.',
        placement: 'topRight',
      });
      navigate('/login');
    } catch (error: any) {
      notification.error({
        message: 'Hata Oluştu',
        description: error.response?.data?.mesaj || 'Bağlantı geçersiz veya süresi dolmuş olabilir.',
        placement: 'topRight',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <Card style={{ width: 400, borderRadius: '12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={3}>Yeni Şifre Belirle</Title>
          <Text type="secondary">Lütfen yeni şifrenizi girin.</Text>
        </div>
        <Form
          name="reset_password"
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            name="yeni_sifre"
            label="Yeni Şifre"
            rules={[{ required: true, message: 'Lütfen yeni şifrenizi girin!' }]}
            hasFeedback
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Yeni şifre" size="large" />
          </Form.Item>

          <Form.Item
            name="yeni_sifre_onay"
            label="Yeni Şifre (Tekrar)"
            dependencies={['yeni_sifre']}
            hasFeedback
            rules={[
              { required: true, message: 'Lütfen şifrenizi tekrar girin!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('yeni_sifre') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Girdiğiniz şifreler eşleşmiyor!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Yeni şifreyi onayla" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Şifreyi Güncelle
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
