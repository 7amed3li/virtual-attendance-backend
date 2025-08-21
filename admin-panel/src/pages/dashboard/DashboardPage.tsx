import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { reportService, facultyService, dashboardService } from '../../services/api';
import { 
  Card, 
  Col, 
  Row, 
  Statistic, 
  Spin, 
  Typography, 
  DatePicker,
  Select,
  Space,
  Button,
  Alert,
  Breadcrumb,
  Avatar,
  Divider,
  List,
  Progress,
  Badge,
  Timeline,
  Tag,
  Tooltip,
  notification
} from 'antd';
import dayjs from 'dayjs';
import { 
  ReadOutlined, 
  CalendarOutlined, 
  BarChartOutlined,
  DashboardOutlined,
  TrophyOutlined,
  UserOutlined,
  BookOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  QrcodeOutlined,
  FileTextOutlined,
  UsergroupAddOutlined,
  EyeOutlined,
  BellOutlined,
  SyncOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  // هذا هو المكان الصحيح لجميع الـ Hooks  
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalSessions: 0,
    averageAttendance: 0,
    activeCourses: 0,
    activeStudents: 0,
    facultyCourses: [] as { fakulte_id: number; fakulte_adi: string; ders_sayisi: number }[],
  });
  // Real data state'ler
  const [todaysSessions, setTodaysSessions] = useState({
    active: 0,
    completed: 0,
    total: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [lowAttendanceCourses, setLowAttendanceCourses] = useState<any[]>([]);
  const [topCourses, setTopCourses] = useState<any[]>([]);
  const [currentDayCourses, setCurrentDayCourses] = useState<any[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState({
    thisWeek: 0,
    lastWeek: 0,
    trend: 'stable'
  });
  
  // Yeni state'ler
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Zaman aralığı state'i (varsayılan: bugün)
  const [interval, setIntervalValue] = useState<string | number>(86400); // 24 saat = 86400 saniye
  // Tarih aralığı state'i
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  // Fakülte filtresi state'i
  const [selectedFaculty, setSelectedFaculty] = useState<number | undefined>(undefined);
  const [faculties, setFaculties] = useState<{ id: number; ad: string }[]>([]);

  // Dropdown seçenekleri (saniye cinsinden veya özel)
  const intervalOptions = [
    { label: '1 saniye', value: 1 },
    { label: '5 saniye', value: 5 },
    { label: '10 saniye', value: 10 },
    { label: '30 saniye', value: 30 },
    { label: '1 dakika', value: 60 },
    { label: '2 dakika', value: 120 },
    { label: '5 dakika', value: 300 },
    { label: 'Tüm Zamanlar', value: 0 },
    { label: 'Tarihler Arası', value: 'custom' },
  ];



  // Real API çağrıları
  const fetchTodaysSessions = async () => {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const params = new URLSearchParams();
      params.append('startDate', today);
      params.append('endDate', today);
      
      const data = await reportService.getDashboardStats(undefined, undefined, params);
      setTodaysSessions({
        active: data.activeCourses || 0,
        completed: data.totalSessions || 0,
        total: (data.activeCourses || 0) + (data.totalSessions || 0)
      });
    } catch (error) {
      console.error('Error fetching today sessions:', error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      // Gerçek API'den son aktiviteleri çek
      const activitiesData = await dashboardService.getRecentActivities();
      
      // Son aktiviteleri formatla
      const recentData: any[] = [];
      
      // Son oturumları ekle
      if (activitiesData?.sessions?.length > 0) {
        activitiesData.sessions.slice(0, 3).forEach((session: any, index: number) => {
          recentData.push({
            id: `session-${session.id}`,
            type: 'session',
            title: t('new_session_created'),
            description: `${session.ders_adi} - ${session.konu || 'Ders Oturumu'}`,
            time: dayjs(session.tarih + ' ' + session.saat).format('HH:mm'),
            icon: <QrcodeOutlined />,
            color: '#1890ff'
          });
        });
      }
      
      // Son yoklamaları ekle
      if (activitiesData?.attendance?.length > 0) {
        activitiesData.attendance.slice(0, 2).forEach((attendance: any, index: number) => {
          recentData.push({
            id: `attendance-${attendance.id}`,
            type: 'attendance',
            title: t('student_joined_session'),
            description: `${attendance.ogrenci_adi} ${attendance.ogrenci_soyadi} - ${attendance.ders_adi}`,
            time: dayjs(attendance.zaman).format('HH:mm'),
            icon: <UserOutlined />,
            color: attendance.durum === 'katildi' ? '#52c41a' : '#ff4d4f'
          });
        });
      }
      
      // Dashboard stats'tan gelen verilerle ek aktivite ekle
      if (stats.totalStudents > 0) {
        recentData.unshift({
          id: 'stats-update',
          type: 'stats',
          title: t('dashboard_updated'),
          description: `${stats.totalStudents} ${t('total_students')} - ${Math.round(stats.averageAttendance || 0)}% ${t('average_attendance')}`,
          time: dayjs().format('HH:mm'),
          icon: <BarChartOutlined />,
          color: '#722ed1'
        });
      }
      
      setRecentActivities(recentData);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities([]);
    }
  };

  const fetchCurrentDayCourses = async () => {
    try {
      // ⭐ التعديل: استخدام الدالة المخصصة من dashboardService
      // هذا يضمن أن الطلب يتم بنفس طريقة باقي طلبات الـ API
      const data = await dashboardService.getCurrentDayCourses();
      setCurrentDayCourses(data.courses || []);
    } catch (error) {
      console.error('Error fetching current day courses:', error);
      setCurrentDayCourses([]);
    }
  };



  const fetchLowAttendanceCourses = async () => {
    try {
      // Gerçek API'den düşük katılımlı dersleri çek
      const coursesData = await dashboardService.getLowAttendanceCourses();
      
      if (coursesData?.length > 0) {
        const lowAttendanceData = coursesData.map((course: any) => ({
          id: course.id,
          name: course.ders_adi,
          attendance: Math.round(course.katilim_orani || 0),
          totalStudents: course.toplam_ogrenci || 0,
          professor: `${course.ogretmen_adi} ${course.ogretmen_soyadi}`,
          status: course.katilim_orani < 30 ? 'critical' : course.katilim_orani < 50 ? 'warning' : 'normal'
        }));
        setLowAttendanceCourses(lowAttendanceData);
      } else {
        setLowAttendanceCourses([]);
      }
    } catch (error) {
      console.error('Error fetching low attendance courses:', error);
      setLowAttendanceCourses([]);
    }
  };

  const fetchTopCourses = async () => {
    try {
      // Gerçek API'den en performanslı dersleri çek
      const coursesData = await dashboardService.getTopPerformingCourses();
      
      if (coursesData?.length > 0) {
        const topCoursesData = coursesData.map((course: any, index: number) => ({
          id: course.id,
          name: course.ders_adi,
          attendance: Math.round(course.katilim_orani || 0),
          totalStudents: course.toplam_ogrenci || 0,
          professor: `${course.ogretmen_adi} ${course.ogretmen_soyadi}`,
          trend: index === 0 ? 'up' : index === 1 ? 'up' : 'stable'
        }));
        setTopCourses(topCoursesData);
      } else {
        setTopCourses([]);
      }
    } catch (error) {
      console.error('Error fetching top courses:', error);
      setTopCourses([]);
    }
  };

  const fetchWeeklyTrend = async () => {
    try {
      const thisWeekStart = dayjs().startOf('week').format('YYYY-MM-DD');
      const thisWeekEnd = dayjs().endOf('week').format('YYYY-MM-DD');
      const lastWeekStart = dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
      const lastWeekEnd = dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD');

      const [thisWeekData, lastWeekData] = await Promise.all([
        reportService.getDashboardStats(thisWeekStart, thisWeekEnd),
        reportService.getDashboardStats(lastWeekStart, lastWeekEnd)
      ]);

      const thisWeek = thisWeekData.averageAttendance || 0;
      const lastWeek = lastWeekData.averageAttendance || 0;
      
      let trend = 'stable';
      if (thisWeek > lastWeek + 5) trend = 'up';
      if (thisWeek < lastWeek - 5) trend = 'down';

      setWeeklyTrend({
        thisWeek: Math.round(thisWeek),
        lastWeek: Math.round(lastWeek),
        trend
      });
    } catch (error) {
      console.error('Error fetching weekly trend:', error);
      setWeeklyTrend({
        thisWeek: 0,
        lastWeek: 0,
        trend: 'stable'
      });
    }
  };

  // Fakülteleri çekme fonksiyonu
  const fetchFaculties = async () => {
    try {
      const facultiesData = await facultyService.getAllFaculties();
      setFaculties(facultiesData);
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  };

  // Dashboard verilerini çekme fonksiyonu
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      
      if (selectedFaculty !== undefined && selectedFaculty !== null) {
        params.append('facultyId', selectedFaculty.toString());
      }
      
      if (interval === 'custom' && customRange[0] && customRange[1]) {
        params.append('startDate', customRange[0].format('YYYY-MM-DD'));
        params.append('endDate', customRange[1].format('YYYY-MM-DD'));
      } else if (typeof interval === 'number' && interval > 0) {
        const currentDate = dayjs(); // Bugün
        const pastDate = currentDate.subtract(interval, 'seconds'); // interval saniye geriye git
        params.append('startDate', pastDate.format('YYYY-MM-DD'));
        params.append('endDate', currentDate.format('YYYY-MM-DD'));
        console.log('🔍 Tarih aralığı:', { startDate: pastDate.format('YYYY-MM-DD'), endDate: currentDate.format('YYYY-MM-DD') });
      }

      const dashboardData = await reportService.getDashboardStats(undefined, undefined, params);
      setStats(dashboardData);
      
      // Fetch additional real data
      await Promise.all([
        fetchTodaysSessions(),
        fetchRecentActivities(),
        fetchLowAttendanceCourses(),
        fetchTopCourses(),
        fetchWeeklyTrend(),
        fetchCurrentDayCourses()
      ]);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(t('error_loading_dashboard_data'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setLastUpdated(new Date());
    setIsRefreshing(false);
    notification.success({
      message: t('dashboard_updated'),
      description: t('dashboard_updated_description'),
      placement: 'bottomRight',
    });
  };

  useEffect(() => {
    fetchFaculties();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedFaculty, interval, customRange]);

  const StatCard = ({ title, value, icon, color, loading = false, subtitle = null }: any) => (
    <Card 
      style={{ 
        height: '100%', 
        background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`, 
        color: 'white', 
        border: 'none',
        borderRadius: '12px',
        minHeight: '120px'
      }}
      bodyStyle={{ padding: '16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ 
            color: 'rgba(255,255,255,0.9)', 
            fontSize: '12px', 
            display: 'block', 
            marginBottom: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {title}
          </Text>
          <div style={{ 
            color: 'white', 
            fontSize: '24px', 
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {loading ? <Spin size="small" /> : value}
          </div>
          {subtitle && (
            <Text style={{ 
              color: 'rgba(255,255,255,0.8)', 
              fontSize: '11px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {subtitle}
            </Text>
          )}
        </div>
        <Avatar 
          size={48} 
          icon={icon} 
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.2)', 
            color: 'white',
            fontSize: '20px',
            flexShrink: 0
          }} 
        />
      </div>
    </Card>
  );

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
      case 'down': return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
      default: return <MinusOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#52c41a';
      case 'down': return '#ff4d4f';
      default: return '#faad14';
    }
  };

  if (loading && stats.totalCourses === 0) {
    return (
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      maxWidth: '100%', 
      margin: '0 auto',
      overflow: 'hidden'
    }}>
      <style>
        {`
          /* Webkit tabanlı tarayıcılar için scrollbar stilleri */
          .dashboard-scroll::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .dashboard-scroll::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
          }
          .dashboard-scroll::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
          }
          .dashboard-scroll::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
          }
          
          /* Firefox için scrollbar stilleri */
          .dashboard-scroll {
            scrollbar-width: thin;
            scrollbar-color: #c1c1c1 #f1f1f1;
          }
          
          /* Ant Design Select dropdown scroll */
          .ant-select-dropdown .rc-virtual-list-scrollbar-thumb {
            background: #c1c1c1 !important;
          }
        `}
      </style>
      {/* Dashboard Header */}
      <Card style={{ marginBottom: '24px', borderRadius: '12px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          flexWrap: 'wrap', 
          gap: '16px' 
        }}>
          <div style={{ minWidth: 0, flex: '1' }}>
            <Title level={3} style={{ 
              margin: 0, 
              color: '#1890ff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              <DashboardOutlined style={{ marginRight: '8px' }} />
              {t('dashboard')}
            </Title>
            {lastUpdated && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('last_updated')}: {dayjs(lastUpdated).format('HH:mm:ss')}
              </Text>
            )}
          </div>
          
          <Space wrap size="small">
            
            {/* Faculty filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{t('faculty')}:</Text>
              <Select
                style={{ minWidth: '120px', maxWidth: '200px' }}
                placeholder={t('select_faculty')}
                value={selectedFaculty}
                onChange={setSelectedFaculty}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                dropdownStyle={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  scrollbarWidth: 'thin'
                }}
                options={[
                  { label: t('all_faculties'), value: null },
                  ...faculties.map(f => ({ label: f.ad, value: f.id }))
                ]}
              />
            </div>
            
            {/* Interval filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{t('interval')}:</Text>
              <Select
                style={{ minWidth: '100px', maxWidth: '150px' }}
                value={interval}
                onChange={setIntervalValue}
                dropdownStyle={{
                  maxHeight: '250px',
                  overflow: 'auto',
                  scrollbarWidth: 'thin'
                }}
                options={intervalOptions}
              />
            </div>
            
            {interval === 'custom' && (
              <DatePicker.RangePicker
                value={customRange}
                onChange={(dates) => setCustomRange(dates || [null, null])}
                format="YYYY-MM-DD"
                allowClear
                style={{ maxWidth: '250px' }}
              />
            )}
            
            <Tooltip title={t('manual_refresh')}>
              <Button
                type="primary"
                icon={isRefreshing ? <SyncOutlined spin /> : <ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading || isRefreshing}
                style={{ borderRadius: '8px' }}
                size="small"
              >
                {t('refresh')}
              </Button>
            </Tooltip>
          </Space>
        </div>
      </Card>

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

      {/* Ana İstatistikler */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <StatCard 
            title={t('total_students')}
            value={stats.totalStudents}
            icon={<UsergroupAddOutlined />}
            color="#1890ff"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard 
            title={t('total_courses')}
            value={stats.totalCourses}
            icon={<BookOutlined />}
            color="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard 
            title={t('total_sessions')}
            value={stats.totalSessions}
            icon={<QrcodeOutlined />}
            color="#fa8c16"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard 
            title={t('average_attendance')}
            value={`${Math.round(stats.averageAttendance || 0)}%`}
            icon={<BarChartOutlined />}
            color="#722ed1"
            loading={loading}
          />
        </Col>
      </Row>

      {/* İkinci Seviye İstatistikler */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8}>
          <StatCard 
            title={t('todays_sessions')}
            value={todaysSessions.total}
            icon={<CalendarOutlined />}
            color="#13c2c2"
            loading={loading}
            subtitle={`${todaysSessions.active} ${t('active')}, ${todaysSessions.completed} ${t('completed')}`}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard 
            title="Bugünün Dersleri"
            value={currentDayCourses.length}
            icon={<ClockCircleOutlined />}
            color="#eb2f96"
            loading={loading}
            subtitle={`${currentDayCourses.filter(c => c.is_current).length} şu anda aktif`}
          />
        </Col>
      </Row>

      {/* Bugünün Dersleri Detay */}
      {currentDayCourses.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24}>
            <Card 
              title={
                <span>
                  <ClockCircleOutlined style={{ marginRight: '8px', color: '#eb2f96' }} />
                  Bugünün Dersleri
                </span>
              }
              style={{ minHeight: '200px' }}
            >
              <div className="dashboard-scroll" style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                overflowX: 'hidden',
                paddingRight: '8px'
              }}>
                <List
                  dataSource={currentDayCourses}
                  renderItem={(course) => (
                    <List.Item
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: course.is_current ? '#f6ffed' : 'transparent',
                        borderRadius: '8px',
                        marginBottom: '8px'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Badge 
                            status={course.is_current ? 'processing' : 'default'} 
                            text=""
                          />
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold' }}>{course.ad}</span>
                                                                  <Tag color={course.is_current ? 'green' : course.is_near ? 'orange' : 'blue'}>
                                        {course.ders_saat_readable}
                                      </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <div>Öğretmen: {course.ogretmen_ad} {course.ogretmen_soyad}</div>
                            <div>Bölüm: {course.bolum_adi}</div>
                                                                  {course.is_current && (
                                        <Tag color="green" style={{ marginTop: '4px' }}>
                                          Şu anda aktif
                                        </Tag>
                                      )}
                                      {course.is_near && !course.is_current && (
                                        <Tag color="orange" style={{ marginTop: '4px' }}>
                                          Yakında
                                        </Tag>
                                      )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </Card>
          </Col>
        </Row>
      )}



      {/* Son Aktiviteler ve Haftalık Trend */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <span>
                <BellOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                {t('recent_activities')}
              </span>
            }
            style={{ minHeight: '350px', height: 'auto' }}
          >
            {recentActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <BellOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>Henüz aktivite bulunmuyor</div>
              </div>
            ) : (
                              <div className="dashboard-scroll" style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  overflowX: 'hidden',
                  paddingRight: '8px'
                }}>
                <Timeline
                  items={recentActivities.map((activity, index) => ({
                    dot: <ClockCircleOutlined style={{ color: activity.color }} />,
                    children: (
                      <div key={activity.id} style={{ marginBottom: '12px', paddingRight: '4px' }}>
                        <div style={{ 
                          fontWeight: 'bold',
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          maxWidth: 'calc(100% - 20px)'
                        }}>
                          <Tooltip title={activity.title}>
                            {activity.title}
                          </Tooltip>
                        </div>
                        <div style={{ 
                          fontSize: '12px',
                          color: '#666',
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          marginBottom: '4px',
                          maxWidth: 'calc(100% - 20px)'
                        }}>
                          <Tooltip title={activity.description}>
                            {activity.description}
                          </Tooltip>
                        </div>
                        <Text type="secondary" style={{ fontSize: '10px' }}>
                          {activity.time}
                        </Text>
                      </div>
                    )
                  }))}
                />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <span>
                <BarChartOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                {t('weekly_trend')}
              </span>
            }
            style={{ minHeight: '350px', height: 'auto' }}
          >
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ marginBottom: '20px' }}>
                <Text strong style={{ fontSize: '16px' }}>Bu Hafta</Text>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff', margin: '8px 0' }}>
                  {weeklyTrend.thisWeek}%
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <Text type="secondary">Geçen Hafta: {weeklyTrend.lastWeek}%</Text>
                <div style={{ marginTop: '8px' }}>
                  {weeklyTrend.trend === 'up' && (
                    <Tag color="green">
                      <ArrowUpOutlined /> {t('trend_up')}
                    </Tag>
                  )}
                  {weeklyTrend.trend === 'down' && (
                    <Tag color="red">
                      <ArrowDownOutlined /> {t('trend_down')}
                    </Tag>
                  )}
                  {weeklyTrend.trend === 'stable' && (
                    <Tag color="blue">
                      <MinusOutlined /> {t('trend_stable')}
                    </Tag>
                  )}
                </div>
              </div>
              <Progress 
                type="circle" 
                percent={weeklyTrend.thisWeek} 
                format={percent => `${percent}%`}
                strokeColor={
                  weeklyTrend.trend === 'up' ? '#52c41a' : 
                  weeklyTrend.trend === 'down' ? '#ff4d4f' : '#1890ff'
                }
              />
            </div>
          </Card>
        </Col>
      </Row>



      {/* Düşük Katılımlı Dersler ve En Aktif Dersler */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <span>
                <BellOutlined style={{ marginRight: '8px', color: '#ff4d4f' }} />
                {t('low_attendance_alert')}
              </span>
            }
            style={{ minHeight: '350px', height: 'auto' }}
          >
            {lowAttendanceCourses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <Badge status="success" />
                <Text type="secondary">Tüm dersler normal katılım seviyesinde</Text>
              </div>
            ) : (
              <>
                <Alert
                  message={`${lowAttendanceCourses.length} ${t('courses_below_threshold')}`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <div className="dashboard-scroll" style={{ 
                  maxHeight: '280px', 
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingRight: '8px'
                }}>
                  <List
                    dataSource={lowAttendanceCourses}
                    size="small"
                    renderItem={(course: any) => (
                      <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <List.Item.Meta
                          avatar={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                          title={
                            <div style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              maxWidth: 'calc(100% - 40px)'
                            }}>
                              <Tooltip title={course.name}>
                                {course.name}
                              </Tooltip>
                            </div>
                          }
                          description={
                            <div>
                              <Progress
                                percent={course.attendance}
                                status="exception"
                                size="small"
                                format={(percent) => `${percent}%`}
                                style={{ marginBottom: '4px' }}
                              />
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                <div>Toplam öğrenci: {course.totalStudents}</div>
                                <div style={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  <Tooltip title={course.professor}>
                                    Öğretim Üyesi: {course.professor}
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <span>
                <FireOutlined style={{ marginRight: '8px', color: '#fa8c16' }} />
                {t('top_active_courses')}
              </span>
            }
            style={{ minHeight: '350px', height: 'auto' }}
          >
            {topCourses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <FireOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>Henüz aktif ders verisi bulunmuyor</div>
              </div>
            ) : (
              <div className="dashboard-scroll" style={{ 
                maxHeight: '300px', 
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '8px'
              }}>
                <List
                  dataSource={topCourses}
                  size="small"
                  renderItem={(course: any) => (
                    <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        avatar={
                          <Badge 
                            count={getTrendIcon(course.trend)} 
                            style={{ backgroundColor: getTrendColor(course.trend) }}
                          />
                        }
                        title={
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            maxWidth: 'calc(100% - 40px)'
                          }}>
                            <Tooltip title={course.name}>
                              {course.name}
                            </Tooltip>
                          </div>
                        }
                        description={
                          <div>
                            <Tag color="green">{course.attendance}% katılım</Tag>
                            <Tag color="blue">{course.totalStudents} öğrenci</Tag>
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#666',
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              marginTop: '4px'
                            }}>
                              <Tooltip title={course.professor}>
                                Öğretim Üyesi: {course.professor}
                              </Tooltip>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
