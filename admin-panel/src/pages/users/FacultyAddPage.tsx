import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { facultyService } from '../../services/api';
import SimpleMapSelector from '../../components/SimpleMapSelector';
import { 
  Button, 
  Form, 
  Input, 
  Card, 
  message,
  Typography,
  Breadcrumb,
  Space,
  Avatar,
  Divider,
  Alert,
  Row,
  Col,
  InputNumber,
  Tabs
} from 'antd';
import { 
  ArrowLeftOutlined, 
  BankOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  GlobalOutlined,
  AimOutlined,
  EditOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const FacultyAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('manual');

  // Haritadan konum seçildiğinde form'u güncelle
  const handleLocationSelect = (lat: number, lng: number) => {
    form.setFieldsValue({
      enlem: lat,
      boylam: lng
    });
  };

  const onFinish = async (values: { ad: string; enlem?: number; boylam?: number }) => {
    setLoading(true);
    try {
      await facultyService.addFaculty({ ad: values.ad, enlem: values.enlem, boylam: values.boylam });
      message.success(t('faculty_added_successfully'));
      navigate('/faculties');
    } catch (err) {
      console.error('Error adding faculty:', err);
      message.error(t('error_adding_faculty'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <PlusOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('add_faculty')}
            </Title>
            <Text type="secondary">{t('add_new_faculty_to_university')}</Text>
          </div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/faculties')}
            size="large"
          >
            {t('back_to_faculties')}
          </Button>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('faculties')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('add_faculty')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            <Alert
              message={t('faculty_creation_notice')}
              description={t('faculty_creation_notice_description')}
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              size="large"
            >
              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <BankOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('basic_information')}
                </span>
              </Divider>

              <Form.Item
                name="ad"
                label={t('faculty_name')}
                rules={[{ required: true, message: t('faculty_name_required') }]}
                tooltip={t('faculty_name_tooltip')}
              >
                <Input 
                  prefix={<BankOutlined style={{ color: '#1890ff' }} />}
                  placeholder={t('faculty_name_placeholder')} 
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <EnvironmentOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('location_information')}
                </span>
              </Divider>

              <Tabs
                activeKey={selectedTab}
                onChange={setSelectedTab}
                style={{ marginBottom: '16px' }}
                items={[
                  {
                    key: 'manual',
                    label: (
                      <span>
                        <EditOutlined />
                        Manuel Koordinat Girişi
                      </span>
                    ),
                    children: (
                      <div>
                        <Alert
                          message="Manuel Koordinat Girişi"
                          description="Fakülte konumunun enlem ve boylam değerlerini manuel olarak girebilirsiniz."
                          type="info"
                          showIcon
                          style={{ marginBottom: '16px' }}
                        />
                        
                        <Row gutter={[16, 0]}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="enlem"
                              label={t('latitude')}
                              rules={[
                                { required: true, message: t('latitude_required') },
                                { type: 'number', min: -90, max: 90, message: t('latitude_range_error') }
                              ]}
                              tooltip={t('latitude_tooltip')}
                            >
                              <InputNumber
                                style={{ width: '100%', borderRadius: '8px' }}
                                placeholder={t('latitude_placeholder')}
                                step={0.000001}
                                precision={6}
                                addonBefore={<EnvironmentOutlined style={{ color: '#1890ff' }} />}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="boylam"
                              label={t('longitude')}
                              rules={[
                                { required: true, message: t('longitude_required') },
                                { type: 'number', min: -180, max: 180, message: t('longitude_range_error') }
                              ]}
                              tooltip={t('longitude_tooltip')}
                            >
                              <InputNumber
                                style={{ width: '100%', borderRadius: '8px' }}
                                placeholder={t('longitude_placeholder')}
                                step={0.000001}
                                precision={6}
                                addonBefore={<GlobalOutlined style={{ color: '#1890ff' }} />}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </div>
                    ),
                  },
                  {
                    key: 'map',
                    label: (
                      <span>
                        <AimOutlined />
                        Haritadan Seç
                      </span>
                    ),
                    children: (
                      <div>
                        <SimpleMapSelector
                          onLocationSelect={handleLocationSelect}
                          initialLat={form.getFieldValue('enlem')}
                          initialLng={form.getFieldValue('boylam')}
                          height={450}
                        />
                      </div>
                    ),
                  },
                ]}
              />

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
                    {loading ? t('adding_faculty') : t('add_faculty')}
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
                <BankOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                {t('faculty_preview')}
              </span>
            }
            style={{ position: 'sticky', top: '24px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Avatar 
                size={80} 
                icon={<BankOutlined />}
                style={{ 
                  backgroundColor: '#1890ff',
                  marginBottom: '16px'
                }}
              />
              <div>
                <Text strong style={{ fontSize: '16px' }}>
                  {form.getFieldValue('ad') || t('faculty_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {form.getFieldValue('enlem') || form.getFieldValue('boylam') ? 
                    `${form.getFieldValue('enlem') || '0'}, ${form.getFieldValue('boylam') || '0'}` : 
                    t('coordinates_not_set')
                  }
                </Text>
              </div>
            </div>

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('faculty_name')}:</Text>
                <Text>{form.getFieldValue('ad') || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('latitude')}:</Text>
                <Text>{form.getFieldValue('enlem') || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('longitude')}:</Text>
                <Text>{form.getFieldValue('boylam') || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('location_status')}:</Text>
                <Text style={{ color: form.getFieldValue('enlem') && form.getFieldValue('boylam') ? '#52c41a' : '#ff4d4f' }}>
                  {form.getFieldValue('enlem') && form.getFieldValue('boylam') ? t('location_set') : t('location_not_set')}
                </Text>
              </div>
              {form.getFieldValue('enlem') && form.getFieldValue('boylam') && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Seçim Türü:</Text>
                  <Text style={{ color: '#1890ff' }}>
                    {selectedTab === 'map' ? '🗺️ Haritadan' : '✏️ Manuel'}
                  </Text>
                </div>
              )}
            </Space>

            <Divider />

            <Alert
              message={t('faculty_will_be_active')}
              description={t('faculty_will_be_available_for_departments')}
              type="success"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default FacultyAddPage;
