import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, User, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ThemeToggle } from '../../components/layout/ThemeToggle';


export const OnboardSuperAdminPage = () => {
  const navigate = useNavigate();
  const { onboardSuperAdmin } = useAuth();
  const { isDark } = useTheme();

  const [formData, setFormData] = useState({
    username: 'admin',
    name: 'Super Admin',
    email: 'admin@careguidebd.com',
    password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await onboardSuperAdmin(formData);
      if (result.success) {
        navigate('/');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Super admin onboarding failed. It may already be initialized.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative ${
      isDark ? 'theme-dark bg-obsidian-bg' : 'theme-warm bg-warm-bg'
    }`}>
      {/* Top Bar Switcher */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div
            className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-xl ${
              isDark
                ? 'bg-gradient-cyan-indigo text-white shadow-glow-cyan'
                : 'bg-gradient-orange-warm text-white shadow-glow-orange'
            }`}
          >
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Initialization</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
            One-time setup: Create the primary Super Admin account
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-2xl">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              name="username"
              icon={User}
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. admin"
              required
            />

            <Input
              label="Full Name"
              name="name"
              icon={Sparkles}
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. System Administrator"
              required
            />

            <Input
              label="Work Email"
              name="email"
              type="email"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@careguidebd.com"
              required
            />

            <Input
              label="Master Password"
              name="password"
              type="password"
              icon={Lock}
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter secure master password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Initialize Super Admin
            </Button>
          </form>

          <div className="mt-5 text-center border-t border-inherit pt-4">
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
              Already completed setup?{' '}
              <Link
                to="/login"
                className={`font-semibold hover:underline ${
                  isDark ? 'text-cyanBrand' : 'text-orangeBrand'
                }`}
              >
                Sign In to Dashboard
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OnboardSuperAdminPage;

