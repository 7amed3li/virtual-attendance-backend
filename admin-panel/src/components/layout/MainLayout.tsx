import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Box from '@mui/material/Box';

const drawerWidth = 260;

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar ثابت على اليسار */}
      <Box
        sx={{
          width: sidebarOpen ? `${drawerWidth}px` : 0,
          flexShrink: 0,
          transition: 'width 0.3s ease',
        }}
      >
        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: `calc(100% - ${sidebarOpen ? drawerWidth : 0}px)`,
          transition: 'width 0.3s ease',
          backgroundColor: '#f5f7fa',
        }}
      >
        <Header toggleSidebar={toggleSidebar} />
        <Box component="main" className="page-container" sx={{ flexGrow: 1, mt: 2 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
