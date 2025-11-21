import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, MessageSquare, Settings, TestTube, Grid3X3, Menu } from 'lucide-react';
import axios from 'axios';

interface LineOASettingsProps {
  className?: string;
}

const LineOASettings: React.FC<LineOASettingsProps> = ({ className }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [baseUrl, setBaseUrl] = useState('');
  const [richMenuList, setRichMenuList] = useState([]);
  const { toast } = useToast();

  // ตรวจสอบการเชื่อมต่อ Line OA
  const checkConnection = async () => {
    setIsLoading(true);
    setConnectionStatus('checking');
    
    try {
      const response = await axios.get('http://localhost:3001/api/line/check-connection');
      
      if (response.data.success) {
        setIsConnected(true);
        setConnectionStatus('connected');
        toast({
          title: 'เชื่อมต่อสำเร็จ',
          description: 'Line OA เชื่อมต่อเรียบร้อยแล้ว',
        });
      } else {
        setIsConnected(false);
        setConnectionStatus('error');
        toast({
          title: 'เชื่อมต่อไม่สำเร็จ',
          description: 'ไม่สามารถเชื่อมต่อ Line OA ได้',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setIsConnected(false);
      setConnectionStatus('error');
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถตรวจสอบการเชื่อมต่อได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ส่งข้อความทดสอบ
  const sendTestMessage = async () => {
    if (!testUserId || !testMessage) {
      toast({
        title: 'ข้อมูลไม่ครบ',
        description: 'กรุณากรอก User ID และข้อความ',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await axios.post('http://localhost:3001/api/line/send-message', {
        userId: testUserId,
        message: testMessage
      });
      
      if (response.data.success) {
        toast({
          title: 'ส่งข้อความสำเร็จ',
          description: 'ข้อความถูกส่งไปยัง Line OA แล้ว',
        });
        setTestMessage('');
      } else {
        toast({
          title: 'ส่งข้อความไม่สำเร็จ',
          description: response.data.error || 'เกิดข้อผิดพลาดในการส่งข้อความ',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถส่งข้อความได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ส่งข้อความแจ้งเตือนการอนุมัติ Leave Request
  const sendLeaveApprovalTest = async () => {
    if (!testUserId) {
      toast({
        title: 'ข้อมูลไม่ครบ',
        description: 'กรุณากรอก User ID',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const testLeaveData = {
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'ลาป่วย',
        reason: 'ป่วยไข้ไม่สบาย'
      };

      const response = await axios.post('http://localhost:3001/api/line/send-leave-approval', {
        userId: testUserId,
        leaveData: testLeaveData
      });
      
      if (response.data.success) {
        toast({
          title: 'ส่งการแจ้งเตือนสำเร็จ',
          description: 'ข้อความแจ้งเตือนการอนุมัติถูกส่งแล้ว',
        });
      } else {
        toast({
          title: 'ส่งการแจ้งเตือนไม่สำเร็จ',
          description: response.data.error || 'เกิดข้อผิดพลาดในการส่งข้อความ',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถส่งข้อความแจ้งเตือนได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
    // ตั้งค่า Base URL อัตโนมัติ
    setBaseUrl(window.location.origin);
  }, []);

  // สร้าง Rich Menu
  const createRichMenu = async (type = 'grid') => {
    if (!baseUrl) {
      toast({
        title: 'ข้อมูลไม่ครบ',
        description: 'กรุณากรอก Base URL',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const endpoint = type === 'simple' ? '/api/line/rich-menu/simple' : '/api/line/rich-menu/create';
      const response = await axios.post(`http://localhost:3001${endpoint}`, {
        baseUrl
      });
      
      if (response.data.success) {
        toast({
          title: 'สร้าง Rich Menu สำเร็จ',
          description: `Rich Menu ID: ${response.data.richMenuId}`,
        });
        loadRichMenuList();
      } else {
        toast({
          title: 'สร้าง Rich Menu ไม่สำเร็จ',
          description: response.data.error || 'เกิดข้อผิดพลาดในการสร้าง Rich Menu',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถสร้าง Rich Menu ได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // โหลดรายการ Rich Menu
  const loadRichMenuList = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/line/rich-menu/list');
      if (response.data.success) {
        setRichMenuList(response.data.richMenuList);
      }
    } catch (error) {
      console.error('Error loading rich menu list:', error);
    }
  };

  // ตั้งค่า Rich Menu เป็น default
  const setDefaultRichMenu = async (richMenuId) => {
    try {
      const response = await axios.post(`http://localhost:3001/api/line/rich-menu/set-default/${richMenuId}`);
      if (response.data.success) {
        toast({
          title: 'ตั้งค่า Rich Menu สำเร็จ',
          description: 'Rich Menu ถูกตั้งเป็น default แล้ว',
        });
      } else {
        toast({
          title: 'ตั้งค่า Rich Menu ไม่สำเร็จ',
          description: response.data.error || 'เกิดข้อผิดพลาดในการตั้งค่า',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถตั้งค่า Rich Menu ได้',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadRichMenuList();
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            การตั้งค่า Line Official Account
          </CardTitle>
          <CardDescription>
            จัดการการเชื่อมต่อและการตั้งค่า Line OA สำหรับส่งการแจ้งเตือน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* สถานะการเชื่อมต่อ */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="connection-status">สถานะการเชื่อมต่อ</Label>
              {connectionStatus === 'checking' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              {connectionStatus === 'connected' && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {connectionStatus === 'error' && (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}
            </Badge>
          </div>

          <Button 
            onClick={checkConnection} 
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <TestTube className="h-4 w-4 mr-2" />
            ตรวจสอบการเชื่อมต่อ
          </Button>

          {!isConnected && (
            <Alert>
              <AlertDescription>
                Line OA ยังไม่ได้เชื่อมต่อ กรุณาตรวจสอบการตั้งค่า Channel Access Token และ Channel Secret
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* การทดสอบส่งข้อความ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            ทดสอบการส่งข้อความ
          </CardTitle>
          <CardDescription>
            ทดสอบการส่งข้อความไปยัง Line OA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-user-id">Line User ID</Label>
            <Input
              id="test-user-id"
              placeholder="ใส่ Line User ID ที่ต้องการส่งข้อความ"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-message">ข้อความทดสอบ</Label>
            <Textarea
              id="test-message"
              placeholder="ใส่ข้อความที่ต้องการส่ง"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={sendTestMessage} 
              disabled={isLoading || !isConnected}
              className="flex-1"
            >
              ส่งข้อความทดสอบ
            </Button>
            <Button 
              onClick={sendLeaveApprovalTest} 
              disabled={isLoading || !isConnected}
              variant="outline"
              className="flex-1"
            >
              ทดสอบการแจ้งเตือนอนุมัติ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rich Menu Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            จัดการ Rich Menu
          </CardTitle>
          <CardDescription>
            สร้างและจัดการ Rich Menu สำหรับ Line OA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              placeholder="https://your-domain.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              URL หลักของเว็บไซต์ที่จะใช้ใน Rich Menu
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => createRichMenu('grid')} 
              disabled={isLoading || !isConnected}
              className="flex-1"
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              สร้าง Rich Menu (3x2 Grid)
            </Button>
            <Button 
              onClick={() => createRichMenu('simple')} 
              disabled={isLoading || !isConnected}
              variant="outline"
              className="flex-1"
            >
              <Menu className="h-4 w-4 mr-2" />
              สร้าง Rich Menu (Simple)
            </Button>
          </div>

          {richMenuList.length > 0 && (
            <div className="space-y-2">
              <Label>Rich Menu ที่มีอยู่</Label>
              <div className="space-y-2">
                {richMenuList.map((menu) => (
                  <div key={menu.richMenuId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{menu.name}</p>
                      <p className="text-sm text-gray-500">ID: {menu.richMenuId}</p>
                    </div>
                    <Button
                      onClick={() => setDefaultRichMenu(menu.richMenuId)}
                      size="sm"
                      variant="outline"
                    >
                      ตั้งเป็น Default
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* คู่มือการตั้งค่า */}
      <Card>
        <CardHeader>
          <CardTitle>คู่มือการตั้งค่า Line OA</CardTitle>
          <CardDescription>
            ขั้นตอนการตั้งค่า Line Official Account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">1. สร้าง Line Official Account</h4>
            <p className="text-sm text-gray-600">
              - ไปที่ <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Line Developers</a>
              - สร้าง Provider และ Channel ใหม่
              - เลือกประเภท Messaging API
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">2. ตั้งค่า Channel</h4>
            <p className="text-sm text-gray-600">
              - ไปที่ Channel Settings
              - คัดลอก Channel Access Token และ Channel Secret
              - ตั้งค่า Webhook URL: https://your-domain.com/api/line/webhook
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">3. ตั้งค่า Environment Variables</h4>
            <p className="text-sm text-gray-600">
              - LINE_CHANNEL_ACCESS_TOKEN=your_access_token
              - LINE_CHANNEL_SECRET=your_channel_secret
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">4. ทดสอบการเชื่อมต่อ</h4>
            <p className="text-sm text-gray-600">
              - ใช้ปุ่ม "ตรวจสอบการเชื่อมต่อ" ด้านบน
              - หากเชื่อมต่อสำเร็จ จะแสดงสถานะ "เชื่อมต่อแล้ว"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LineOASettings; 