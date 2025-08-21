import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Box,
    Typography,
    Divider,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    School as SchoolIcon,
    Assignment as AssignmentIcon,
    Assessment as AssessmentIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const menuItems = [
    {
        text: 'dashboard',
        icon: <DashboardIcon />,
        path: '/dashboard'
    },
    {
        text: 'users',
        icon: <PeopleIcon />,
        path: '/users'
    },
    {
        text: 'courses',
        icon: <SchoolIcon />,
        path: '/courses'
    },
    {
        text: 'attendance',
        icon: <AssignmentIcon />,
        path: '/attendance'
    },
    {
        text: 'reports',
        icon: <AssessmentIcon />,
        path: '/reports'
    },
    {
        text: 'settings',
        icon: <SettingsIcon />,
        path: '/settings'
    }
];

const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: 240,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: 240,
                    boxSizing: 'border-box',
                    backgroundColor: '#1a237e',
                    color: 'white',
                },
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ color: 'white' }}>
                    {t('appName')}
                </Typography>
            </Box>
            <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />
            <List>
                {menuItems.map((item) => (
                    <ListItem
                        button
                        key={item.text}
                        onClick={() => navigate(item.path)}
                        selected={location.pathname === item.path}
                        sx={{
                            '&.Mui-selected': {
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                                },
                            },
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            },
                        }}
                    >
                        <ListItemIcon sx={{ color: 'white' }}>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={t(item.text)} />
                    </ListItem>
                ))}
            </List>
        </Drawer>
    );
};

export default Sidebar; 