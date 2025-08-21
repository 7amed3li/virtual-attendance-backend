import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
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
  TimePicker
} from 'antd';
import { 
  ArrowLeftOutlined, 
  EditOutlined, 
  BookOutlined, 
  UserOutlined,
  BankOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CalendarOutlined,
  NumberOutlined,
  SettingOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EditCoursePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [faculties, setFaculties] = useState<{ label: string; value: string }[]>([]);
  const [departments, setDepartments] = useState<{ label: string; value: string; fakulte_id: string }[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<{ label: string; value: string }[]>([]);
  const [teachers, setTeachers] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [courseData, setCourseData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setPageLoading(true);
        const [courseData, departmentsData, usersData, facultiesData] = await Promise.all([
          courseService.getCourseById(id),
          departmentService.getAllDepartments(),
          userService.getAllUsers(),
          facultyService.getAllFaculties()
        ]);

        setCourseData(courseData);

        setFaculties(facultiesData.map((f: any) => ({ 
          label: f.ad, 
          value: String(f.id) 
        })));

        const depts = departmentsData.map((d: any) => ({ 
          label: d.ad, 
          value: String(d.id),
          fakulte_id: String(d.fakulte_id)
        }));
        setDepartments(depts);

        // Seçili bölümün fakültesini bul ve filtrelenmiş bölümleri ayarla
        const selectedDept = depts.find(d => d.value === String(courseData.bolum_id));
        if (selectedDept) {
          const filtered = depts.filter(d => d.fakulte_id === selectedDept.fakulte_id);
          setFilteredDepartments(filtered.map(({ label, value }) => ({ label, value })));
        }

        const teacherUsers = (usersData.data || usersData).filter((u: any) => u.rol === 'ogretmen');
        setTeachers(teacherUsers.map((t: any) => ({ 
          label: `${t.ad} ${t.soyad}`, 
          value: String(t.id) 
        })));

        // ders_saat değerini direkt kullan (saat cinsinden)
        console.log(`🕐 Ders saati: ${courseData.ders_saat} saat`);

        // Form değerlerini set et
        form.setFieldsValue({
          ...courseData,
          bolum_id: String(courseData.bolum_id),
          ogretmen_id: String(courseData.ogretmen_id),
          fakulte_id: selectedDept ? selectedDept.fakulte_id : undefined
        });

      } catch (err) {
        console.error('Error fetching data:', err);
        message.error(t('error_loading_course_data'));
      } finally {
        setPageLoading(false);
      }
    };
    fetchData();
  }, [id, form, t]);

  const handleFacultyChange = (fakulteId: string) => {
    form.setFieldValue('bolum_id', undefined);
    const filtered = departments.filter(dept => dept.fakulte_id === fakulteId);
    setFilteredDepartments(filtered.map(({ label, value }) => ({ label, value })));
  };

  const onFinish = async (values: any) => {
    if (!id) return;
    setLoading(true);
    try {
      // ders_saat değerini direkt kullan (saat cinsinden)
      console.log(`🕐 Ders saati: ${values.ders_saat} saat`);
      
      values.bolum_id = Number(values.bolum_id);
      values.ogretmen_id = Number(values.ogretmen_id);
      values.fakulte_id = Number(values.fakulte_id);
      
      await courseService.updateCourse(id, values);
      message.success(t('course_updated_successfully'));
      navigate('/courses');
    } catch (err) {
      console.error('Error updating course:', err);
      message.error(t('error_updating_course'));
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
              {t('edit_course')}
            </Title>
            <Text type="secondary">{t('edit_course_information')}</Text>
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
          <Breadcrumb.Item>{t('edit_course')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <Row gutter={[24, 24]}>
        {/* Sol Panel - Form */}
        <Col xs={24} lg={16}>
          <Card>
            <Alert
              message={t('course_edit_notice')}
              description={t('course_edit_notice_description')}
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
                    {loading ? t('updating_course') : t('update_course')}
                  </Button>
                  <Button 
                    onClick={() => navigate('/courses')}
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
                  {form.getFieldValue('ad') || courseData?.ad || t('course_name')}
                </Text>
                <br />
                <Text type="secondary">
                  {form.getFieldValue('kod') || courseData?.kod || t('course_code')}
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
              message={t('changes_will_be_applied')}
              description={t('course_will_be_updated_immediately')}
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default EditCoursePage;
