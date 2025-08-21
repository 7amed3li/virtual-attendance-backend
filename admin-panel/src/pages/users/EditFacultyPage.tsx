import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { facultyService } from '../../services/api';
import { 
  Button, 
  Form, 
  Input, 
  Card, 
  message, 
  Spin,
  Typography,
  Breadcrumb,
  Space,
  Avatar,
  Divider,
  Alert,
  Row,
  Col,
  InputNumber
} from 'antd';
import { 
  ArrowLeftOutlined, 
  EditOutlined, 
  BankOutlined,
  EnvironmentOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const EditFacultyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [facultyData, setFacultyData] = useState<any>(null);

  useEffect(() => {
    const fetchFaculty = async () => {
      if (!id) return;
      try {
        setPageLoading(true);
        const faculty = await facultyService.getFacultyById(id);
        setFacultyData(faculty);
        form.setFieldsValue({ 
          ad: faculty.ad,
          enlem: faculty.enlem,
          boylam: faculty.boylam,
        });
      } catch (err) {
        console.error('Error fetching faculty:', err);
        message.error(t('error_loading_faculty'));
      } finally {
        setPageLoading(false);
      }
    };
    fetchFaculty();
  }, [id, form, t]);

  const onFinish = async (values: { ad: string; enlem?: number; boylam?: number }) => {
    if (!id) return;
    setLoading(true);
    try {
      await facultyService.updateFaculty(id, { ad: values.ad, enlem: values.enlem, boylam: values.boylam });
      message.success(t('faculty_updated_successfully'));
      navigate('/faculties');
    } catch (err) {
      console.error('Error updating faculty:', err);
      message.error(t('error_updating_faculty'));
    } finally {
      setLoading(false);
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
              <EditOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('edit_faculty')}
            </Title>
            <Text type="secondary">{t('edit_faculty_information')}</Text>
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
          <Breadcrumb.Item>{t('edit_faculty')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            <Alert
              message={t('faculty_edit_notice')}
              description={t('faculty_edit_notice_description')}
              type="warning"
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

              <Alert
                message={t('coordinates_info')}
                description={t('coordinates_info_description')}
                type="warning"
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
                    {loading ? t('updating_faculty') : t('update_faculty')}
                  </Button>
                  <Button 
                    onClick={() => navigate('/faculties')}
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
                  {form.getFieldValue('ad') || facultyData?.ad || t('faculty_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {form.getFieldValue('enlem') || form.getFieldValue('boylam') ? 
                    `${form.getFieldValue('enlem') || facultyData?.enlem || '0'}, ${form.getFieldValue('boylam') || facultyData?.boylam || '0'}` : 
                    t('coordinates_not_set')
                  }
                </Text>
              </div>
            </div>

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('faculty_name')}:</Text>
                <Text>{form.getFieldValue('ad') || facultyData?.ad || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('latitude')}:</Text>
                <Text>{form.getFieldValue('enlem') || facultyData?.enlem || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('longitude')}:</Text>
                <Text>{form.getFieldValue('boylam') || facultyData?.boylam || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('location_status')}:</Text>
                <Text style={{ color: form.getFieldValue('enlem') && form.getFieldValue('boylam') ? '#52c41a' : '#ff4d4f' }}>
                  {form.getFieldValue('enlem') && form.getFieldValue('boylam') ? t('location_set') : t('location_not_set')}
                </Text>
              </div>
            </Space>

            <Divider />

            <Alert
              message={t('faculty_changes_will_be_applied')}
              description={t('departments_will_use_updated_information')}
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default EditFacultyPage;
