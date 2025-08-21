import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { courseService, userService } from '../../services/api';
import { 
  Button, 
  Card, 
  Input, 
  Select, 
  Table, 
  message, 
  Spin, 
  Row, 
  Col,
  Typography,
  Breadcrumb,
  Space,
  Avatar,
  Divider,
  Alert,
  Upload,
  Modal,
  List,
  Tag,
  Tooltip,
  Popconfirm
} from 'antd';
        import { 
          ArrowLeftOutlined, 
          UserOutlined,
          PlusOutlined,
          UploadOutlined,
          DeleteOutlined,
          TeamOutlined,
          BookOutlined,
          HomeOutlined
        } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Search } = Input;

interface Student {
  id: number;
  universite_kodu: string;
  ad: string;
  soyad: string;
  eposta: string;
  alinma_tipi: string;
  katilim_yuzdesi?: number;
  devamsizlik_durumu?: string;
}

interface CourseData {
  id: number;
  ad: string;
  kod: string;
  ogretmen_ad: string;
  ogretmen_soyad: string;
  bolum_adi: string;
}

const CourseStudentsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStudent, setAddingStudent] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [error, setError] = useState('');
  
  // Öğrenci ekleme form state'leri
  const [newStudentCode, setNewStudentCode] = useState('');
  const [selectedAlinmaTipi, setSelectedAlinmaTipi] = useState('zorunlu');
  const [searchTerm, setSearchTerm] = useState('');

  // Excel upload modal
  const [excelModalVisible, setExcelModalVisible] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);

  useEffect(() => {
    if (id) {
      fetchCourseData();
      fetchStudents();
    }
  }, [id]);

  const fetchCourseData = async () => {
    try {
      const data = await courseService.getCourseById(id!);
      setCourseData(data);
    } catch (err) {
      console.error('Ders bilgileri alınamadı:', err);
      setError('Ders bilgileri alınamadı');
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await courseService.getCourseStudents(id!);
      console.log('🔧 Öğrenci listesi:', response.data);
      // Backend'den gelen ogrenci_id'yi id olarak map et
      const studentsWithId = (response.data || []).map((student: any) => ({
        ...student,
        id: student.ogrenci_id // Backend'den gelen ogrenci_id'yi id olarak kullan
      }));
      console.log('🔧 Map edilmiş öğrenciler:', studentsWithId);
      setStudents(studentsWithId);
    } catch (err) {
      console.error('Öğrenci listesi alınamadı:', err);
      setError('Öğrenci listesi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentCode.trim()) {
      message.warning('Öğrenci numarası gerekli');
      return;
    }

    setAddingStudent(true);
    try {
      await courseService.addStudentToCourse(id!, {
        universite_kodu: newStudentCode.trim(),
        alinma_tipi: selectedAlinmaTipi
      });
      
      message.success('Öğrenci başarıyla eklendi');
      setNewStudentCode('');
      setSelectedAlinmaTipi('zorunlu');
      fetchStudents(); // Listeyi yenile
    } catch (err: any) {
      console.error('Öğrenci ekleme hatası:', err);
      message.error(err.response?.data?.mesaj || 'Öğrenci eklenirken hata oluştu');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    try {
      console.log('🔧 Öğrenci silme:', { dersId: id, studentId });
      await courseService.removeStudentFromCourse(id!, studentId);
      message.success('Öğrenci dersten çıkarıldı');
      fetchStudents(); // Listeyi yenile
    } catch (err: any) {
      console.error('Öğrenci çıkarma hatası:', err);
      message.error(err.response?.data?.mesaj || 'Öğrenci çıkarılırken hata oluştu');
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      message.warning('Lütfen bir Excel dosyası seçin');
      return;
    }

    setUploadingExcel(true);
         try {
       const result = await courseService.importStudents(id!, excelFile);
       message.success(`${result.successfully_registered} öğrenci başarıyla eklendi`);
       setExcelModalVisible(false);
       setExcelFile(null);
       fetchStudents(); // Listeyi yenile
     } catch (err: any) {
      console.error('Excel yükleme hatası:', err);
      message.error(err.response?.data?.mesaj || 'Excel dosyası yüklenirken hata oluştu');
    } finally {
      setUploadingExcel(false);
    }
  };

  const getAlinmaTipiColor = (tip: string) => {
    switch (tip) {
      case 'zorunlu': return 'blue';
      case 'alttan': return 'orange';
      case 'üsten': return 'green';
      default: return 'default';
    }
  };

  const getAlinmaTipiLabel = (tip: string) => {
    switch (tip) {
      case 'zorunlu': return 'Zorunlu';
      case 'alttan': return 'Alttan';
      case 'üsten': return 'Üsten';
      default: return tip;
    }
  };



  const filteredStudents = students.filter(student =>
    student.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.universite_kodu.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      title: 'Öğrenci',
      key: 'student',
      render: (record: Student) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            size="small" 
            icon={<UserOutlined />} 
            style={{ marginRight: '8px', backgroundColor: '#1890ff' }} 
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.ad} {record.soyad}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.universite_kodu}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'E-posta',
      dataIndex: 'eposta',
      key: 'eposta',
      render: (text: string) => <Text type="secondary">{text || '-'}</Text>,
    },
    {
      title: 'Alınma Tipi',
      dataIndex: 'alinma_tipi',
      key: 'alinma_tipi',
      render: (tip: string) => (
        <Tag color={getAlinmaTipiColor(tip)}>
          {getAlinmaTipiLabel(tip)}
        </Tag>
      ),
    },
    
    {
      title: 'İşlemler',
      key: 'actions',
      width: 100,
      render: (record: Student) => (
        <Popconfirm
          title="Öğrenciyi dersten çıkar"
          description="Bu öğrenciyi dersten çıkarmak istediğinizden emin misiniz?"
          onConfirm={() => handleRemoveStudent(record.id)}
          okText="Evet"
          cancelText="Hayır"
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
          />
        </Popconfirm>
      ),
    },
  ];

  if (loading && !courseData) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              <TeamOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
              {courseData?.ad} - Öğrenci Yönetimi
            </Title>
            <Text type="secondary">
              {courseData?.kod} • {courseData?.ogretmen_ad} {courseData?.ogretmen_soyad} • {courseData?.bolum_adi}
            </Text>
          </div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/courses')}
            size="large"
          >
            Derslere Dön
          </Button>
        </div>

        <Breadcrumb>
          <Breadcrumb.Item href="/dashboard">
            <HomeOutlined />
            Ana Sayfa
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/courses">
            <BookOutlined />
            Dersler
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <TeamOutlined />
            Öğrenci Yönetimi
          </Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
          onClose={() => setError('')}
        />
      )}

      {/* Öğrenci Ekleme Kartı */}
      <Card style={{ marginBottom: '24px' }}>
        <Title level={4} style={{ marginBottom: '16px' }}>
          <PlusOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
          Yeni Öğrenci Ekle
        </Title>
        
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Öğrenci numarası"
              value={newStudentCode}
              onChange={(e) => setNewStudentCode(e.target.value)}
              onPressEnter={handleAddStudent}
              prefix={<UserOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={selectedAlinmaTipi}
              onChange={setSelectedAlinmaTipi}
              style={{ width: '100%' }}
              options={[
                { label: 'Zorunlu', value: 'zorunlu' },
                { label: 'Alttan', value: 'alttan' },
                { label: 'Üsten', value: 'üsten' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddStudent}
              loading={addingStudent}
              style={{ width: '100%' }}
            >
              Öğrenci Ekle
            </Button>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setExcelModalVisible(true)}
              style={{ width: '100%' }}
            >
              Excel'den Yükle
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Öğrenci Listesi */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            Kayıtlı Öğrenciler ({students.length})
          </Title>
          <Search
            placeholder="Öğrenci ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredStudents}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} / ${total} öğrenci`,
          }}
          scroll={{ x: 800 }}
          size="middle"
        />
      </Card>

      {/* Excel Upload Modal */}
      <Modal
        title="Excel'den Öğrenci Yükle"
        open={excelModalVisible}
        onOk={handleExcelUpload}
        onCancel={() => {
          setExcelModalVisible(false);
          setExcelFile(null);
        }}
        confirmLoading={uploadingExcel}
        okText="Yükle"
        cancelText="İptal"
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Upload.Dragger
            accept=".xlsx,.xls"
            beforeUpload={(file) => {
              setExcelFile(file);
              return false; // Prevent auto upload
            }}
            fileList={excelFile ? [excelFile] : []}
            onRemove={() => setExcelFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Excel dosyasını buraya sürükleyin veya tıklayın</p>
            <p className="ant-upload-hint">
              Sadece .xlsx ve .xls dosyaları kabul edilir
            </p>
          </Upload.Dragger>
          
                            <Alert
                    message="Excel Formatı"
                    description={
                      <div>
                        <p>Excel dosyanızda şu sütunlar bulunmalıdır:</p>
                        <ul style={{ textAlign: 'left', margin: '8px 0' }}>
                          <li><strong>Öğrenci No</strong> - Öğrenci numarası (zorunlu)</li>
                          <li><strong>Adı Soyadı</strong> - Öğrenci adı ve soyadı</li>
                          <li><strong>Alış/Ö.Not</strong> - Alınma tipi (Alttan/0, Zorunlu, Üsten gibi)</li>
                          <li><strong>Dvmsz. Durum</strong> - Devamsızlık durumu (opsiyonel)</li>
                        </ul>
                        <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          <strong>Not:</strong> "Alış/Ö.Not" sütunundaki değerler otomatik olarak alınma tipine çevrilecektir.
                        </p>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginTop: '16px' }}
                  />
        </div>
      </Modal>
    </div>
  );
};

export default CourseStudentsPage;
