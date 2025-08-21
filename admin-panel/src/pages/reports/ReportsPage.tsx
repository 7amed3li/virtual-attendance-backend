import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reportService } from '../../services/api';
import {
  Box, 
  Grid, 
  Paper, 
  Typography, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell,
  CircularProgress, 
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
  Skeleton,
  Container,
  Breadcrumbs,
  Link,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  School as SchoolIcon,
  Group as GroupIcon,
  BarChart as BarChartIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<any | null>(null);
  const [universityStats, setUniversityStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    averageAttendance: 0,
    totalFaculties: 0
  });
  const [faculties, setFaculties] = useState<any[]>([]);
  const [facultyReports, setFacultyReports] = useState<any[]>([]);
  const [departmentReports, setDepartmentReports] = useState<any[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [loadingDepartment, setLoadingDepartment] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError('');
      const universityReport = await reportService.getUniversityReport();

      setUniversityStats({
        totalCourses: universityReport.total_dersler || 0,
        totalStudents: universityReport.total_ogrenciler || 0, 
        averageAttendance: Math.round(universityReport.total_katilim_orani || 0),
        totalFaculties: universityReport.total_fakulteler || 0
      });
      
      setFaculties(universityReport.fakulte_bazli_oranlar || []);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setError(t('error_loading_reports'));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [t]);

  const handleFacultyClick = async (faculty: any) => {
    setSelectedFaculty(faculty);
    setSelectedDepartment(null);
    setDepartmentReports([]);
    setLoadingFaculty(true);
    try {
      const facultyReport = await reportService.getFacultyReport(faculty.fakulte_id);
      setFacultyReports(facultyReport.bolum_bazli_oranlar || []);
    } catch (err) {
      console.error('Faculty report error:', err);
      setFacultyReports([]);
    }
    setLoadingFaculty(false);
  };

  const handleDepartmentClick = async (department: any) => {
    setSelectedDepartment(department);
    setLoadingDepartment(true);
    try {
      const departmentReport = await reportService.getDepartmentReport(department.bolum_id);
      setDepartmentReports(departmentReport || []);
    } catch (err) {
      console.error('Department report error:', err);
      setDepartmentReports([]);
    }
    setLoadingDepartment(false);
  };

  const resetView = () => {
    setSelectedFaculty(null);
    setSelectedDepartment(null);
    setFacultyReports([]);
    setDepartmentReports([]);
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'warning';
    return 'error';
  };

  const StatCard = ({ icon, title, value, color = 'primary' }: any) => (
    <Card elevation={3} sx={{ height: '100%', background: `linear-gradient(135deg, ${color === 'primary' ? '#1976d2' : color === 'secondary' ? '#9c27b0' : color === 'success' ? '#2e7d32' : '#ed6c02'} 0%, ${color === 'primary' ? '#42a5f5' : color === 'secondary' ? '#ba68c8' : color === 'success' ? '#66bb6a' : '#ffb74d'} 100%)`, color: 'white' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
        <Box sx={{ mr: 2, fontSize: 48 }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            {title}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <AssessmentIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={700}>
            {t('attendance_reports')}
          </Typography>
        </Box>
        
        <Grid container spacing={3} mb={4}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width={200} height={40} />
        </Box>
        <Skeleton variant="rectangular" height={400} />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AssessmentIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={700}>
            {t('attendance_reports')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchReports}
          disabled={loading}
        >
          {t('refresh_data')}
        </Button>
      </Box>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={resetView}
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <BusinessIcon sx={{ mr: 0.5, fontSize: 20 }} />
          {t('university_overview')}
        </Link>
        {selectedFaculty && (
          <Link
            component="button"
            variant="body1"
            onClick={() => {
              setSelectedDepartment(null);
              setDepartmentReports([]);
            }}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <SchoolIcon sx={{ mr: 0.5, fontSize: 20 }} />
            {selectedFaculty.fakulte_adi}
          </Link>
        )}
        {selectedDepartment && (
          <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
            <GroupIcon sx={{ mr: 0.5, fontSize: 20 }} />
            {selectedDepartment.bolum_adi}
          </Typography>
        )}
      </Breadcrumbs>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={fetchReports}>
              {t('refresh_data')}
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<BusinessIcon />}
            title={t('total_faculties')}
            value={universityStats.totalFaculties}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<SchoolIcon />}
            title={t('total_courses')}
            value={universityStats.totalCourses}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<GroupIcon />}
            title={t('total_students')}
            value={universityStats.totalStudents}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<TrendingUpIcon />}
            title={t('average_attendance')}
            value={`${universityStats.averageAttendance}%`}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      {!selectedFaculty && (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <BusinessIcon sx={{ mr: 1 }} />
              {t('faculties')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {faculties.length === 0 ? (
              <Alert severity="info">{t('no_reports_found')}</Alert>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('faculty_name')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('attendance_rate')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('details')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {faculties.map((faculty) => (
                    <TableRow key={faculty.fakulte_id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight={500}>
                          {faculty.fakulte_adi}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${Math.round(faculty.katilim_orani)}%`}
                          color={getAttendanceColor(faculty.katilim_orani)}
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleFacultyClick(faculty)}
                          startIcon={<BarChartIcon />}
                        >
                          {t('show_departments')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Faculty Departments */}
      {selectedFaculty && !selectedDepartment && (
        <Card elevation={3}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <SchoolIcon sx={{ mr: 1 }} />
                {selectedFaculty.fakulte_adi} - {t('department_reports')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={resetView}
                size="small"
              >
                Geri Dön
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {loadingFaculty ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : facultyReports.length === 0 ? (
              <Alert severity="info">{t('no_reports_found')}</Alert>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('department_name')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('attendance_rate')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('details')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {facultyReports.map((report) => (
                    <TableRow key={report.bolum_id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight={500}>
                          {report.bolum_adi}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${Math.round(report.katilim_orani)}%`}
                          color={getAttendanceColor(report.katilim_orani)}
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleDepartmentClick(report)}
                          startIcon={<BarChartIcon />}
                        >
                          {t('show_courses')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Department Courses */}
      {selectedDepartment && (
        <Card elevation={3}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <GroupIcon sx={{ mr: 1 }} />
                {selectedDepartment.bolum_adi} - {t('course_reports')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => {
                  setSelectedDepartment(null);
                  setDepartmentReports([]);
                }}
                size="small"
              >
                Geri Dön
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {loadingDepartment ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : departmentReports.length === 0 ? (
              <Alert severity="info">{t('no_reports_found')}</Alert>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('course_name')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('attendance_rate')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('total_sessions')}</strong></TableCell>
                    <TableCell align="center"><strong>{t('total_students')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departmentReports.map((course) => (
                    <TableRow key={course.ders_id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight={500}>
                          {course.ders_adi}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${Math.round(course.katilim_orani)}%`}
                          color={getAttendanceColor(course.katilim_orani)}
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {course.toplam_yoklama}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {course.toplam_ogrenci}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default ReportsPage;
