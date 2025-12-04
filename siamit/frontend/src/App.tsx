import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from 'next-themes';
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from 'react';
import '@/i18n';
import { PushNotificationProvider } from "@/contexts/PushNotificationContext";
import { SocketProvider } from "@/contexts/SocketContext";

// Lazy load all page components
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Profile = lazy(() => import("./pages/Profile"));
const LeaveRequest = lazy(() => import("./pages/LeaveRequest"));
const LeaveHistory = lazy(() => import("./pages/LeaveHistory"));
const ApproveLeave = lazy(() => import("./pages/ApproveLeave"));
const EmployeeManagement = lazy(() => import("./pages/EmployeeManagement"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LeaveSystemSettings = lazy(() => import('./pages/SuperAdmin/LeaveSystemSettings'));
const SuperAdminList = lazy(() => import('./pages/SuperAdmin/SuperAdminList'));
const ManagePost = lazy(() => import('./pages/ManagePost'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const CompanyMonthDetailPage = lazy(() => import('./pages/CompanyMonthDetailPage'));
const AnnouncementsFeedPage = lazy(() => import('./pages/AnnouncementsFeedPage'));
const AdminLeaveRequest = lazy(() => import('./pages/AdminLeaveRequest'));

import LanguageSwitcher from "@/components/LanguageSwitcher";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SidebarTrigger } from "@/components/ui/sidebar";
import LoadingSpinner from "@/components/LoadingSpinner";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
      </Routes>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full relative">
        {/* Hamburger for mobile */}
        <div className="fixed top-4 left-4 z-50 md:hidden">
          <SidebarTrigger className="bg-white/80 rounded-full shadow p-2" />
        </div>
        {/* Global Language Switcher */}
        <div className="fixed top-4 right-4 z-50">
          <LanguageSwitcher />
        </div>
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Support '/dashboard' as an alias for the root dashboard */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/leave-request" element={
                <ProtectedRoute>
                  <LeaveRequest />
                </ProtectedRoute>
              } />
              <Route path="/leave-history" element={
                <ProtectedRoute>
                  <LeaveHistory />
                </ProtectedRoute>
              } />
              <Route path="/announcements/manage-post" element={
                <ProtectedRoute adminOnly>
                  <ManagePost />
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
              <Route path="/calendar/:year/:month" element={<ProtectedRoute><CompanyMonthDetailPage /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute><AnnouncementsFeedPage /></ProtectedRoute>} />

              <Route path="/admin" element={
                <ProtectedRoute adminOnly>
                  <ApproveLeave />
                </ProtectedRoute>
              } />
              <Route path="/admin/employees" element={
                <ProtectedRoute adminOnly>
                  <EmployeeManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/employees/:id" element={
                <ProtectedRoute adminOnly>
                  <EmployeeDetail />
                </ProtectedRoute>
              } />
              <Route path="/admin/leave-request" element={
                <ProtectedRoute adminOnly>
                  <AdminLeaveRequest />
                </ProtectedRoute>
              } />
              <Route path="/superadmin/manage-all" element={
                <ProtectedRoute superadminOnly>
                  <LeaveSystemSettings />
                </ProtectedRoute>
              } />
              <Route path="/superadmin/superadmins" element={
                <ProtectedRoute superadminOnly>
                  <SuperAdminList />
                </ProtectedRoute>
              } />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <AuthProvider>
              <PushNotificationProvider>
                <SocketProvider>
                  <AppContent />
                </SocketProvider>
              </PushNotificationProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
