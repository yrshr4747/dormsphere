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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card-static animate-slide-up" style={{ width: '100%', maxWidth: 440 }}>
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
            <div className="flex gap-sm mb-lg" style={{ background: 'rgba(15,14,13,0.4)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
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
              {mode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" type="text" placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input className="form-input" type="text" placeholder="123CS0076" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value.toUpperCase() })} required />
                    <span style={{ fontSize: '0.7rem', color: 'var(--light-gray)', marginTop: '4px' }}>
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
                    <div className="flex gap-sm">
                      <button type="button" className={`btn btn-sm w-full ${form.program === 'btech' ? 'btn-cardinal' : 'btn-ghost'}`} onClick={() => setForm({ ...form, program: 'btech' })}>
                        B.Tech
                      </button>
                      <button type="button" className={`btn btn-sm w-full ${form.program === 'dual' ? 'btn-cardinal' : 'btn-ghost'}`} onClick={() => setForm({ ...form, program: 'dual' })} disabled={form.department === 'AD'}>
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
