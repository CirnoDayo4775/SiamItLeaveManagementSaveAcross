import React from 'react';
import LineOASettings from '@/components/LineOASettings';

const LineOASettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">การตั้งค่า Line Official Account</h1>
          <p className="text-gray-600 mt-2">
            จัดการการเชื่อมต่อและการตั้งค่า Line OA สำหรับส่งการแจ้งเตือนอัตโนมัติ
          </p>
        </div>
        
        <LineOASettings />
      </div>
    </div>
  );
};

export default LineOASettingsPage; 