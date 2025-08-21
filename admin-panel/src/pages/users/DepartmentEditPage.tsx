import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { departmentService, facultyService } from '../../services/api';
import { 
  Button, 
  Form, 
  Input, 
  Select, 
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
  Col
} from 'antd';
import { 
  ArrowLeftOutlined, 
  EditOutlined,
  ApartmentOutlined,
  BankOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const DepartmentEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [faculties, setFaculties] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [departmentData, setDepartmentData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setPageLoading(true);
        const [departmentData, facultiesData] = await Promise.all([
          departmentService.getDepartmentById(id),
          facultyService.getAllFaculties()
        ]);
        
        setDepartmentData(departmentData);
        form.setFieldsValue({
          ad: departmentData.ad,
          fakulte_id: departmentData.fakulte_id,
        });
        
        setFaculties(facultiesData.map((f: any) => ({ label: f.ad, value: f.id })));
      } catch (err) {
        console.error('Error fetching data:', err);
        message.error(t('error_loading_department_data'));
      } finally {
        setPageLoading(false);
      }
    };
    fetchData();
  }, [id, form, t]);

  const onFinish = async (values: { ad: string; fakulte_id: number }) => {
    if (!id) return;
    setLoading(true);
    try {
      await departmentService.updateDepartment(Number(id), values);
      message.success(t('department_updated_successfully'));
      navigate('/departments');
    } catch (err) {
      console.error('Error updating department:', err);
      message.error(t('error_updating_department'));
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
              {t('edit_department')}
            </Title>
            <Text type="secondary">{t('edit_department_information')}</Text>
          </div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/departments')}
            size="large"
          >
            {t('back_to_departments')}
          </Button>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('departments')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('edit_department')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            <Alert
              message={t('department_edit_notice')}
              description={t('department_edit_notice_description')}
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
                  <ApartmentOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('basic_information')}
                </span>
              </Divider>

              <Form.Item
                name="ad"
                label={t('department_name')}
                rules={[{ required: true, message: t('department_name_required') }]}
                tooltip={t('department_name_tooltip')}
              >
                <Input 
                  prefix={<ApartmentOutlined style={{ color: '#1890ff' }} />}
                  placeholder={t('department_name_placeholder')} 
                  style={{ borderRadius: '8px' }}
                />
              </Form.Item>

              <Divider orientation="left">
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  <BankOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  {t('organizational_information')}
                </span>
              </Divider>

              <Form.Item
                name="fakulte_id"
                label={t('faculty')}
                rules={[{ required: true, message: t('faculty_required') }]}
                tooltip={t('select_faculty_tooltip')}
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
                    {loading ? t('updating_department') : t('update_department')}
                  </Button>
                  <Button 
                    onClick={() => navigate('/departments')}
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
                <ApartmentOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                {t('department_preview')}
              </span>
            }
            style={{ position: 'sticky', top: '24px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Avatar 
                size={80} 
                icon={<ApartmentOutlined />}
                style={{ 
                  backgroundColor: '#1890ff',
                  marginBottom: '16px'
                }}
              />
              <div>
                <Text strong style={{ fontSize: '16px' }}>
                  {form.getFieldValue('ad') || departmentData?.ad || t('department_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {faculties.find(f => f.value === form.getFieldValue('fakulte_id'))?.label || t('faculty_not_selected')}
                </Text>
              </div>
            </div>

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('department_name')}:</Text>
                <Text>{form.getFieldValue('ad') || departmentData?.ad || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('faculty')}:</Text>
                <Text>{faculties.find(f => f.value === form.getFieldValue('fakulte_id'))?.label || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('status')}:</Text>
                <Text style={{ color: '#52c41a' }}>{t('will_remain_active')}</Text>
              </div>
            </Space>

            <Divider />

            <Alert
              message={t('department_changes_will_be_applied')}
              description={t('courses_will_use_updated_information')}
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DepartmentEditPage;

