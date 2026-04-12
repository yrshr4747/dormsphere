import { useState } from 'react';
import api from '../services/api';

export default function SettingsModal({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileImage, setProfileImage] = useState(null);
  const [preview, setPreview] = useState(user.profileImageUrl || null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setPreview(URL.createObjectURL(file));
      setError('');
      setSuccess('');
    }
  };

  const saveProfileImage = async () => {
    if (!profileImage) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('profileImage', profileImage);
      const res = await api.put('/student/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const updatedUser = { ...user, profileImageUrl: res.data.profileImageUrl };
      localStorage.setItem('dormsphere_user', JSON.stringify(updatedUser));
      setSuccess('Profile image updated successfully! The page will reload.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update image.');
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/student/password', { currentPassword, newPassword });
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="selection-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="glass-card-static animate-slide-up" style={{ maxWidth: 450, padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-md">
          <h2 style={{ fontSize: '1.5rem' }}>⚙️ Settings</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="flex gap-sm mb-lg" style={{ borderBottom: '1px solid var(--border)' }}>
          <button 
            className={`btn btn-sm ${activeTab === 'profile' ? 'btn-cardinal' : 'btn-ghost'}`} 
            onClick={() => { setActiveTab('profile'); setError(''); setSuccess(''); }}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}
          >
            Profile Picture
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'password' ? 'btn-cardinal' : 'btn-ghost'}`} 
            onClick={() => { setActiveTab('password'); setError(''); setSuccess(''); }}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}
          >
            Password
          </button>
        </div>

        {error && <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
        {success && <div style={{ color: '#4ade80', marginBottom: '1rem', fontSize: '0.85rem' }}>{success}</div>}

        {activeTab === 'profile' && (
          <div className="flex flex-col items-center">
            <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--cardinal)', marginBottom: '1rem' }}>
              {preview ? (
                <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Image</div>
              )}
            </div>
            
            <input type="file" id="profile-upload" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            <div className="flex gap-sm w-full">
               <label htmlFor="profile-upload" className="btn btn-ghost" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                 Choose File
               </label>
               <button className="btn btn-cardinal" style={{ flex: 1 }} onClick={saveProfileImage} disabled={!profileImage || loading}>
                 {loading ? 'Saving...' : 'Save Image'}
               </button>
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="flex flex-col gap-md">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
              />
            </div>
            <button className="btn btn-cardinal w-full mt-sm" onClick={savePassword} disabled={loading}>
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
