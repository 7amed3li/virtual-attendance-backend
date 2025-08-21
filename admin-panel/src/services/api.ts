import axios from 'axios';
import { notification } from 'antd';

// Create axios instance with base URL from environment variables
const api = axios.create({
  // Sabit base URL - development modunda proxy kullanıyoruz
  baseURL: '/qr/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Debug: baseURL'i kontrol et
console.log('🔧 API Base URL:', '/qr/api');
console.log('🔧 Environment Variables:', import.meta.env);

// Request interceptor for adding token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // هذا هو التعديل الوحيد: حذف Content-Type من طلبات GET و DELETE
    if (config.method === 'get' || config.method === 'delete') {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    console.error('İstek hatası:', error);
    return Promise.reject(error);
  }
);
// Response interceptor for handling token expiration
let isRedirecting = false; // Yönlendirme kontrolü için flag

// Token süresi dolduğunda kullanıcıya bildirim göster
const showTokenExpiredNotification = () => {
  // Bildirim göster
  notification.error({
    message: 'Oturum Süresi Bitti',
    description: 'Güvenlik nedeniyle oturumunuzun süresi doldu. Giriş sayfasına yönlendiriliyorsunuz...',
    duration: 3, // 3 saniye göster
    placement: 'topRight'
  });

  // localStorage temizle ve yönlendir
  setTimeout(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
  }, 2000); // 2 saniye sonra yönlendir
};

api.interceptors.response.use(
  (response) => {
    // Başarılı response'larda isRedirecting flag'ini resetle
    if (isRedirecting) {
      isRedirecting = false;
    }
    return response;
  },
  (error) => {
    if (error.response) {
    // Handle 401 Unauthorized errors (token expired)
      if (error.response.status === 401 && !isRedirecting) {
        isRedirecting = true; // Yönlendirme başladığını işaretle
        
        // Kullanıcıya bilgilendirici bildirim göster
        showTokenExpiredNotification();
        
        return Promise.reject(error);
      }
      // Handle 403 Forbidden errors
      else if (error.response.status === 403 && !isRedirecting) {
        if (!window.location.pathname.includes('/login')) {
          isRedirecting = true;
          showTokenExpiredNotification();
        }
        return Promise.reject(error);
      }
      // Handle other error responses
      console.error('API Hatası:', error.response.data);
    } else if (error.request) {
      // Handle network errors
      console.error('Ağ Hatası:', error.request);
    } else {
      // Handle other errors
      console.error('Hata:', error.message);
    }
    return Promise.reject(error);
  }
);

// Define types for API responses and requests
export interface User {
  id: string;
  universite_kodu: string;
  ad: string;
  soyad: string;
  eposta: string;
  rol: string;
  hesap_durumu: string;
  bolum_id?: string;
  fakulte_id?: string;
  sifre?: string;
}

export interface GirisIstegi {
  universite_kodu: string;
  sifre: string;
}

export interface GirisYaniti {
  mesaj: string;
  token: string;
}

export interface SifreDegistirmeIstegi {
  mevcut_sifre: string;
  yeni_sifre: string;
}

export interface ProfilGuncellemeIstegi {
  name?: string;
  email?: string;
  department?: string;
  faculty?: string;
}

export interface Bolum {
  id: string;
  name: string;
  fakulteId: string;
}

export interface BolumIstegi {
  name: string;
  fakulteId: string;
}

export interface Fakulte {
  id: number;
  ad: string;
  enlem?: number;
  boylam?: number;
}

export interface FakulteIstegi {
  ad: string;
  enlem?: number;
  boylam?: number;
}

export interface Ders {
  id: string;
  name: string;
  code: string;
  instructor: string;
  bolumId: string;
  fakulteId: string;
  studentCount?: number;
}

export interface DersIstegi {
  ad: string;
  kod: string;
  bolum_id: number;
  ogretmen_id: number;
  donem: string;
  akademik_yil: string;
  devamsizlik_limiti?: number;
  sinif?: string;
  sube?: string;
  fakulte_id?: number;
}

export interface OgrenciKayitIstegi {
  dersId: string;
  ogrenciId: string;
}

export interface Oturum {
  id: string;
  dersId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface OturumIstegi {
  dersId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface QRKodIstegi {
  sessionId: string;
  duration: number;
}

export interface QRKodYaniti {
  qrData: string;
  expiresAt: string;
}

export interface Yoklama {
  id: string;
  sessionId: string;
  ogrenciId: string;
  timestamp: string;
  status: string;
  notes?: string;
}

export interface YoklamaIstegi {
  sessionId: string;
  ogrenciId: string;
  status: string;
  notes?: string;
}

export interface YoklamaGuncellemeIstegi {
  status: string;
  notes?: string;
}

export interface UniversiteRaporu {
  totalCourses: number;
  totalStudents: number;
  totalSessions: number;
  averageAttendance: number;
}

export interface FakulteRaporu {
  fakulteId: string;
  fakulteName: string;
  totalCourses: number;
  totalStudents: number;
  averageAttendance: number;
  bolumStats: {
    bolumId: string;
    bolumName: string;
    attendanceRate: number;
  }[];
}

export interface DersYoklamaRaporu {
  ders_id: number;
  ders_adi: string;
  devamsizlik_limiti_yuzde: number;
  toplam_ders_oturumu: number;
  ogrenciler: {
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
  }[];
}

export interface Announcement {
  id: number;
  baslik: string;
  icerik: string;
  kategori?: string;
  aktif?: boolean;
  kullanici_id: number;
  ders_id?: number;
  olusturma_tarihi: string;
  goruldu_mu?: boolean;
  yazar?: {
    id: number;
    ad: string;
    soyad: string;
    rol: string;
    eposta?: string;
  };
  ders?: {
    id: number;
    ad: string;
  };
}

export interface AnnouncementRequest {
  baslik: string;
  icerik: string;
  kategori?: string;
  aktif?: boolean;
  ders_id?: number;
  genel_mi?: boolean;
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth services
export const authService = {
  giris: async (universite_kodu: string, sifre: string): Promise<{ token: string; kullanici: User }> => {
    try {
      const response = await api.post<GirisYaniti>('/giris', { universite_kodu, sifre });
      
      // Token'ı localStorage'a kaydet
      localStorage.setItem('auth_token', response.data.token);
      
      // Profil bilgilerini çekmeyi dene
      try {
        const kullaniciResponse = await api.get<User>('/users/me/profile');
        console.log('✅ Profil bilgileri başarıyla alındı:', kullaniciResponse.data);
        return {
          token: response.data.token,
          kullanici: kullaniciResponse.data
        };
      } catch (profileError) {
        console.warn('⚠️ Profil çekme hatası:', profileError);
        console.log('📝 Giriş yanıtından bilgiler kullanılıyor...');
        
        // Giriş yanıtından gelen bilgileri kullan
        const kullanici: User = {
          id: '1',
          universite_kodu: universite_kodu,
          ad: 'Kullanıcı',
          soyad: '',
          eposta: '',
          rol: 'admin',
          hesap_durumu: 'aktif'
        };

        return {
          token: response.data.token,
          kullanici: kullanici
        };
      }
    } catch (error) {
      throw error;
    }
  },

  cikis: async (): Promise<void> => {
    try {
      await api.post('/cikis');
    } catch (error) {
      console.error('Çıkış hatası:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
  },

  sifreDegistir: async (mevcut_sifre: string, yeni_sifre: string): Promise<{ mesaj: string }> => {
    const response = await api.put<{ mesaj: string }>('/users/me/change-password', {
      mevcut_sifre,
      yeni_sifre
    });
      return response.data;
  },

  profilGuncelle: async (profilBilgileri: Partial<User>): Promise<User> => {
    const response = await api.put<User>('/users/me/profile', profilBilgileri);
      return response.data;
  },


  /**
   * Sends a password reset request to the server.
   * @param eposta The user's email address.
   */
  forgotPassword: async (eposta: string): Promise<{ mesaj: string }> => {
    try {
      // This is the correct endpoint we built on the server
      const response = await api.post('/auth/request-password-reset', { eposta });
      return response.data;
    } catch (error: any) {
      // Return a clear error message from the server if it exists
      throw error.response?.data || new Error('Şifre sıfırlama talebi gönderilemedi.');
    }
  },

  /**
   * Resets the user's password using the provided token.
   * @param token The password reset token from the URL.
   * @param yeni_sifre The new password.
   */
  resetPassword: async (token: string, yeni_sifre: string): Promise<{ mesaj: string }> => {
    try {
      // This is the correct endpoint that accepts the token in the URL
      const response = await api.post(`/auth/reset-password/${token}`, { yeni_sifre });
      return response.data;
    } catch (error: any) {
      // Return a clear error message from the server if it exists
      throw error.response?.data || new Error('Şifre güncellenemedi.');
    }
  },
};

// User services
export const userService = {
  addUser: async (userData: Partial<User>): Promise<User> => {
      const response = await api.post<User>('/kullanici/ekle', userData);
      return response.data;
  },

  getAllUsers: async (): Promise<{data: User[]}> => {
    const response = await api.get<{data: User[]}>('/kullanici');
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/kullanici/${id}`);
      return response.data;
  },

  updateUser: async (id: string, userData: Partial<User>): Promise<User> => {
      const response = await api.put<User>(`/kullanici/${id}`, userData);
      return response.data;
  },

  deleteUser: async (id: string): Promise<{ success: boolean; message: string }> => {
      const response = await api.delete<{ success: boolean; message: string }>(`/kullanici/${id}`);
      return response.data;
  },

  // Toplu kullanıcı silme
  bulkDeleteUsers: async (userIds: string[]): Promise<{ success: boolean; message: string; deletedCount: number }> => {
    const response = await api.post<{ success: boolean; message: string; deletedCount: number }>('/kullanici/bulk-delete', {
      userIds: userIds
    });
    return response.data;
  }
};

// Department services
export const departmentService = {
  getAllDepartments: async (): Promise<any[]> => {
    try {
      const response = await api.get('/bolum');
      return Array.isArray(response.data) ? response.data : response.data.data;
    } catch (error: any) {
      throw error.response?.data?.mesaj || error.response?.data?.hatalar || error.message;
    }
  },

  addDepartment: async (departmentData: { ad: string; fakulte_id: number }): Promise<any> => {
    try {
      const response = await api.post('/bolum/ekle', departmentData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.mesaj || error.response?.data?.hatalar || error.message;
    }
  },

  getDepartmentById: async (id: string): Promise<any> => {
    try {
      const response = await api.get(`/bolum/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateDepartment: async (id: number, departmentData: { ad: string }): Promise<any> => {
    try {
      const response = await api.put(`/bolum/${id}`, departmentData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.mesaj || error.response?.data?.hatalar || error.message;
    }
  },

  deleteDepartment: async (id: number): Promise<void> => {
    try {
      await api.delete(`/bolum/${id}`);
    } catch (error: any) {
      throw error.response?.data?.mesaj || error.message;
    }
  }
};

// Faculty services
export const facultyService = {
  getAllFaculties: async (): Promise<any[]> => {
    try {
      const response = await api.get('/fakulte');
      return Array.isArray(response.data) ? response.data : response.data.data;
    } catch (error) {
      throw error;
    }
  },

  addFaculty: async (facultyData: FakulteIstegi): Promise<Fakulte> => {
    try {
      const response = await api.post<Fakulte>('/fakulte/ekle', facultyData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getFacultyById: async (id: string): Promise<Fakulte> => {
    try {
      const response = await api.get<Fakulte>(`/fakulte/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateFaculty: async (id: string, facultyData: FakulteIstegi): Promise<Fakulte> => {
    try {
      const response = await api.put<Fakulte>(`/fakulte/${id}`, facultyData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteFaculty: async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete<{ success: boolean; message: string }>(`/fakulte/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Course services
export const courseService = {
  getAllCourses: async (): Promise<Ders[]> => {
    try {
      const response = await api.get<Ders[]>('/ders');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  addCourse: async (courseData: DersIstegi): Promise<Ders> => {
    try {
      const response = await api.post<Ders>('/ders/ekle', courseData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateCourse: async (id: string, courseData: Partial<DersIstegi>): Promise<Ders> => {
    try {
      const response = await api.put<Ders>(`/ders/${id}`, courseData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteCourse: async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete<{ success: boolean; message: string }>(`/ders/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  enrollStudent: async (dersId: string, ogrenciId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>('/ders/kayit', { dersId, ogrenciId });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getCourseById: async (id: string): Promise<any> => {
    try {
      const response = await api.get(`/ders/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  importStudents: async (dersId: string, file: File): Promise<{ mesaj: string; total_rows_in_excel: number; successfully_registered: number; already_registered_in_course: number; errors: any[] }> => {
    try {
      const formData = new FormData();
      formData.append('excelFile', file);

      const response = await api.post<{ mesaj: string; total_rows_in_excel: number; successfully_registered: number; already_registered_in_course: number; errors: any[] }>(`/ders/${dersId}/import-students`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getCourseAttendanceReport: async (dersId: string): Promise<DersYoklamaRaporu> => {
    if (!dersId || isNaN(Number(dersId))) {
      throw new Error('Invalid dersId');
    }
    try {
      const response = await api.get<DersYoklamaRaporu>(`/ders/${dersId}/yoklama-raporu`);
      if (!response.data?.ogrenciler?.length) {
        console.warn('No students found in attendance report');
      }
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch attendance report: ${error.message}`);
    }
  },

  // Öğrenci yönetimi fonksiyonları
  getCourseStudents: async (dersId: string): Promise<{data: any[]}> => {
    try {
      const response = await api.get<{data: any[]}>(`/ders/${dersId}/ogrenciler`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  addStudentToCourse: async (dersId: string, studentData: { universite_kodu: string; alinma_tipi: string }): Promise<any> => {
    try {
      const response = await api.post<any>('/ders/kayit', {
        ders_id: parseInt(dersId),
        universite_kodu: studentData.universite_kodu,
        alinma_tipi: studentData.alinma_tipi
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  removeStudentFromCourse: async (dersId: string, studentId: number): Promise<any> => {
    try {
      const requestData = {
        ders_id: parseInt(dersId),
        ogrenci_id: studentId
      };
      console.log('🔧 Silme isteği:', requestData);
      console.log('🔧 Veri tipleri:', { 
        ders_id_type: typeof requestData.ders_id, 
        ogrenci_id_type: typeof requestData.ogrenci_id 
      });
      
      const response = await api.delete<any>('/ders/kayit-sil', {
        data: requestData
      });
      console.log('✅ Silme başarılı:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Silme hatası:', error);
      console.error('❌ Hata detayı:', error.response?.data);
      console.error('❌ Hata array:', error.response?.data?.hatalar);
      throw error;
    }
  }
};

// Session services
export const sessionService = {
  addSession: async (sessionData: OturumIstegi): Promise<Oturum> => {
    try {
      const response = await api.post<Oturum>('/oturum/ekle', sessionData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getCourseSessions: async (dersId: string): Promise<Oturum[]> => {
    try {
      const response = await api.get<Oturum[]>(`/oturum/ders/${dersId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getSessionAttendance: async (oturumId: string): Promise<Yoklama[]> => {
    try {
      const response = await api.get<Yoklama[]>(`/oturum/${oturumId}/yoklama`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// QR Code services
export const qrCodeService = {
  generateQRCode: async (sessionData: QRKodIstegi): Promise<QRKodYaniti> => {
    try {
      const response = await api.post<QRKodYaniti>('/qr/generate', sessionData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Attendance services
export const attendanceService = {
  addAttendance: async (attendanceData: YoklamaIstegi): Promise<Yoklama> => {
    try {
      const response = await api.post<Yoklama>('/yoklama/ekle', attendanceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateAttendance: async (yoklamaId: string, attendanceData: YoklamaGuncellemeIstegi): Promise<Yoklama> => {
    try {
      const response = await api.put<Yoklama>(`/yoklama/${yoklamaId}`, attendanceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getStudentAttendance: async (ogrenciId: string): Promise<Yoklama[]> => {
    try {
      const response = await api.get<Yoklama[]>(`/yoklama/${ogrenciId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Report services
export const reportService = {
  getUniversityReport: (startDate?: string, endDate?: string, additionalParams?: URLSearchParams) => {
    let url = '/reports/university'; // /api/ prefix'ini kaldır
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    // Ek parametreleri birleştir
    if (additionalParams) {
      additionalParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return api.get(url).then(response => response.data);
  },
  
  getFacultyReport: (facultyId: number, startDate?: string, endDate?: string) => {
    let url = `/reports/faculty/${facultyId}`; // /api/ prefix'ini kaldır
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return api.get(url).then(response => response.data);
  },
  
  getDepartmentReport: (departmentId: number, startDate?: string, endDate?: string) => {
    let url = `/reports/department/${departmentId}`; // /api/ prefix'ini kaldır
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return api.get(url).then(response => response.data);
  },
  
  getDashboardStats: (startDate?: string, endDate?: string, additionalParams?: URLSearchParams) => {
    let url = '/reports/dashboard'; // Doğru endpoint: reports
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    // Ek parametreleri birleştir
    if (additionalParams) {
      additionalParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return api.get(url).then(response => response.data);
  },
};

export const getUniversityReport = async (params: URLSearchParams) => {
    try {
        const response = await api.get('/reports/university', { params });
        return response.data;
    } catch (error) {
        console.error('API Hatası:', error);
        throw error;
    }
};

export const getFacultyReport = async (facultyId: number, params: URLSearchParams) => {
    try {
        const response = await api.get(`/reports/faculty/${facultyId}`, { params });
        return response.data;
    } catch (error) {
        console.error('API Hatası:', error);
        throw error;
    }
};

export const getDashboardStats = async () => {
    try {
        const response = await api.get('/reports/dashboard');
        return response.data;
    } catch (error) {
        console.error('Dashboard API Hatası:', error);
        throw error;
    }
};

// Dashboard için yeni API fonksiyonları
export const dashboardService = {
  // Son aktiviteleri çek (oturumlar + yoklamalar)
  getRecentActivities: async () => {
    try {
      const response = await api.get('/reports/recent-activities?limit=10');
      return response.data;
    } catch (error) {
      console.error('Recent activities hatası:', error);
      throw error;
    }
  },

  // Düşük katılımlı dersleri çek
  getLowAttendanceCourses: async () => {
    try {
      const response = await api.get('/reports/low-attendance-courses?limit=5&threshold=50');
      return response.data;
    } catch (error) {
      console.error('Low attendance courses hatası:', error);
      throw error;
    }
  },

  // En performanslı dersleri çek
  getTopPerformingCourses: async () => {
    try {
      const response = await api.get('/reports/top-performing-courses?limit=5&threshold=75');
      return response.data;
    } catch (error) {
      console.error('Top courses hatası:', error);
      throw error;
    }
  },

  // Son oturumları çek
  getRecentSessions: async (dersId?: number) => {
    try {
      if (dersId) {
        const response = await api.get(`/oturum/ders/${dersId}`);
        return response.data;
      }
      // Tüm dersler için recent activities'den al
      const response = await api.get('/reports/recent-activities?limit=10');
      return response.data?.sessions || [];
    } catch (error) {
      console.error('Recent sessions hatası:', error);
      throw error;
    }
  },

  // Bugünün derslerini çek (dashboard için)
  // في ملف api.ts
// ...
// تعديل الدالة لتقبل المتغيرات
// في ملف api.ts
getCurrentDayCourses: async () => {
  try {
    // أضفنا { data: null } لضمان عدم إرسال أي body مع الطلب
    const response = await api.get('/ders/current-day', { data: null }); 
    return response.data;
  } catch (error) {
    throw error;
  }
},

};

// Announcement services
export const announcementService = {
  // Tüm duyuruları getir (sayfalama ve filtreleme ile)
  getAllAnnouncements: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    yazar?: string;
  }): Promise<AnnouncementListResponse> => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.yazar) queryParams.append('yazar', params.yazar);

      const url = `/bildirimler/admin${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get<AnnouncementListResponse>(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Kullanıcının kendi duyurularını getir
  getMyAnnouncements: async (): Promise<Announcement[]> => {
    try {
      const response = await api.get<Announcement[]>('/bildirimler/me');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Yeni duyuru ekle (genel duyuru)
  addAnnouncement: async (announcementData: AnnouncementRequest): Promise<Announcement> => {
    try {
      const response = await api.post<Announcement>('/bildirimler', announcementData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Ders bazlı duyuru ekle (öğretmenler için)
  addCourseAnnouncement: async (announcementData: AnnouncementRequest & { ders_id: number }): Promise<Announcement> => {
    try {
      const response = await api.post<Announcement>('/ogretmen-bildirim', announcementData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Belirli bir duyuruyu getir
  getAnnouncementById: async (id: number): Promise<Announcement> => {
    try {
      const response = await api.get<Announcement>(`/bildirimler/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Duyuruyu okundu olarak işaretle
  markAsRead: async (id: number): Promise<{ mesaj: string }> => {
    try {
      const response = await api.put<{ mesaj: string }>(`/bildirimler/${id}/goruldu`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Duyuru sil (sadece kendi duyurularını)
  deleteAnnouncement: async (id: number): Promise<{ mesaj: string }> => {
    try {
      const response = await api.delete<{ mesaj: string }>(`/bildirim/sil/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Ders bazlı duyuruları getir (öğrenciler için)
  getCourseAnnouncements: async (): Promise<Announcement[]> => {
    try {
      const response = await api.get<Announcement[]>('/bildirimler/derslerim');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default api;