import { createBrowserRouter } from 'react-router-dom';

// Layouts
import MainLayout from '../components/layout/MainLayout';

// Pages
import LoginPage from '../pages/login/LoginPage';
import ForgotPasswordPage from '../pages/forgot/ForgotPasswordPage';
// --- 1. استورد الصفحة الجديدة هنا ---
import ResetPasswordPage from '../pages/forgot/ResetPasswordPage'; 

import DashboardPage from '../pages/dashboard/DashboardPage';
import UsersPage from '../pages/users/UsersPage';
import UserAddPage from '../pages/users/UserAddPage';
import UserEditPage from '../pages/users/UserEditPage';
import CoursesPage from '../pages/courses/CoursesPage';
import AddCoursePage from '../pages/courses/AddCoursePage';
import EditCoursePage from '../pages/courses/EditCoursePage';
import CourseAttendancePage from '../pages/courses/CourseAttendancePage';
import CourseStudentsPage from '../pages/courses/CourseStudentsPage';
import ReportsPage from '../pages/reports/ReportsPage';
import SettingsPage from '../pages/settings/SettingsPage';
import DepartmentAddPage from '../pages/users/DepartmentAddPage';
import DepartmentsPage from '../pages/users/DepartmentsPage';
import FacultiesPage from '../pages/users/FacultiesPage';
import FacultyAddPage from '../pages/users/FacultyAddPage';
import FacultyEditPage from '../pages/users/EditFacultyPage';
import DepartmentEditPage from '../pages/users/DepartmentEditPage';
import DepartmentDeletePage from '../pages/users/DepartmentDeletePage';
import AnnouncementsPage from '../pages/announcements/AnnouncementsPage';
import AddAnnouncementPage from '../pages/announcements/AddAnnouncementPage';

const router = createBrowserRouter([
  // ✅ صفحات عامة (بدون layout)
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    // لقد قمت بتغيير هذا المسار ليتطابق مع الكود الذي كتبته سابقًا
    path: '/sifremi-unuttum', 
    element: <ForgotPasswordPage />
  },
  // --- 2. أضف هذا المسار الجديد والمهم هنا ---
  {
    path: '/sifre-sifirla/:token',
    element: <ResetPasswordPage />
  },
  // -----------------------------------------

  // ✅ صفحات خاصة داخل MainLayout
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // تم تعديل هذا ليكون أكثر دقة
      { index: true, element: <DashboardPage /> }, 
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/users/add', element: <UserAddPage /> },
      { path: '/users/edit/:id', element: <UserEditPage /> },
      { path: '/courses', element: <CoursesPage /> },
      { path: '/courses/add', element: <AddCoursePage /> },
      { path: '/courses/edit/:id', element: <EditCoursePage /> },
      { path: '/courses/:id/attendance', element: <CourseAttendancePage /> },
      { path: '/courses/:id/students', element: <CourseStudentsPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/departments/add', element: <DepartmentAddPage /> },
      { path: '/departments/edit/:id', element: <DepartmentEditPage /> },
      { path: '/departments/delete/:id', element: <DepartmentDeletePage /> },
      { path: '/departments', element: <DepartmentsPage /> },
      { path: '/faculties', element: <FacultiesPage /> },
      { path: '/faculties/add', element: <FacultyAddPage /> },
      { path: '/faculties/edit/:id', element: <FacultyEditPage /> },
      { path: '/announcements', element: <AnnouncementsPage /> },
      { path: '/announcements/add', element: <AddAnnouncementPage /> }
    ]
  }
], {
  // basename: '/qr-admin' // Base path for subpath deployment
});

export default router;
