// src/pages/forgot/ForgotPasswordPage.tsx

import React, { useState } from 'react';
import { Form, Input, Button, notification, Card, Typography } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { authService } from '../../services/api'; // تأكد من أن المسار صحيح

const { Title, Text } = Typography;

const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: { eposta: string }) => {
    setLoading(true);
    try {
      // هذه الدالة يجب أن تكون موجودة في api.ts
      const response = await authService.forgotPassword(values.eposta);
      notification.success({
        message: 'E-posta Gönderildi',
        description: response.mesaj || 'Sıfırlama bağlantısı e-posta adresinize gönderildi.',
        placement: 'topRight',
      });
      form.resetFields(); // تفريغ الحقل بعد النجاح
    } catch (error: any) {
      notification.error({
        message: 'Hata Oluştu',
        description: error.response?.data?.mesaj || 'Bir hata oluştu, lütfen tekrar deneyin.',
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // نفس خلفية صفحة الدخول
      minHeight: '100vh'
    }}>
      <Card style={{ width: 400, borderRadius: '12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={3}>Şifremi Unuttum</Title>
          <Text type="secondary">Lütfen hesabınıza kayıtlı e-posta adresini girin.</Text>
        </div>
        <Form
          form={form}
          name="forgot_password"
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            name="eposta"
            label="E-posta Adresi"
            rules={[
              { required: true, message: 'Lütfen e-posta adresinizi girin!' },
              { type: 'email', message: 'Lütfen geçerli bir e-posta adresi girin!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="ornek@posta.com" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Sıfırlama Bağlantısı Gönder
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Link to="/login">Giriş sayfasına geri dön</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
