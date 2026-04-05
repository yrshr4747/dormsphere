import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
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
      navigate('/');
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
      if (data.requiresOTP) {
        setOtpEmail(data.email);
        setMode('otp');
        setSuccess('OTP sent to your email!');
        startCooldown();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-otp', {
        email: otpEmail,
        otp,
        rollNumber: form.rollNumber,
        name: form.name,
        password: form.password,
        year: form.year,
        department: form.department,
      });
      localStorage.setItem('dormsphere_token', data.token);
      localStorage.setItem('dormsphere_user', JSON.stringify(data.student));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.');
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl) 0', background: 'var(--bg-secondary)' }}>
      <div className="glass-card-static animate-slide-up" style={{ width: '100%', maxWidth: 440, padding: '2.5rem' }}>
        {/* Header */}
        <div className="text-center mb-xl" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto var(--space-md)',
            background: 'var(--sapphire)', color: '#FFFFFF',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            🏛️
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-xs)', color: 'var(--sapphire)' }}>DormSphere</h1>
          <p className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            IIITK Residence Portal
          </p>
        </div>

        {/* OTP Verification View */}
        {mode === 'otp' ? (
          <div>
            <div className="text-center mb-lg">
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Verify Your Email</h3>
              <p className="text-muted mt-sm" style={{ fontSize: '0.9rem' }}>
                Enter the 6-digit code sent to<br />
                <strong style={{ color: 'var(--text-main)' }}>{otpEmail}</strong>
              </p>
            </div>

            {error && (
              <div style={{
                background: '#FFF5F5', border: '1px solid #FC8181',
                padding: '1rem', marginBottom: 'var(--space-lg)', color: '#C53030', fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                background: '#F0FFF4', border: '1px solid #68D391',
                padding: '1rem', marginBottom: 'var(--space-lg)', color: '#2F855A', fontSize: '0.85rem',
                fontWeight: 500
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

              <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Verify & Create Account'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-lg">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              >
                Go Back
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResendOTP}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>

            <p className="text-center text-muted mt-lg" style={{ fontSize: '0.75rem' }}>
              Code expires in 10 minutes
            </p>
          </div>
        ) : (
          /* Login / Register View */
          <div>
            {/* Toggle */}
            <div className="flex mb-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <button
                className={`btn w-full ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ border: 'none', borderRadius: 0, shadow: 'none' }}
                onClick={() => { setMode('login'); setError(''); }}
              >
                Sign In
              </button>
              <button
                className={`btn w-full ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ border: 'none', borderRadius: 0, shadow: 'none' }}
                onClick={() => { setMode('register'); setError(''); }}
              >
                Register
              </button>
            </div>

            {error && (
              <div style={{
                background: '#FFF5F5', border: '1px solid #FC8181',
                padding: '1rem', marginBottom: 'var(--space-lg)', color: '#C53030', fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {error}
              </div>
            )}

            <form onSubmit={mode === 'register' ? handleRegister : handleLogin}>
              {mode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" type="text" placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input className="form-input" type="text" placeholder="123CS0076" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value.toUpperCase() })} required />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Format: 123CS0076 (B.Tech) or 523CS0001 (Dual Degree)
                    </span>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Admission Year</label>
                      <select className="form-input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                        <option value="2021">2021</option>
                        <option value="2022">2022</option>
                        <option value="2023">2023</option>
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Department</label>
                      <select className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="ME">Mechanical</option>
                        <option value="AD">AI & DS</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Program</label>
                    <div className="flex">
                      <button type="button" className={`btn w-full ${form.program === 'btech' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 0 }} onClick={() => setForm({ ...form, program: 'btech' })}>
                        B.Tech
                      </button>
                      <button type="button" className={`btn w-full ${form.program === 'dual' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 0 }} onClick={() => setForm({ ...form, program: 'dual' })} disabled={form.department === 'AD'}>
                        Dual Degree
                      </button>
                    </div>
                    {form.department === 'AD' && form.program === 'dual' && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px' }}>Dual Degree not available for AI & DS</span>
                    )}
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" id="login-email" type="email" placeholder="student@iiitk.ac.in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                {mode === 'register' && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Only @iiitk.ac.in emails are allowed
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" id="login-password" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>

              <button className="btn btn-primary btn-lg w-full" id="login-submit" type="submit" disabled={loading} style={{ marginTop: 'var(--space-md)' }}>
                {loading
                  ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  : mode === 'register' ? 'Send Verification Code' : 'Sign In'
                }
              </button>
            </form>

            <p className="text-center text-muted mt-xl" style={{ fontSize: '0.8rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              Authorized Access Only
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
