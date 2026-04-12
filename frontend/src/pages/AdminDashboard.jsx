import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import SettingsModal from '../components/SettingsModal';

export default function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const [waves, setWaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingWave, setEditingWave] = useState(null);
  const [formData, setFormData] = useState({ gateOpen: '', gateClose: '' });
  const [feedback, setFeedback] = useState(null);
  const [retentionActive, setRetentionActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchWaves();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/admin/settings');
      setRetentionActive(data.settings?.retention_window_active === 'true');
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const fetchWaves = async () => {
    try {
      const { data } = await api.get('/waves');
      setWaves(data.waves);
    } catch (err) {
      console.error('Failed to load waves', err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (wave) => {
    setEditingWave(wave.id);
    setFormData({
      gateOpen: new Date(wave.gate_open).toISOString().slice(0, 16),
      gateClose: new Date(wave.gate_close).toISOString().slice(0, 16),
    });
  };

  const handleUpdateWave = async (id) => {
    try {
      setFeedback(null);
      await api.put(`/waves/${id}`, formData);
      setEditingWave(null);
      fetchWaves();
      setFeedback({ type: 'success', message: 'Wave timings updated.' });
    } catch (err) {
      setFeedback({ type: 'fail', message: err.response?.data?.error || 'Failed to update.' });
    }
  };

  return (
    <div className="page container">
      <div className="mb-xl animate-slide-up">
        <div className="flex items-center gap-md">
          {user.profileImageUrl && (
            <img 
              src={user.profileImageUrl.startsWith('http') ? user.profileImageUrl : `${import.meta.env.VITE_API_URL || ''}${user.profileImageUrl}`} 
              alt="Profile" 
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--cardinal)' }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div className="flex justify-between items-center">
              <h1>Welcome, <span className="text-cardinal">{user.name || 'Admin'}</span></h1>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
            </div>
            <p className="text-muted mt-sm">
              {user.designation} • {user.department}
            </p>
          </div>
        </div>
      </div>

      <div className="grid-3 mb-xl">
        <Link to="/rooms" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ animationDelay: '0.1s' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔑</div>
            <h4>Room Overrides</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Manually assign capacities
            </p>
          </div>
        </Link>
        <Link to="/elections" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ animationDelay: '0.2s' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🗳️</div>
            <h4>Elections Admin</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Manage polls & surveys
            </p>
          </div>
        </Link>
        <div className="glass-card text-center" style={{ cursor: 'pointer', animationDelay: '0.3s' }} onClick={() => {
          window.open(`${import.meta.env.VITE_API_URL || ''}/admin/export/allocations?token=${localStorage.getItem('dormsphere_token')}`, '_blank');
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📊</div>
          <h4>Export Allocations</h4>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
            Download CSV Report
          </p>
        </div>
      </div>

      <div className="glass-card-static mb-xl animate-slide-up flex justify-between items-center">
        <div>
          <h3 className="mb-sm">🕰️ Senior Retention Window</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Allow 3rd, 4th, and 5th-year students to lock in their existing rooms before the wave race starts.
          </p>
        </div>
        <button 
          className={`btn ${retentionActive ? 'btn-danger' : 'btn-success'}`}
          onClick={async () => {
             const newState = !retentionActive;
             try {
                await api.post('/admin/settings/retention', { active: newState });
                setRetentionActive(newState);
                alert(`Retention window correctly ${newState ? 'opened' : 'closed'}!`);
             } catch(err) {
                alert('Failed to update retention setting.');
             }
          }}
        >
          {retentionActive ? 'Close Retention Window' : 'Open Retention Window'}
        </button>
      </div>

      <div className="glass-card-static mb-xl">
        <div className="flex items-center justify-between mb-md">
          <h3>📅 Wave Controls</h3>
          {feedback && (
            <span className={`badge ${feedback.type === 'success' ? 'badge-success' : 'badge-danger'}`}>
              {feedback.message}
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="spinner" style={{ margin: 'var(--space-lg) auto' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--light-gray)' }}>
                  <th style={{ padding: 'var(--space-sm)' }}>Year Group</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Target Batch</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Status</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Gate Open</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Gate Close</th>
                  <th style={{ padding: 'var(--space-sm)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {waves.map((w) => {
                  const now = new Date();
                  const start = new Date(w.gate_open);
                  const end = new Date(w.gate_close);
                  const isActive = now >= start && now <= end && w.is_active;

                  return (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{w.year_group}</span>
                      </td>
                      <td style={{ padding: 'var(--space-md) var(--space-sm)', color: 'var(--light-gray)' }}>
                        {2026 - w.year_group}
                      </td>
                      <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                        {isActive ? (
                          <span className="badge badge-success">Active</span>
                        ) : end < now ? (
                          <span className="badge badge-danger">Closed</span>
                        ) : (
                          <span className="badge badge-gold">Pending</span>
                        )}
                      </td>
                      {editingWave === w.id ? (
                        <>
                          <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                            <input 
                              type="datetime-local" 
                              className="form-input" 
                              value={formData.gateOpen} 
                              onChange={(e) => setFormData({ ...formData, gateOpen: e.target.value })}
                            />
                          </td>
                          <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                            <input 
                              type="datetime-local" 
                              className="form-input" 
                              value={formData.gateClose} 
                              onChange={(e) => setFormData({ ...formData, gateClose: e.target.value })}
                            />
                          </td>
                          <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                            <div className="flex gap-sm">
                              <button className="btn btn-sm btn-success" onClick={() => handleUpdateWave(w.id)}>Save</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => setEditingWave(null)}>Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                            {new Date(w.gate_open).toLocaleString()}
                          </td>
                          <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                            {new Date(w.gate_close).toLocaleString()}
                          </td>
                          <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                            <button className="btn btn-sm btn-ghost" onClick={() => startEdit(w)}>
                              ✏️ Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="glass-card-static mb-xl animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <h3 className="mb-md" style={{ color: 'var(--danger)' }}>⚠️ System Maintenance</h3>
        <p className="text-muted mb-md" style={{ fontSize: '0.85rem' }}>
          Restricted to Chief Warden only. Executing this will completely wipe all room assignments, roommates, and lottery states.
        </p>
        <button 
          className="btn" 
          style={{ background: 'var(--danger)', color: 'white' }}
          onClick={() => {
            const confirmVal = prompt("Type 'I AGREE' to confirm completely wiping all data and resetting the lottery.");
            if (confirmVal === 'I AGREE') {
              api.post('/admin/reset-lottery')
                .then(res => alert(res.data.message))
                .catch(err => alert(err.response?.data?.error || 'Reset failed'));
            }
          }}
        >
          💥 CLEAR ALL DATA
        </button>
      </div>
      {showSettings && <SettingsModal user={user} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
