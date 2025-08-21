import React, { useEffect, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

interface Bildirim {
  id: number;
  kullanici_id: number;
  mesaj: string;
  okundu: boolean;
  olusturma_tarihi: string;
}

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { kullanici } = useAuth();
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (!kullanici) return;
    axios.get(`/api/bildirimler/${kullanici.id}`)
      .then(res => {
        // API'den gelen verinin array olduğundan emin ol
        if (Array.isArray(res.data)) {
          setBildirimler(res.data);
        } else {
          console.warn("Bildirimler API'den array döndürmedi:", res.data);
          setBildirimler([]);
        }
      })
      .catch(err => {
        console.error("Bildirim API hatası:", err);
        setBildirimler([]);
      });
  }, [kullanici]);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const unreadCount = Array.isArray(bildirimler) ? bildirimler.filter(b => !b.okundu).length : 0;
  const open = Boolean(anchorEl);

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#4B2E83', color: '#fff', zIndex: 1201 }}>
      <Toolbar sx={{ minHeight: 64, display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton edge="start" color="inherit" onClick={toggleSidebar} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: 1 }}>
            QR Kod Tabanlı Yoklama Sistemi
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton color="inherit" sx={{ mr: 2 }} onClick={handleNotificationClick}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <List sx={{ width: 300 }}>
              {!Array.isArray(bildirimler) || bildirimler.length === 0 ? (
                <ListItem>
                  <ListItemText primary="Henüz bildirim yok" />
                </ListItem>
              ) : (
                bildirimler.slice(0, 5).map((b) => (
                  <React.Fragment key={b.id}>
                    <ListItem dense>
                      <ListItemText
                        primary={b.mesaj}
                        secondary={new Date(b.olusturma_tarihi).toLocaleString()}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </Popover>

          <Box sx={{ textAlign: 'right', mr: 2, display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
              {kullanici?.ad ? `${kullanici.ad} ${kullanici.soyad}` : 'Yönetici'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
              {kullanici?.rol === 'admin'
                ? 'Yönetici'
                : kullanici?.rol === 'ogretmen'
                ? 'Öğretim Görevlisi'
                : 'Öğrenci'}
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: '#00A3E0', width: 40, height: 40, fontWeight: 700 }}>
            {kullanici?.ad ? kullanici.ad.charAt(0).toUpperCase() : 'A'}
          </Avatar>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
