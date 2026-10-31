import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ThemeToggle } from '../../components/layout/ThemeToggle';


export const RegisterPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
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
      const result = await authApi.register(formData);
      if (result.success) {
        if (result.data?.token) {
          localStorage.setItem('docintel_token', result.data.token);
        }
        await refreshUser();
        navigate('/');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please verify your details.');
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
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create an Account</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
            Join DocIntel AI Document Intelligence System
          </p>
        </div>

        {/* Register Card */}
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
              placeholder="e.g. john_doe"
              required
            />

            <Input
              label="Full Name"
              name="name"
              icon={Sparkles}
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. John Doe"
              required
            />

            <Input
              label="Work Email"
              name="email"
              type="email"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              required
            />

            <Input
              label="Password"
              name="password"
              type="password"
              icon={Lock}
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Register Account <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-inherit text-center text-xs">
            <p className={isDark ? 'text-slate-400' : 'text-warm-muted'}>
              Already have an account?{' '}
              <Link
                to="/login"
                className={`font-semibold hover:underline ${
                  isDark ? 'text-cyanBrand' : 'text-orangeBrand'
                }`}
              >
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;

