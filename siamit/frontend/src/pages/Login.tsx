import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isValidEmail } from '@/lib/validators';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format before submitting
    if (!isValidEmail(email)) {
      toast({
        title: t('common.error'),
        description: t('auth.invalidEmailFormat'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Use the returned user info instead of reading localStorage (fixes race condition)
      const userInfo = await login(email, password);
      toast({
        title: t('auth.loginSuccess'),
        description: t('auth.welcomeToSystem'),
      });

      // Navigate based on user role - simplified logic
      // userInfo is always defined on successful login
      const role = userInfo && 'role' in userInfo ? userInfo.role : undefined;
      const destination = (role === 'admin' || role === 'superadmin')
        ? (role === 'admin' ? '/admin' : '/')
        : '/';
      navigate(destination, { replace: true });
    } catch (error: any) {
      toast({
        title: t('auth.loginError'),
        description: error.message || t('auth.checkPasswordMatch'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:dark-gradient-bg flex items-center justify-center p-4 relative overflow-x-hidden transition-all duration-500">
      {/* Floating background shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 opacity-30 blur-2xl animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-[200px] h-[200px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 opacity-20 blur-xl animate-float-slow2" />
        <div className="absolute top-1/2 left-1/2 w-20 h-20 rounded-full bg-blue-100 opacity-10 blur-xl animate-pulse-slow" style={{ transform: 'translate(-50%,-50%)' }} />
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-2xl grid grid-cols-1 gap-8 animate-fade-in z-10">
        {/* Login Form */}
        <div className="space-y-8 flex flex-col justify-center animate-fade-in-up">
          <div className="text-center">
            <img
              src="/lovable-uploads/IMG_4486-removebg-preview.png"
              alt="Siam IT Logo"
              className="mx-auto h-20 w-auto mb-6 animate-float"
            />
            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-500 to-purple-500 dark:from-blue-300 dark:via-indigo-200 dark:to-purple-300 drop-shadow-lg animate-pop-in">
              {t('auth.login')}
            </h2>
            <p className="mt-2 text-base text-blue-500 dark:text-blue-200 animate-fade-in-up delay-100">
              {t('main.onlineLeaveSystemCompany')}
            </p>
          </div>

          <Card className="shadow-2xl border-0 glass dark:dark-card-gradient dark:dark-glow animate-fade-in-up">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center text-blue-800 dark:text-white animate-slide-in-left">{t('auth.login')}</CardTitle>
              <CardDescription className="text-center text-blue-400 dark:text-blue-200 animate-fade-in-up delay-100">
                {t('auth.enterEmailPassword')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-blue-900 font-medium">{t('auth.email')}</Label>
                  <div className="flex items-center gap-3">
                    <Mail className="h-6 w-6 text-blue-400 animate-pop-in" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-blue-login"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-blue-900 dark:text-gray-200 font-medium">{t('auth.password')}</Label>
                  <div className="flex items-center gap-3">
                    <Lock className="h-6 w-6 text-blue-400 dark:text-blue-300 animate-pop-in" />
                    <div className="relative w-full">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-blue-login pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-300 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-200 transition-colors animate-pop-in"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full btn-blue-login text-lg py-3 font-bold shadow-lg animate-bounce-in"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      {t('auth.loggingIn')}
                    </>
                  ) : (
                    t('auth.login')
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-base text-blue-500 dark:text-blue-200">
                  {t('auth.dontHaveAccount')}{' '}
                  <Link
                    to="/register"
                    className="font-bold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100 transition-colors"
                  >
                    {t('auth.register')}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>


      </div>
      <style>{`
        .glass-card-login {
          background: rgba(255,255,255,0.85);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.10);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 2rem;
          border: 1px solid rgba(255,255,255,0.18);
        }
        .input-blue-login {
          background: rgba(255,255,255,0.7);
          border: 1.5px solid #bfdbfe;
          border-radius: 1rem;
          box-shadow: 0 1px 4px 0 rgba(31, 38, 135, 0.04);
          padding: 0.75rem 1.25rem;
          font-size: 1rem;
          color: #1e293b;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .input-blue-login:focus {
          border: 1.5px solid #3b82f6;
          box-shadow: 0 0 0 2px #3b82f644;
          outline: none;
        }
        .input-blue-login::-ms-reveal {
          display: none !important;
        }
        .input-blue-login::-webkit-credentials-auto-fill-button {
          display: none !important;
        }
        .input-blue-login::-webkit-strong-password-auto-fill-button {
          display: none !important;
        }
        .input-blue-login::-webkit-textfield-decoration-container {
          display: none !important;
        }
        .dark .input-blue-login {
          background: rgba(17, 24, 39, 0.7);
          border-color: #374151;
          color: #f3f4f6;
        }
        .dark .input-blue-login::placeholder {
          color: #9ca3af;
        }
        .dark .input-blue-login:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.3);
        }
        .btn-blue-login {
          background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
          color: #fff;
          border-radius: 1rem;
          font-weight: 700;
          box-shadow: 0 2px 8px 0 rgba(31, 38, 135, 0.10);
          border: none;
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
        }
        .btn-blue-login:hover {
          background: linear-gradient(90deg, #6366f1 0%, #3b82f6 100%);
          color: #fff;
          box-shadow: 0 4px 16px 0 rgba(31, 38, 135, 0.16);
        }
        .animate-float { animation: float 3s ease-in-out infinite alternate; }
        .animate-float-slow { animation: float 8s ease-in-out infinite alternate; }
        .animate-float-slow2 { animation: float 12s ease-in-out infinite alternate; }
        .animate-fade-in { animation: fadeIn 1.2s cubic-bezier(0.23, 1, 0.32, 1); }
        .animate-fade-in-up { animation: fadeInUp 1.1s cubic-bezier(0.23, 1, 0.32, 1); }
        .animate-slide-in-left { animation: slideInLeft 1.1s cubic-bezier(0.23, 1, 0.32, 1); }
        .animate-pop-in { animation: popIn 0.7s cubic-bezier(0.23, 1, 0.32, 1); }
        .animate-bounce-in { animation: bounceIn 1.2s cubic-bezier(0.23, 1, 0.32, 1); }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-18px); } }
        @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes slideInLeft { 0% { opacity: 0; transform: translateX(-40px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.7); } 60% { opacity: 1; transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

export default Login;
