import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Snackbar,
  Grid,
  Divider,
  Avatar,
  FormControlLabel,
  Switch,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Announcement as AnnouncementIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { announcementService } from '../../services/api';

interface AnnouncementForm {
  baslik: string;
  icerik: string;
  genel_mi: boolean;
}

const AddAnnouncementPage: React.FC = () => {
  const navigate = useNavigate();
  const { kullanici } = useAuth();
  
  const [formData, setFormData] = useState<AnnouncementForm>({
    baslik: '',
    icerik: '',
    genel_mi: true
  });
  
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');



  const handleInputChange = (field: keyof Omit<AnnouncementForm, 'genel_mi'>) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const validateForm = () => {
    if (!formData.baslik.trim()) {
      setErrorMessage('Duyuru başlığı gereklidir.');
      return false;
    }
    if (!formData.icerik.trim()) {
      setErrorMessage('Duyuru içeriği gereklidir.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await announcementService.addAnnouncement({
        baslik: formData.baslik,
        icerik: formData.icerik,
        genel_mi: formData.genel_mi
      });
      
      setSuccessMessage('Duyuru başarıyla eklendi!');
      
      // 2 saniye sonra listeye yönlendir
      setTimeout(() => {
        navigate('/announcements');
      }, 2000);
      
    } catch (error: any) {
      console.error('Duyuru ekleme hatası:', error);
      setErrorMessage(
        error.response?.data?.mesaj || 
        error.response?.data?.hatalar?.[0]?.msg || 
        'Duyuru eklenirken bir hata oluştu.'
      );
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          component={Link}
          to="/announcements"
          startIcon={<ArrowBackIcon />}
          sx={{ mr: 2 }}
        >
          Geri
        </Button>
        <AnnouncementIcon sx={{ mr: 2, color: '#4B2E83', fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#4B2E83' }}>
          Yeni Duyuru Ekle
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Form Alanı */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Duyuru Bilgileri
              </Typography>

              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Duyuru Başlığı"
                  value={formData.baslik}
                  onChange={handleInputChange('baslik')}
                  placeholder="Duyuru başlığını girin..."
                  required
                  error={!formData.baslik.trim() && formData.baslik !== ''}
                  helperText={!formData.baslik.trim() && formData.baslik !== '' ? 'Başlık gereklidir' : ''}
                />
              </Box>



              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Duyuru İçeriği"
                  multiline
                  rows={8}
                  value={formData.icerik}
                  onChange={handleInputChange('icerik')}
                  placeholder="Duyuru içeriğini detaylı olarak yazın..."
                  required
                  error={!formData.icerik.trim() && formData.icerik !== ''}
                  helperText={!formData.icerik.trim() && formData.icerik !== '' ? 'İçerik gereklidir' : ''}
                />
              </Box>

              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Duyuru Türü
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.genel_mi}
                      onChange={(e) => setFormData(prev => ({ ...prev, genel_mi: e.target.checked }))}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>Genel Duyuru</Typography>
                      <Chip 
                        size="small"
                        label={formData.genel_mi ? "Tüm öğrenciler görecek" : "Sadece belirli ders"}
                        color={formData.genel_mi ? "primary" : "default"}
                      />
                    </Box>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formData.genel_mi 
                    ? "Bu duyuru tüm öğrenciler tarafından görülecektir." 
                    : "Bu duyuru sadece belirli bir derse kayıtlı öğrenciler tarafından görülecektir."
                  }
                </Typography>
              </Box>



              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<PreviewIcon />}
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? 'Önizlemeyi Gizle' : 'Önizleme'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSubmit}
                  disabled={loading}
                  sx={{
                    bgcolor: '#4B2E83',
                    '&:hover': { bgcolor: '#3A2266' }
                  }}
                >
                  {loading ? 'Kaydediliyor...' : 'Duyuru Kaydet'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Önizleme ve Yazar Bilgisi */}
        <Grid item xs={12} md={4}>
          {/* Yazar Bilgisi */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Yazar Bilgisi
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ width: 48, height: 48, mr: 2, bgcolor: '#4B2E83' }}>
                  {kullanici?.ad?.charAt(0) || 'A'}
                </Avatar>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {kullanici?.ad} {kullanici?.soyad}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getRoleText(kullanici?.rol || '')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Önizleme */}
          {showPreview && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Önizleme
                </Typography>
                
                {formData.baslik || formData.icerik ? (
                  <Box>
                    {formData.baslik && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {formData.baslik}
                        </Typography>
                      </Box>
                    )}
                    
                    {formData.icerik && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {formData.icerik}
                      </Typography>
                    )}

                    <Box sx={{ mb: 2 }}>
                      <Chip 
                        size="small"
                        label={formData.genel_mi ? "Genel Duyuru" : "Ders Duyurusu"}
                        color={formData.genel_mi ? "primary" : "default"}
                        icon={formData.genel_mi ? <AnnouncementIcon /> : <AnnouncementIcon />}
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: '#4B2E83' }}>
                        {kullanici?.ad?.charAt(0) || 'A'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {kullanici?.ad} {kullanici?.soyad}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getRoleText(kullanici?.rol || '')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Önizleme için form alanlarını doldurun
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Snackbar Mesajları */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
      >
        <Alert onClose={() => setErrorMessage('')} severity="error">
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AddAnnouncementPage;