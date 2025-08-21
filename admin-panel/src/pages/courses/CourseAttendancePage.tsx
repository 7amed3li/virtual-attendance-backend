import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { courseService } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Button, Card, Row, Col, Breadcrumb, Spin, Typography, message } from 'antd';
import { DownloadOutlined, HomeOutlined, BookOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

interface StudentAttendance {
  ogrenci_id: number;
  universite_kodu: string;
  ad: string;
  soyad: string;
  eposta: string;
  toplam_oturum_sayisi: number;
  katildigi_oturum_sayisi: number;
  katilmadigi_oturum_sayisi: number;
  izinli_sayisi: number;
  gec_gelme_sayisi: number;
  katilim_yuzdesi: number;
  devamsizlik_durumu: 'gecti' | 'kaldi' | 'sinirda';
}

const CourseAttendancePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [courseData, setCourseData] = useState<any>(null);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'gecti':
        return t('passed');
      case 'kaldi':
        return t('failed');
      case 'sinirda':
        return t('borderline');
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'gecti':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'kaldi':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'sinirda':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return null;
    }
  };

  const exportToExcel = async () => {
    if (!courseData || !students.length) {
      message.warning('Dışa aktarılacak veri bulunamadı');
      return;
    }

    setExportLoading(true);
    try {
      // Excel workbook oluştur
      const workbook = XLSX.utils.book_new();
      
      // Güncel tarih
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
      
      // Excel verileri hazırla
      const excelData = [
        // Başlık bilgileri
        ['YOKLAMA LİSTESİ'],
        [],
        ['Ders Adı:', courseData.ders_adi || courseName],
        ['Tarih:', formattedDate],
        ['Toplam Öğrenci:', students.length],
        ['Devamsızlık Limiti:', `%${courseData.devamsizlik_limiti_yuzde || 70}`],
        ['Toplam Ders Oturumu:', courseData.toplam_ders_oturumu || '-'],
        [],
        // Tablo başlıkları
        [
          'Sıra No',
          'Öğrenci No',
          'Ad Soyad',
          'E-posta',
          'Toplam Oturum',
          'Katıldığı Oturum',
          'Katılmadığı Oturum',
          'Katılım %',
          'Durum'
        ]
      ];

      // Öğrenci verilerini ekle
      students.forEach((student, index) => {
        excelData.push([
          index + 1,
          student.universite_kodu || '-',
          `${student.ad || ''} ${student.soyad || ''}`.trim(),
          student.eposta || '-',
          student.toplam_oturum_sayisi || 0,
          student.katildigi_oturum_sayisi || 0,
          student.katilmadigi_oturum_sayisi || 0,
          `${student.katilim_yuzdesi?.toFixed(2) || 0}%`,
          getStatusLabel(student.devamsizlik_durumu)
        ]);
      });

      // Worksheet oluştur
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Sütun genişliklerini ayarla
      const columnWidths = [
        { wch: 8 },  // Sıra No
        { wch: 15 }, // Öğrenci No
        { wch: 25 }, // Ad Soyad
        { wch: 25 }, // E-posta
        { wch: 12 }, // Toplam Oturum
        { wch: 15 }, // Katıldığı Oturum
        { wch: 16 }, // Katılmadığı Oturum
        { wch: 12 }, // Katılım %
        { wch: 12 }  // Durum
      ];
      worksheet['!cols'] = columnWidths;

      // Workbook'a worksheet ekle
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Yoklama Raporu');
      
      // Excel dosyasını indir
      const fileName = `${courseName || 'Ders'}_Yoklama_Raporu_${formattedDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      message.success('Excel dosyası başarıyla oluşturuldu ve indirildi');
    } catch (err) {
      console.error('Excel export error:', err);
      message.error('Excel dosyası oluşturulurken hata oluştu');
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const result = await courseService.getCourseAttendanceReport(id!);
        setCourseName(result.ders_adi || `#${id}`);
        setStudents(result.ogrenciler || []);
        setCourseData(result); // Tüm ders verilerini sakla
      } catch (err) {
        console.error('Hata:', err);
        setError(t('fetch_error') || 'Veri alınamadı.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [id, t]);

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb style={{ marginBottom: '16px' }}>
          <Breadcrumb.Item href="/admin">
            <HomeOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/admin/courses">
            <BookOutlined />
            <span>Dersler</span>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <UserOutlined />
            <span>Yoklama Raporu</span>
          </Breadcrumb.Item>
        </Breadcrumb>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>
            {courseName} - Yoklama Raporu
          </Title>
          
          {!loading && students.length > 0 && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToExcel}
              loading={exportLoading}
              size="large"
            >
              Excel Olarak İndir
            </Button>
          )}
        </div>
      </div>

      {/* İstatistik Kartları */}
      {courseData && !loading && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <Title level={4} style={{ color: '#1890ff', margin: 0 }}>
                  {students.length}
                </Title>
                <Text type="secondary">Toplam Öğrenci</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <Title level={4} style={{ color: '#52c41a', margin: 0 }}>
                  {courseData.toplam_ders_oturumu || 0}
                </Title>
                <Text type="secondary">Toplam Oturum</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <Title level={4} style={{ color: '#722ed1', margin: 0 }}>
                  %{courseData.devamsizlik_limiti_yuzde || 70}
                </Title>
                <Text type="secondary">Devamsızlık Limiti</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <Title level={4} style={{ color: '#fa8c16', margin: 0 }}>
                  {students.filter(s => s.devamsizlik_durumu === 'gecti').length}
                </Title>
                <Text type="secondary">Geçen Öğrenci</Text>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Ana İçerik */}
      <Card>
        {error && (
          <div style={{ marginBottom: '16px', color: '#ff4d4f' }}>
            {error}
          </div>
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text>Yoklama verileri yükleniyor...</Text>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Text type="secondary">Yoklama kaydı bulunamadı</Text>
          </div>
        ) : (
          <div className="overflow-x-auto">
                         <table style={{ width: '100%', fontSize: '14px', border: '3px solid #9ca3af', borderCollapse: 'collapse' }}>
               <thead>
                                    <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '3px solid #9ca3af' }}>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Sıra</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Öğrenci No</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Ad Soyad</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>E-posta</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Toplam Oturum</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Katıldığı</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Katılmadığı</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Katılım %</th>
                     <th style={{ padding: '20px 24px', border: '2px solid #9ca3af', textAlign: 'center', fontWeight: 'bold', fontSize: '15px', color: '#374151' }}>Durum</th>
                   </tr>
               </thead>
              <tbody>
                                 {students.map((s, index) => (
                   <tr key={s.ogrenci_id} style={{ 
                     backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                     borderBottom: '2px solid #e5e7eb'
                   }}>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', textAlign: 'center' }}>{index + 1}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db' }}>{s.universite_kodu}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', fontWeight: '500' }}>{s.ad} {s.soyad}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', fontSize: '14px', color: '#6b7280' }}>{s.eposta || '-'}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', textAlign: 'center' }}>{s.toplam_oturum_sayisi || 0}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', textAlign: 'center' }}>{s.katildigi_oturum_sayisi || 0}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', textAlign: 'center' }}>{s.katilmadigi_oturum_sayisi || 0}</td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', textAlign: 'center', fontWeight: '600' }}>
                       {s.katilim_yuzdesi?.toFixed(1) || 0}%
                     </td>
                     <td style={{ padding: '16px 24px', border: '2px solid #d1d5db', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {getStatusIcon(s.devamsizlik_durumu)}
                        <span style={{ 
                          fontWeight: 'medium',
                          color: s.devamsizlik_durumu === 'gecti' ? '#52c41a' : 
                                 s.devamsizlik_durumu === 'kaldi' ? '#ff4d4f' : '#faad14'
                        }}>
                          {getStatusLabel(s.devamsizlik_durumu)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CourseAttendancePage;
