import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { courseService, departmentService, userService, facultyService } from '../../services/api';
import { 
  Button, 
  Form, 
  Input, 
  Select, 
  Card, 
  message, 
  Spin, 
  InputNumber, 
  Row, 
  Col,
  Typography,
  Breadcrumb,
  Space,
  Avatar,
  Divider,
  Alert,
  Steps,
  TimePicker
} from 'antd';
import { 
  ArrowLeftOutlined, 
  BookOutlined, 
  UserOutlined,
  BankOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CalendarOutlined,
  NumberOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Step } = Steps;

const AddCoursePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [faculties, setFaculties] = useState<{ label: string; value: string }[]>([]);
  const [departments, setDepartments] = useState<{ label: string; value: string; fakulte_id: string }[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<{ label: string; value: string }[]>([]);
  const [teachers, setTeachers] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(true); // Tüm step'leri göster

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [departmentsData, usersData, facultiesData] = await Promise.all([
          departmentService.getAllDepartments(),
          userService.getAllUsers(),
          facultyService.getAllFaculties()
        ]);

        setFaculties(facultiesData.map((f: any) => ({ 
          label: f.ad, 
          value: String(f.id) 
        })));

        setDepartments(departmentsData.map((d: any) => ({ 
          label: d.ad, 
          value: String(d.id),
          fakulte_id: String(d.fakulte_id)
        })));

        const teacherUsers = (usersData.data || usersData).filter((u: any) => u.rol === 'ogretmen');
        setTeachers(teacherUsers.map((t: any) => ({ 
          label: `${t.ad} ${t.soyad}`, 
          value: String(t.id) 
        })));
      } catch (err) {
        console.error('Error fetching data:', err);
        message.error(t('error_loading_prerequisites'));
      } finally {
        setPageLoading(false);
      }
    };
    fetchData();
  }, [t]);

  const handleFacultyChange = (fakulteId: string) => {
    form.setFieldValue('bolum_id', undefined);
    const filtered = departments.filter(dept => dept.fakulte_id === fakulteId);
    setFilteredDepartments(filtered.map(({ label, value }) => ({ label, value })));
  };

  const onFinish = async (values: any) => {
    console.log('🚀 YENİ KOD ÇALIŞIYOR - CACHE SORUNU ÇÖZÜLDÜ!', new Date().toLocaleTimeString());
    setLoading(true);
    try {
      // Tüm form değerlerini al (step'lere bakmadan)
      const allValues = form.getFieldsValue();
      console.log('📋 Form tüm değerler:', JSON.stringify(allValues, null, 2));
      console.log('📋 onFinish values:', JSON.stringify(values, null, 2));
      
      // ders_saat değerini direkt kullan (saat cinsinden)
      const dersSaatValue = allValues.ders_saat || values.ders_saat;
      console.log(`🕐 Ders saati: ${dersSaatValue} saat`);
      
      // Manuel olarak değerleri birleştir (hidden field'lardan)
      const courseData = {
        ad: allValues.ad || values.ad,
        kod: allValues.kod || values.kod,
        bolum_id: Number(allValues.bolum_id || values.bolum_id),
        ogretmen_id: Number(allValues.ogretmen_id || values.ogretmen_id),
        donem: allValues.donem || values.donem,
        akademik_yil: allValues.akademik_yil || values.akademik_yil,
        devamsizlik_limiti: allValues.devamsizlik_limiti || values.devamsizlik_limiti || 30,
        sinif: allValues.sinif || values.sinif,
        sube: allValues.sube || values.sube,
        fakulte_id: Number(allValues.fakulte_id || values.fakulte_id),
        ders_saat: dersSaatValue
      };
      
      console.log('🔍 Gönderilecek veriler:', JSON.stringify(courseData, null, 2));
      
      await courseService.addCourse(courseData);
      message.success(t('course_added_successfully'));
      navigate('/courses');
    } catch (err: any) {
      console.error('Error adding course:', err);
      console.error('🔴 Hata detayı:', JSON.stringify(err.response?.data, null, 2));
      console.error('🔴 Status Code:', err.response?.status);
      console.error('🔴 Status Text:', err.response?.statusText);
      message.error(`Hata: ${err.response?.data?.mesaj || err.response?.data?.hatalar?.[0]?.msg || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.warn('Validation Failed:', errorInfo);
    message.error(t('please_fill_required_fields'));
  };

  const validateStep = (step: number) => {
    const values = form.getFieldsValue();
    console.log(`🔍 Step ${step} validation - Form değerleri:`, values);
    
    switch (step) {
      case 0:
        const step0Valid = values.ad && values.kod;
        console.log(`📝 Step 0 - ad: "${values.ad}", kod: "${values.kod}", valid: ${step0Valid}`);
        return step0Valid;
      case 1:
        const step1Valid = values.fakulte_id && values.bolum_id && values.ogretmen_id;
        console.log(`🏢 Step 1 - fakulte_id: "${values.fakulte_id}", bolum_id: "${values.bolum_id}", ogretmen_id: "${values.ogretmen_id}", valid: ${step1Valid}`);
        return step1Valid;
      case 2:
        const step2Valid = values.akademik_yil && values.donem;
        console.log(`📅 Step 2 - akademik_yil: "${values.akademik_yil}", donem: "${values.donem}", valid: ${step2Valid}`);
        return step2Valid;
      case 3:
        const step3Valid = values.sinif && values.sube;
        console.log(`🎓 Step 3 - sinif: "${values.sinif}", sube: "${values.sube}", valid: ${step3Valid}`);
        return step3Valid;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, 3));
    } else {
      message.warning(t('please_complete_current_step'));
    }
  };

  const prevStep = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
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
              <BookOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {t('add_course')}
            </Title>
            <Text type="secondary">{t('add_new_course_to_system')}</Text>
          </div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/courses')}
            size="large"
          >
            {t('back_to_courses')}
          </Button>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item>{t('home')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('courses')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('add_course')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            {/* Steps */}
            <Steps current={currentStep} style={{ marginBottom: '32px' }}>
              <Step title={t('basic_information')} icon={<BookOutlined />} />
              <Step title={t('organizational_information')} icon={<BankOutlined />} />
              <Step title={t('academic_information')} icon={<CalendarOutlined />} />
              <Step title={t('class_details')} icon={<SettingOutlined />} />
            </Steps>

            <Alert
              message={t('course_creation_notice')}
              description={t('course_creation_notice_description')}
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onFinishFailed={onFinishFailed}
              initialValues={{
                ad: '',
                kod: '',
                sinif: '',
                sube: '',
                fakulte_id: undefined,
                bolum_id: undefined,
                ogretmen_id: undefined,
                akademik_yil: '2024-2025',
                donem: 'Güz',
                devamsizlik_limiti: 30
              }}
              size="large"
            >
              {/* Step 0: Basic Information */}
              <div style={{ display: showAllSteps ? 'block' : 'none' }}>
                <Divider orientation="left">
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    <BookOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    {t('basic_information')}
                  </span>
                </Divider>

                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="ad" 
                      label={t('course_name')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <Input 
                        prefix={<BookOutlined style={{ color: '#1890ff' }} />}
                        placeholder={t('course_name_placeholder')} 
                        style={{ borderRadius: '8px' }}
                      /> 
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="kod" 
                      label={t('course_code')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <Input 
                        prefix={<NumberOutlined style={{ color: '#1890ff' }} />}
                        placeholder={t('course_code_placeholder')} 
                        style={{ borderRadius: '8px' }}
                      /> 
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Step 1: Organizational Information */}
              <div style={{ display: showAllSteps ? 'block' : 'none' }}>
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
                        onChange={handleFacultyChange}
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
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
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      /> 
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item 
                  name="ogretmen_id" 
                  label={t('instructor')} 
                  rules={[{ required: true, message: t('field_required') }]}
                > 
                  <Select 
                    showSearch 
                    placeholder={t('select_instructor')} 
                    style={{ borderRadius: '8px' }}
                    suffixIcon={<UserOutlined style={{ color: '#1890ff' }} />}
                    options={teachers} 
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} 
                  /> 
                </Form.Item>
              </div>

              {/* Step 2: Academic Information */}
              <div style={{ display: showAllSteps ? 'block' : 'none' }}>
                <Divider orientation="left">
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    <CalendarOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    {t('academic_information')}
                  </span>
                </Divider>

                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="akademik_yil" 
                      label={t('academic_year')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <Input 
                        prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
                        placeholder={t('academic_year_placeholder')} 
                        style={{ borderRadius: '8px' }}
                      /> 
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="donem" 
                      label={t('term')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <Select 
                        placeholder={t('select_semester')} 
                        style={{ borderRadius: '8px' }}
                        options={[
                          {label: 'Güz', value: 'Güz'}, 
                          {label: 'Bahar', value: 'Bahar'}, 
                          {label: 'Yaz', value: 'Yaz'}
                        ]} 
                      /> 
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="devamsizlik_limiti" 
                      label={t('absence_limit')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <InputNumber 
                        min={0} 
                        max={100} 
                        addonAfter="%" 
                        style={{ width: '100%', borderRadius: '8px' }} 
                        placeholder={t('attendance_limit_placeholder')} 
                      /> 
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="ders_saat" 
                      label="Ders Saati" 
                      rules={[{ required: false, message: 'Ders saati gerekli' }]}
                    > 
                      <InputNumber 
                        min={0}
                        max={23}
                        placeholder="Saat (0-23)"
                        style={{ width: '100%', borderRadius: '8px' }}
                        addonAfter="saat"
                        prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                      /> 
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Step 3: Class Details */}
              <div style={{ display: showAllSteps ? 'block' : 'none' }}>
                <Divider orientation="left">
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    <SettingOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    {t('class_details')}
                  </span>
                </Divider>

                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="sinif" 
                      label={t('class')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <Input 
                        prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
                        placeholder={t('class_placeholder')} 
                        style={{ borderRadius: '8px' }}
                      /> 
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      name="sube" 
                      label={t('branch')} 
                      rules={[{ required: true, message: t('field_required') }]}
                    > 
                      <Input 
                        prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
                        placeholder={t('section_placeholder')} 
                        style={{ borderRadius: '8px' }}
                      /> 
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Navigation Buttons */}
              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  {currentStep > 0 && (
                    <Button 
                      onClick={prevStep}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      {t('previous')}
                    </Button>
                  )}
                </div>
                <div>
                  <Space>
                    <Button 
                      onClick={() => form.resetFields()}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      {t('reset')}
                    </Button>
                    {currentStep < 3 ? (
                      <Button 
                        type="primary"
                        onClick={nextStep}
                        size="large"
                        style={{ borderRadius: '8px' }}
                      >
                        {t('next')}
                      </Button>
                    ) : (
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
                        {loading ? t('adding_course') : t('add_course')}
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            </Form>
          </Card>
        </Col>

        {/* Sağ Panel - Preview */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <span>
                <BookOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                {t('course_preview')}
              </span>
            }
            style={{ position: 'sticky', top: '24px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Avatar 
                size={80} 
                icon={<BookOutlined />}
                style={{ 
                  backgroundColor: '#1890ff',
                  marginBottom: '16px'
                }}
              />
              <div>
                <Text strong style={{ fontSize: '16px' }}>
                  {form.getFieldValue('ad') || t('course_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {form.getFieldValue('kod') || t('course_code')}
                </Text>
              </div>
            </div>

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('faculty')}:</Text>
                <Text>{faculties.find(f => f.value === form.getFieldValue('fakulte_id'))?.label || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('department')}:</Text>
                <Text>{filteredDepartments.find(d => d.value === form.getFieldValue('bolum_id'))?.label || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('instructor')}:</Text>
                <Text>{teachers.find(t => t.value === form.getFieldValue('ogretmen_id'))?.label || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('academic_year')}:</Text>
                <Text>{form.getFieldValue('akademik_yil') || '-'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('term')}:</Text>
                <Text>{form.getFieldValue('donem') || '-'}</Text>
              </div>
            </Space>

            <Divider />

            <Alert
              message={t('course_will_be_active')}
              description={t('course_will_be_ready_for_sessions')}
              type="success"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AddCoursePage;
