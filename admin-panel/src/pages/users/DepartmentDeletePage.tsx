import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { departmentService } from '../../services/api';
import { useTranslation } from 'react-i18next';

const DepartmentDeletePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const deleteDepartment = async () => {
      if (!id) return;

      const confirm = window.confirm(t('confirm_delete') || 'Silmek istediğinize emin misiniz?');
      if (!confirm) {
        navigate('/departments');
        return;
      }

      try {
        await departmentService.deleteDepartment(Number(id));
        navigate('/departments');
      } catch (error) {
        console.error('Silme hatası:', error);
        alert(t('error_deleting_department') || 'Bölüm silinirken hata oluştu.');
        navigate('/departments');
      }
    };

    deleteDepartment();
  }, [id, navigate, t]);

  return <div className="p-8 text-gray-600">{t('loading')}...</div>;
};

export default DepartmentDeletePage;
