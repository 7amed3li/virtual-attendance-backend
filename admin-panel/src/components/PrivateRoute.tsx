import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, yukleniyor, isAdmin, kullanici } = useAuth();

  if (yukleniyor) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <Spin size="large" style={{ color: 'white' }} />
          <div style={{ marginTop: '16px', fontSize: '16px' }}>
            Sistem kontrolü yapılıyor...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admin kontrolü - Admin olmayan kullanıcıları login'e yönlendir
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: '500px', 
          width: '100%',
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}>
          <LockOutlined style={{ fontSize: '64px', color: '#ff4d4f', marginBottom: '24px' }} />
          
          <h1 style={{ color: '#1890ff', marginBottom: '16px', fontSize: '24px' }}>
            Erişim Engellendi
          </h1>
          
          <Alert
            message="Yetkisiz Giriş Denemesi"
            description={
              <div>
                <p style={{ margin: '8px 0' }}>
                  <strong>Bu admin paneline sadece yönetici yetkisine sahip kullanıcılar erişebilir.</strong>
                </p>
                <p style={{ margin: '8px 0' }}>
                  Mevcut kullanıcı: <strong>{kullanici?.ad} {kullanici?.soyad}</strong>
                </p>
                <p style={{ margin: '8px 0' }}>
                  Kullanıcı rolü: <strong style={{ color: '#ff4d4f' }}>{kullanici?.rol}</strong>
                </p>
                <p style={{ margin: '8px 0', fontSize: '12px', color: '#666' }}>
                  Admin yetkisi için sistem yöneticinize başvurunuz.
                </p>
              </div>
            }
            type="error"
            showIcon
            style={{ textAlign: 'left', marginBottom: '24px' }}
          />
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.href = '/login'}
              style={{
                padding: '10px 24px',
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Farklı Hesapla Giriş Yap
            </button>
            
            <button
              onClick={() => window.history.back()}
              style={{
                padding: '10px 24px',
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
