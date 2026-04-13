import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import SettingsModal from '../components/SettingsModal';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const [assignment, setAssignment] = useState(null);
  const [match, setMatch] = useState(null);
  const [lottery, setLottery] = useState(null);
  const [infra, setInfra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retention, setRetention] = useState(null);
  const [roommateStatus, setRoommateStatus] = useState(null);
  const [inviteRoll, setInviteRoll] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get('/student/assignment'),
      api.get('/student/match'),
      api.get('/lottery/rank'),
      api.get('/infra/status'),
      api.get('/student/retention/status'),
      api.get('/roommates/status'),
    ]).then(([aRes, mRes, lRes, iRes, rRes, rmRes]) => {
      if (aRes.status === 'fulfilled') setAssignment(aRes.value.data.assignment);
      if (mRes.status === 'fulfilled') setMatch(mRes.value.data.match);
      if (lRes.status === 'fulfilled') setLottery(lRes.value.data.lottery);
      if (iRes.status === 'fulfilled') setInfra(iRes.value.data.infrastructure || []);
      if (rRes.status === 'fulfilled') setRetention(rRes.value.data);
      if (rmRes.status === 'fulfilled') setRoommateStatus(rmRes.value.data);
      setLoading(false);
    });
  }, []);

  const refreshRoommates = async () => {
    try {
      const { data } = await api.get('/roommates/status');
      setRoommateStatus(data);
    } catch (err) {
      console.error('Roommate refresh failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="page container flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page container">
      {/* Welcome Header */}
      <div className="mb-xl animate-slide-up flex items-center gap-md">
        {user.profileImageUrl ? (
          <img 
            src={user.profileImageUrl.startsWith('http') ? user.profileImageUrl : `${import.meta.env.VITE_API_URL || ''}${user.profileImageUrl}`} 
            alt="Profile" 
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--cardinal)' }}
          />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            {user.name?.[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div className="flex justify-between items-center">
            <h1>Welcome back, <span className="text-cardinal">{user.name || 'Student'}</span></h1>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
          </div>
          <p className="text-muted mt-sm">
            {user.rollNumber} • {user.department} • Year {user.yearGroup || user.year || 1}
          </p>
        </div>
      </div>

      {/* Retention Card */}
      {retention && retention.yearGroup >= 3 && retention.retentionWindowActive && retention.retentionStatus === 'none' && retention.previousRoom && (
        <div className="glass-card mb-xl animate-fade-in" style={{ border: '2px solid var(--accent-gold)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ color: 'var(--accent-gold)', marginBottom: 'var(--space-xs)' }}>🕰️ Senior Retention Required</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                You previously lived in Room {retention.previousRoom.room_number}. You can retain this room or enter the wave pool.
              </p>
            </div>
            <div className="flex gap-sm">
              <button className="btn btn-sm btn-ghost" onClick={async () => {
                try {
                  await api.post('/student/retention', { action: 'release' });
                  window.location.reload();
                } catch(e){}
              }}>Enter Wave Pool</button>
              <button 
                className="btn btn-sm" 
                style={{ background: 'var(--accent-gold)', color: '#000' }}
                onClick={async () => {
                  try {
                    await api.post('/student/retention', { action: 'retain' });
                    window.location.reload();
                  } catch(e) {
                    alert('Error retaining room: ' + (e.response?.data?.error || e.message));
                  }
                }}
              >
                Retain Room {retention.previousRoom.room_number}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="grid-4 mb-xl">
        <Link to="/rooms" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ animationDelay: '0.1s' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🏢</div>
            <h4>Room Selection</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Browse & book rooms
            </p>
          </div>
        </Link>
        <Link to="/survey" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center">
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📋</div>
            <h4>Personality Survey</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Find your ideal roommate
            </p>
          </div>
        </Link>
        <Link to="/outpass" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center">
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🎫</div>
            <h4>QR Outpass</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Generate digital pass
            </p>
          </div>
        </Link>
        <Link to="/elections" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center">
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🗳️</div>
            <h4>Elections</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Vote for representatives
            </p>
          </div>
        </Link>
      </div>

      {/* Status Cards */}
      <div className="grid-3 mb-xl">
        {/* Room Assignment */}
        <div className="glass-card-static">
          <div className="flex items-center justify-between mb-md">
            <h3>🏠 Room</h3>
            {assignment ? (
              <span className="badge badge-success">Assigned</span>
            ) : (
              <span className="badge badge-cardinal">Pending</span>
            )}
          </div>
          {assignment ? (
            <div>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>
                {assignment.hostel_code} — {assignment.room_number}
              </p>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Floor {assignment.floor} • {assignment.hostel_name}
              </p>
              <div className="progress-bar mt-md">
                <div
                  className="progress-fill progress-fill-cardinal"
                  style={{ width: `${(assignment.occupied / assignment.capacity) * 100}%` }}
                />
              </div>
              <p className="text-muted mt-sm" style={{ fontSize: '0.75rem' }}>
                {assignment.occupied}/{assignment.capacity} occupants
              </p>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              No room assigned yet. <Link to="/rooms" className="text-cardinal">Select a room →</Link>
            </p>
          )}
        </div>

        {/* Roommate Network */}
        <div className="glass-card-static">
          <div className="flex items-center justify-between mb-md">
            <h3>👥 Mutual Roommate</h3>
          </div>
          <div className="flex flex-col gap-sm" style={{ minHeight: '120px' }}>
            {roommateStatus?.activePartner ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Connected with <span className="text-cardinal">{roommateStatus.activePartner.partner_name}</span> ({roommateStatus.activePartner.partner_roll})
              </p>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Pending requests or active handshakes appear here.
              </p>
            )}
            {(roommateStatus?.incomingRequests?.length || 0) > 0 && (
              <div className="flex flex-col gap-sm">
                {roommateStatus.incomingRequests.map((request) => (
                  <div key={request.id} style={{ fontSize: '0.8rem' }}>
                    <span>{request.inviter_name} ({request.inviter_roll})</span>
                    <div className="flex gap-sm mt-sm">
                      <button className="btn btn-sm btn-cardinal" onClick={async () => {
                        await api.post('/roommates/respond', { pairingId: request.id, action: 'accept' });
                        await refreshRoommates();
                      }}>Accept</button>
                      <button className="btn btn-sm btn-ghost" onClick={async () => {
                        await api.post('/roommates/respond', { pairingId: request.id, action: 'reject' });
                        await refreshRoommates();
                      }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-sm mt-auto">
              <input
                type="text"
                className="form-input"
                placeholder="Roll Number"
                style={{ flex: 1, padding: '0.4rem' }}
                value={inviteRoll}
                onChange={(e) => setInviteRoll(e.target.value.toUpperCase())}
              />
              <button className="btn btn-sm btn-cardinal" onClick={async () => {
                try {
                  if (!inviteRoll) return;
                  await api.post('/roommates/invite', { rollNumber: inviteRoll });
                  setInviteRoll('');
                  await refreshRoommates();
                } catch(e) {
                  alert(e.response?.data?.error || 'Invitation failed.');
                }
              }}>Invite</button>
            </div>
            {(roommateStatus?.outgoingRequests?.length || 0) > 0 && (
              <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                Pending outgoing: {roommateStatus.outgoingRequests.map((r) => `${r.invitee_name} (${r.invitee_roll})`).join(', ')}
              </p>
            )}
            <p className="text-muted text-center" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Check <Link to="/survey-matches" className="text-cardinal">survey matches</Link> to find peers.
            </p>
          </div>
        </div>

        {/* Lottery Rank */}
        <div className="glass-card-static">
          <div className="flex items-center justify-between mb-md">
            <h3>🎲 Lottery</h3>
            {lottery ? (
              <span className="badge badge-success">Ranked</span>
            ) : (
              <span className="badge badge-cardinal">Pending</span>
            )}
          </div>
          {lottery ? (
            <div className="stat-card">
              <div className="stat-value">#{lottery.rank}</div>
              <div className="stat-label">Your Selection Priority</div>
              <p className="text-muted mt-md" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                Hash: {lottery.hash?.slice(0, 16)}...
              </p>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Lottery not generated yet. Check back later.
            </p>
          )}
        </div>
      </div>

      {/* Infrastructure Status */}
      {infra.length > 0 && (
        <div className="glass-card-static">
          <h3 className="mb-lg">🔌 Campus Infrastructure</h3>
          <div className="grid-4">
            {infra.map((block) => (
              <div key={block.id} style={{
                padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                background: 'rgba(15,14,13,0.4)', border: '1px solid var(--border)',
              }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                  {block.hostel_name.includes('MVHR') ? (
                    <Link to="/hostels/mvhr" className="text-cardinal" style={{ textDecoration: 'none' }}>
                      {block.hostel_name} <span style={{ fontSize: '0.7rem' }}>ℹ️</span>
                    </Link>
                  ) : (
                    block.hostel_name
                  )}
                </h4>
                <div className="flex items-center gap-sm mb-sm">
                  <span>📶</span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div
                      className={`progress-fill ${block.wifi_strength > 70 ? 'progress-fill-success' : 'progress-fill-cardinal'}`}
                      style={{ width: `${block.wifi_strength}%` }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--light-gray)' }}>
                    {block.wifi_strength}%
                  </span>
                </div>
                <div className="flex items-center gap-sm">
                  <span>⚡</span>
                  <span className={`badge ${block.power_status === 'on' ? 'badge-success' : 'badge-danger'}`}>
                    {block.power_status}
                  </span>
                  <span>💧</span>
                  <span className={`badge ${block.water_status === 'on' ? 'badge-success' : 'badge-danger'}`}>
                    {block.water_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSettings && <SettingsModal user={user} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
