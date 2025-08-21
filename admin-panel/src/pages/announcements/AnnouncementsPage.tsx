import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  InputAdornment,
  Chip,
  Avatar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  Fade,
  Skeleton,
  Pagination
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Announcement as AnnouncementIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { announcementService, type Announcement } from '../../services/api';



const AnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const announcementsPerPage = 10;

  useEffect(() => {
    fetchAnnouncements();
  }, [page, searchTerm, selectedAuthor]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await announcementService.getAllAnnouncements({
        page: page,
        limit: announcementsPerPage,
        search: searchTerm || undefined,
        yazar: selectedAuthor || undefined
      });

      setAnnouncements(response.announcements || []);
      setTotalPages(response.totalPages || 1);
    } catch (error: any) {
      console.error('Duyurular yüklenirken hata:', error);
      // Eğer 401 hatası değilse, boş liste göster
      if (error.response?.status !== 401) {
        setAnnouncements([]);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };



  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Yönetici';
      case 'ogretmen': return 'Öğretim Görevlisi';
      default: return role;
    }
  };

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
  };

  const handleCloseDialog = () => {
    setSelectedAnnouncement(null);
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Tarih bilinmiyor';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Geçersiz tarih';
      return format(date, 'dd MMMM yyyy, HH:mm', { locale: tr });
    } catch (error) {
      return 'Tarih bilinmiyor';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AnnouncementIcon sx={{ mr: 2, color: '#4B2E83', fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#4B2E83' }}>
            Duyurular
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/announcements/add"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            bgcolor: '#4B2E83',
            '&:hover': { bgcolor: '#3A2266' }
          }}
        >
          Yeni Duyuru
        </Button>
      </Box>

      {/* Filtreleme Alanı */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={7}>
              <TextField
                fullWidth
                placeholder="Duyuru başlığı veya içeriği ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                placeholder="Yazar ara..."
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

          </Grid>
        </CardContent>
      </Card>

      {/* Duyuru Listesi */}
      {loading ? (
        <Grid container spacing={2}>
          {[...Array(6)].map((_, index) => (
            <Grid item xs={12} key={index}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="80%" height={20} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    <Skeleton variant="text" width="30%" height={20} />
                    <Skeleton variant="text" width="20%" height={20} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : announcements.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Arama kriterlerinize uygun duyuru bulunamadı.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {announcements.map((announcement) => (
            <Grid item xs={12} key={announcement.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => handleAnnouncementClick(announcement)}
              >
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {announcement.baslik}
                    </Typography>
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {announcement.icerik}
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: '#4B2E83' }}>
                      {announcement.yazar?.ad?.charAt(0) || 'A'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {announcement.yazar?.ad} {announcement.yazar?.soyad}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getRoleText(announcement.yazar?.rol || '')}
                      </Typography>
                    </Box>
                  </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                      <CalendarIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      <Typography variant="caption">
                        {formatDate(announcement.olusturma_tarihi)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Detay Dialog */}
      <Dialog
        open={!!selectedAnnouncement}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedAnnouncement && (
          <>
            <DialogTitle>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {selectedAnnouncement.baslik}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
                {selectedAnnouncement.icerik}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: '#4B2E83' }}>
                    {selectedAnnouncement.yazar?.ad?.charAt(0) || 'A'}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedAnnouncement.yazar?.ad} {selectedAnnouncement.yazar?.soyad}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {getRoleText(selectedAnnouncement.yazar?.rol || '')}
                    </Typography>
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  {formatDate(selectedAnnouncement.olusturma_tarihi)}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>
                Kapat
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AnnouncementsPage;