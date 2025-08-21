import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

const drawerWidth = 260;
const defaultLogo = '/logos/university_logo.png';

const menuItems = [
  { text: 'Ana Panel', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Kullanıcılar', icon: <PeopleIcon />, path: '/users' },
  { text: 'Dersler', icon: <SchoolIcon />, path: '/courses' },
  { text: 'Bölümler', icon: <SchoolIcon />, path: '/departments' },
  { text: 'Fakülteler', icon: <SchoolIcon />, path: '/faculties' },
  { text: 'Duyurular', icon: <AnnouncementIcon />, path: '/announcements' },
  { text: 'Raporlar', icon: <AssessmentIcon />, path: '/reports' },
  { text: 'Ayarlar', icon: <SettingsIcon />, path: '/settings' },
];

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const { kullanici, yukleniyor } = useAuth();

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = defaultLogo;
    target.onerror = null;
  };

  return (
    <Drawer
      variant="persistent"
      open={isOpen}
      onClose={toggleSidebar}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: '#4B2E83',
          color: '#fff',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/logos/university_logo.png"
            alt="Tokat Gaziosmanpaşa Üniversitesi"
            style={{ height: 40, marginRight: 12 }}
            onError={handleImageError}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
            TOGÜ
          </Typography>
        </Box>
        <IconButton onClick={toggleSidebar} sx={{ color: '#fff', display: { md: 'none' } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#6E4BA5', borderRadius: 2, p: 2, mb: 2 }}>
          {!yukleniyor && kullanici ? (
            <>
              <Avatar sx={{ bgcolor: '#00A3E0', width: 48, height: 48, fontWeight: 700 }}>
                {kullanici.ad?.charAt(0).toUpperCase() || 'A'}
              </Avatar>
              <Box sx={{ ml: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                  {kullanici.ad} {kullanici.soyad}
                </Typography>
                <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
                  {kullanici.rol === 'admin'
                    ? 'Yönetici'
                    : kullanici.rol === 'ogretmen'
                    ? 'Öğretim Görevlisi'
                    : 'Öğrenci'}
                </Typography>
              </Box>
            </>
          ) : (
            <Typography sx={{ color: '#ccc' }}>Yükleniyor...</Typography>
          )}
        </Box>

        <Divider sx={{ bgcolor: '#fff', opacity: 0.15, mb: 1 }} />

        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  color: '#fff',
                  '&.Mui-selected, &.Mui-selected:hover': {
                    bgcolor: '#3A2266',
                    color: '#fff',
                  },
                  '&:hover': {
                    bgcolor: '#6E4BA5',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#00A3E0', minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ p: 2, borderTop: '1px solid #6E4BA5' }}>
        {/* Geliştiren Ekibi Başlığı */}
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: '#fff', 
            textAlign: 'center', 
            mb: 2,
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Yapımcılar
        </Typography>

        {/* Geliştirici İsimleri */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ 
            color: '#fff', 
            fontWeight: 500, 
            fontSize: '11px',
            display: 'block',
            textAlign: 'center',
            mb: 0.5
          }}>
            Hamed Mohamed Abdelalim Kamel
          </Typography>
          
          <Typography variant="caption" sx={{ 
            color: '#fff', 
            fontWeight: 500, 
            fontSize: '11px',
            display: 'block',
            textAlign: 'center',
            mb: 0.5
          }}>
            Özgürcan YILDIZ
          </Typography>
          
          <Typography variant="caption" sx={{ 
            color: '#fff', 
            fontWeight: 500, 
            fontSize: '11px',
            display: 'block',
            textAlign: 'center',
            mb: 0.5
          }}>
            Miraç Utku Aygün
          </Typography>
        </Box>

        {/* Açıklama ve Version */}
        <Box sx={{ 
          textAlign: 'center', 
          pt: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Typography variant="caption" sx={{ 
            color: '#b8b8b8', 
            fontSize: '9px',
            lineHeight: 1.3,
            display: 'block',
            mb: 1
          }}>
            TOGU Bilgisayar Mühendisliği<br/>
            öğrencileri tarafından geliştirilmiştir
          </Typography>
          
          <Typography variant="caption" sx={{ 
            color: '#e0e0e0', 
            fontSize: '11px',
            fontWeight: 500
          }}>
            v1.0.0
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
