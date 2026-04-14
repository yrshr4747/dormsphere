import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

function roleHome(role) {
  if (role === 'student') return '/student/dashboard';
  if (role === 'guard' || role === 'warden') return '/outpass';
  if (role === 'admin' || role === 'judcomm') return '/admin/dashboard';
  return '/login';
}

export default function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'otp'
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    rollNumber: '',
    year: '1',
    department: 'CSE',
    program: 'btech',
  });
  const [profileImage, setProfileImage] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password });
      localStorage.setItem('dormsphere_token', data.token);
      localStorage.setItem('dormsphere_user', JSON.stringify(data.student));
      navigate(roleHome(data.student.role));
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      if (data.requiresOTP === false) {
        // Super Admin fast-path bypass: Auto-verify immediately
        setOtpEmail(data.email);
        setSuccess('Super Admin recognized. Entering dashboard...');
        
        // Construct the formData and call verify immediately
        const formData = new FormData();
        formData.append('email', data.email);
        formData.append('name', form.name);
        formData.append('password', form.password);
        if (form.designation) formData.append('designation', form.designation);
        
        const verifyObj = await api.post('/auth/verify-otp', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        localStorage.setItem('dormsphere_token', verifyObj.data.token);
        localStorage.setItem('dormsphere_user', JSON.stringify(verifyObj.data.student));
        navigate(roleHome(verifyObj.data.student.role));
      } else if (data.requiresOTP) {
        setOtpEmail(data.email);
        setMode('otp');
        setSuccess('OTP sent to your email!');
        startCooldown();
      }
    } catch (err) {
      setError(err.response?.data?.error || `Registration failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Use FormData to support Multer profileImage
      const formData = new FormData();
      formData.append('email', otpEmail);
      formData.append('otp', otp);
      formData.append('name', form.name);
      formData.append('password', form.password);
      if (form.rollNumber) formData.append('rollNumber', form.rollNumber);
      if (form.designation) formData.append('designation', form.designation);
      if (profileImage) formData.append('profileImage', profileImage);

      const { data } = await api.post('/auth/verify-otp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      localStorage.setItem('dormsphere_token', data.token);
      localStorage.setItem('dormsphere_user', JSON.stringify(data.student));
      navigate(roleHome(data.student.role));
    } catch (err) {
      setError(err.response?.data?.error || `Verification failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post('/auth/resend-otp', { email: otpEmail });
      setSuccess('New OTP sent!');
      setError('');
      startCooldown();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend.');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--login-hero-overlay), url("/login-bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      <div className="glass-card-static animate-slide-up" style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={toggleTheme}
          style={{ position: 'absolute', top: '1rem', right: '1rem' }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        {/* Header */}
        <div className="text-center mb-xl">
          <div style={{
            width: 64, height: 64, margin: '0 auto var(--space-lg)',
            background: 'linear-gradient(135deg, var(--cardinal) 0%, var(--cardinal-light) 100%)',
            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.8rem',
          }}>
            🏛️
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-xs)' }}>DormSphere</h1>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            IIITK Hostel Management Platform
          </p>
        </div>

        {/* OTP Verification View */}
        {mode === 'otp' ? (
          <div>
            <div className="text-center mb-lg">
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📧</div>
              <h3>Verify Your Email</h3>
              <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>
                Enter the 6-digit code sent to<br />
                <strong style={{ color: 'var(--cardinal-light)' }}>{otpEmail}</strong>
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)', color: 'var(--danger)', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                background: 'rgba(45,138,78,0.1)', border: '1px solid rgba(45,138,78,0.3)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)', color: 'var(--success-light)', fontSize: '0.85rem',
              }}>
                {success}
              </div>
            )}

            <form onSubmit={handleVerifyOTP}>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontWeight: 700 }}
                  autoFocus
                  required
                />
              </div>

              <button className="btn btn-cardinal btn-lg w-full" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '✅ Verify & Create Account'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-lg">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              >
                ← Back
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResendOTP}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : '🔄 Resend OTP'}
              </button>
            </div>

            <p className="text-center text-muted mt-lg" style={{ fontSize: '0.7rem' }}>
              Code expires in 10 minutes • Max 5 attempts
            </p>
          </div>
        ) : (
          /* Login / Register View */
          <div>
            {/* Toggle */}
            <div className="flex gap-sm mb-lg" style={{ background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
              <button
                className={`btn btn-sm w-full ${mode === 'login' ? 'btn-cardinal' : 'btn-ghost'}`}
                style={{ border: 'none' }}
                onClick={() => { setMode('login'); setError(''); }}
              >
                Sign In
              </button>
              <button
                className={`btn btn-sm w-full ${mode === 'register' ? 'btn-cardinal' : 'btn-ghost'}`}
                style={{ border: 'none' }}
                onClick={() => { setMode('register'); setError(''); }}
              >
                Register
              </button>
            </div>

            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)', color: 'var(--danger)', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={mode === 'register' ? handleRegister : handleLogin}>
              {mode === 'register' && (() => {
                const emailPrefix = (form.email || '').split('@')[0];
                // Strict check: if the email prefix looks like a roll number OR if they haven't typed an email yet
                const isRollFormat = /^([15])(2[1-6])(CS|EC|ME|AD)(\d{4})$/i.test(emailPrefix) || emailPrefix === '';
                const showDesignation = !isRollFormat;

                return (
                  <>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input className="form-input" type="text" placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>

                    {!showDesignation ? (
                      <div className="form-group">
                        <label className="form-label">Roll Number</label>
                        <input className="form-input" type="text" placeholder="123CS0076" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value.toUpperCase() })} required />
                        <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)', marginTop: '4px' }}>
                          Format: 123CS0076 (B.Tech) or 523CS0001 (Dual Degree)
                        </span>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Designation</label>
                        <select className="form-input" value={form.designation || 'Student'} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                          <option value="Student">Student (Default)</option>
                          <option value="Warden">Warden</option>
                          <option value="Chief Warden">Chief Warden</option>
                          <option value="Caretaker">Caretaker</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Profile Image (Optional)</label>
                      <input 
                        className="form-input" 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => setProfileImage(e.target.files[0])} 
                        style={{ padding: '0.5rem' }} 
                      />
                    </div>
                  </>
                );
              })()}

              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" id="login-email" type="email" placeholder="student@iiitk.ac.in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                {mode === 'register' && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)', marginTop: '4px' }}>
                    Only @iiitk.ac.in emails are allowed
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" id="login-password" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>

              <button className="btn btn-cardinal btn-lg w-full" id="login-submit" type="submit" disabled={loading} style={{ marginTop: 'var(--space-md)' }}>
                {loading
                  ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  : mode === 'register' ? '📧 Send Verification OTP' : 'Sign In'
                }
              </button>
            </form>

            <p className="text-center text-muted mt-lg" style={{ fontSize: '0.8rem' }}>
              Secured with JWT • AES-256 Vault • OTP Verified
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
