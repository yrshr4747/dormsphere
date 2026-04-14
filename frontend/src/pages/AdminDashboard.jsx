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
  const [retentionByYear, setRetentionByYear] = useState({ 3: false, 4: false, 5: false });
  const [anyWaveOpen, setAnyWaveOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchWaves();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/admin/settings');
      setRetentionByYear({
        3: data.retention?.[3] === true,
        4: data.retention?.[4] === true,
        5: data.retention?.[5] === true,
      });
      setAnyWaveOpen(data.anyWaveOpen === true);
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

  const getWaveState = (wave) => {
    const now = new Date();
    const start = new Date(wave.gate_open);
    const end = new Date(wave.gate_close);

    if (wave.status === 'completed' || end < now) {
      return {
        label: 'Closed',
        badgeClass: 'badge-danger',
        detail: `Closed on ${end.toLocaleString()}`,
      };
    }

    if (wave.is_active && now >= start && now <= end) {
      return {
        label: 'Active',
        badgeClass: 'badge-success',
        detail: `Open until ${end.toLocaleString()}`,
      };
    }

    if (start > now) {
      return {
        label: 'Scheduled',
        badgeClass: 'badge-gold',
        detail: `Opens on ${start.toLocaleString()}`,
      };
    }

    if (wave.is_active && now < start) {
      return {
        label: 'Pre-Activated',
        badgeClass: 'badge-gold',
        detail: `Marked active, but opens on ${start.toLocaleString()}`,
      };
    }

    return {
      label: 'Pending',
      badgeClass: 'badge-gold',
      detail: `Waiting for activation or schedule update`,
    };
  };

  const getRetentionExplanation = (yearGroup) => {
    const wave = waves.find((entry) => Number(entry.year_group) === Number(yearGroup));
    const waveState = wave ? getWaveState(wave) : null;

    if (retentionByYear[yearGroup]) {
      return {
        tone: 'var(--success-light)',
        text: `Year ${yearGroup} retention is open right now.`,
      };
    }

    if (waveState?.label === 'Active') {
      return {
        tone: 'var(--warning)',
        text: `Locked because the Year ${yearGroup} wave is active until ${new Date(wave.gate_close).toLocaleString()}.`,
      };
    }

    if (waveState?.label === 'Closed') {
      return {
        tone: 'var(--danger)',
        text: `Locked because the Year ${yearGroup} wave has already finished.`,
      };
    }

    if (anyWaveOpen && wave?.gate_open) {
      return {
        tone: 'var(--warning)',
        text: `Locked because a wave is currently open. Year ${yearGroup} opens on ${new Date(wave.gate_open).toLocaleString()}.`,
      };
    }

    if (wave?.gate_open) {
      return {
        tone: 'var(--light-gray)',
        text: `Can be opened now. Year ${yearGroup} wave is scheduled for ${new Date(wave.gate_open).toLocaleString()}.`,
      };
    }

    return {
      tone: 'var(--light-gray)',
      text: `No wave schedule found yet for Year ${yearGroup}.`,
    };
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

      <div className="glass-card-static mb-xl animate-slide-up">
        <div className="flex justify-between items-start" style={{ gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div>
            <h3 className="mb-sm">🕰️ Senior Retention Windows</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Retention is now controlled year-wise. It can be opened whenever all waves are closed.
            </p>
            {anyWaveOpen && (
              <p className="text-muted mt-sm" style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                A wave is currently open, so no new retention window can be opened right now.
              </p>
            )}
          </div>
        </div>

        <div className="grid-3 mt-lg">
          {[5, 4, 3].map((yearGroup) => {
            const isActive = retentionByYear[yearGroup];
            const canOpen = !anyWaveOpen;
            const explanation = getRetentionExplanation(yearGroup);
            return (
              <div key={yearGroup} className="glass-card-static">
                <div className="flex items-center justify-between mb-sm">
                  <h4>Year {yearGroup}</h4>
                  <span className={`badge ${isActive ? 'badge-success' : 'badge-gold'}`}>
                    {isActive ? 'Open' : 'Closed'}
                  </span>
                </div>
                <p className="text-muted mb-md" style={{ fontSize: '0.8rem' }}>
                  {yearGroup >= 3 ? 'Eligible seniors can retain their previous room.' : 'Retention is not available.'}
                </p>
                <p className="mb-md" style={{ fontSize: '0.78rem', color: explanation.tone }}>
                  {explanation.text}
                </p>
                <button
                  className={`btn btn-sm ${isActive ? 'btn-danger' : 'btn-success'}`}
                  disabled={!isActive && !canOpen}
                  onClick={async () => {
                    const newState = !isActive;
                    try {
                      await api.post('/admin/settings/retention', { active: newState, yearGroup });
                      await fetchSettings();
                      alert(`Year ${yearGroup} retention window ${newState ? 'opened' : 'closed'} successfully.`);
                    } catch (err) {
                      alert(err.response?.data?.error || 'Failed to update retention setting.');
                    }
                  }}
                >
                  {isActive ? 'Close Retention' : 'Open Retention'}
                </button>
              </div>
            );
          })}
        </div>
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
                  const waveState = getWaveState(w);

                  return (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{w.year_group}</span>
                      </td>
                      <td style={{ padding: 'var(--space-md) var(--space-sm)', color: 'var(--light-gray)' }}>
                        {2026 - w.year_group}
                      </td>
                      <td style={{ padding: 'var(--space-md) var(--space-sm)' }}>
                        <div className="flex flex-col gap-sm">
                          <span className={`badge ${waveState.badgeClass}`}>{waveState.label}</span>
                          <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                            {waveState.detail}
                          </span>
                        </div>
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
