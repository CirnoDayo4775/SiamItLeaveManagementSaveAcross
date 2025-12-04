import LineOASettings from '@/components/LineOASettings';
import { useTranslation } from 'react-i18next';

const LineOASettingsPage = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('lineOA.settingsTitle', 'การตั้งค่า Line Official Account')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('lineOA.settingsDescription', 'จัดการการเชื่อมต่อและการตั้งค่า Line OA สำหรับส่งการแจ้งเตือนอัตโนมัติ')}
          </p>
        </div>

        <LineOASettings />
      </div>
    </div>
  );
};

export default LineOASettingsPage;
