import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, FileText, Bell, Settings } from 'lucide-react';

interface LineRichMenuProps {
  className?: string;
}

const LineRichMenu: React.FC<LineRichMenuProps> = ({ className }) => {
  const menuItems = [
    {
      id: 'leave-request',
      title: 'ขอลาพัก',
      description: 'ส่งคำขอลาพักใหม่',
      icon: Calendar,
      url: '/leave-request',
      color: 'bg-blue-500'
    },
    {
      id: 'leave-history',
      title: 'ประวัติการลา',
      description: 'ดูประวัติการลาทั้งหมด',
      icon: Clock,
      url: '/leave-history',
      color: 'bg-green-500'
    },
    {
      id: 'profile',
      title: 'โปรไฟล์',
      description: 'จัดการข้อมูลส่วนตัว',
      icon: User,
      url: '/profile',
      color: 'bg-purple-500'
    },
    {
      id: 'announcements',
      title: 'ประกาศ',
      description: 'ดูประกาศล่าสุด',
      icon: FileText,
      url: '/announcements',
      color: 'bg-orange-500'
    },
    {
      id: 'notifications',
      title: 'การแจ้งเตือน',
      description: 'จัดการการแจ้งเตือน',
      icon: Bell,
      url: '/notifications',
      color: 'bg-red-500'
    },
    {
      id: 'settings',
      title: 'ตั้งค่า',
      description: 'การตั้งค่าระบบ',
      icon: Settings,
      url: '/settings',
      color: 'bg-gray-500'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {menuItems.map((item) => {
        const IconComponent = item.icon;
        return (
          <Card key={item.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.color} text-white`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(item.url, '_blank')}
              >
                เข้าถึง
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default LineRichMenu; 