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

  const profileImageSrc = user.profileImageUrl
    ? (user.profileImageUrl.startsWith('http') ? user.profileImageUrl : `${import.meta.env.VITE_API_URL || ''}${user.profileImageUrl}`)
    : null;

  const quickActions = [
    { to: '/rooms', icon: '🏢', title: 'Room Selection', desc: 'Browse availability and lock in your preferred room.' },
    { to: '/survey', icon: '📋', title: 'Personality Survey', desc: 'Keep your roommate profile fresh for better matching.' },
    { to: '/outpass', icon: '🎫', title: 'QR Outpass', desc: 'Generate an exit pass in a few taps.' },
    { to: '/elections', icon: '🗳️', title: 'Elections', desc: 'Track campus votes and participate on time.' },
  ];

  const statCards = [
    { label: 'Room Status', value: assignment ? `${assignment.hostel_code} • ${assignment.room_number}` : 'Pending' },
    { label: 'Roommate', value: roommateStatus?.activePartner ? roommateStatus.activePartner.partner_name : 'Not matched yet' },
    { label: 'Lottery Rank', value: lottery ? `#${lottery.rank}` : 'Awaited' },
    { label: 'Survey Match', value: match ? `${match.partnerName}` : 'Explore matches' },
  ];

  return (
    <div className="page container dashboard-shell">
      <section className="dashboard-hero animate-slide-up">
        <div className="dashboard-hero-main">
          {profileImageSrc ? (
            <img src={profileImageSrc} alt="Profile" className="dashboard-avatar" />
          ) : (
            <div className="dashboard-avatar dashboard-avatar-fallback">{user.name?.[0] || 'S'}</div>
          )}

          <div className="dashboard-hero-copy">
            <p className="dashboard-kicker">Student Command Deck</p>
            <h1>Welcome back, <span className="text-cardinal">{user.name || 'Student'}</span></h1>
            <p className="text-muted">{user.rollNumber} • {user.department} • Year {user.yearGroup || user.year || 1}</p>
          </div>
        </div>

        <div className="dashboard-hero-side">
          <button className="btn btn-sm btn-ghost" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
          <Link to="/rooms" className="btn btn-cardinal">Open Room Portal</Link>
        </div>
      </section>

      <section className="grid-4 dashboard-stat-strip">
        {statCards.map((card) => (
          <div key={card.label} className="dashboard-stat-card">
            <div className="dashboard-stat-label">{card.label}</div>
            <div className="dashboard-stat-value">{card.value}</div>
          </div>
        ))}
      </section>

      {retention && retention.yearGroup >= 3 && retention.retentionWindowActive && retention.retentionStatus === 'none' && retention.previousRoom && (
        <section className="glass-card animate-fade-in dashboard-retention-banner">
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
                } catch (e) {}
              }}>Enter Wave Pool</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--accent-gold)', color: '#000' }}
                onClick={async () => {
                  try {
                    await api.post('/student/retention', { action: 'retain' });
                    window.location.reload();
                  } catch (e) {
                    alert('Error retaining room: ' + (e.response?.data?.error || e.message));
                  }
                }}
              >
                Retain Room {retention.previousRoom.room_number}
              </button>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="dashboard-section-head">
          <div>
            <h3>Quick Actions</h3>
            <p className="text-muted">Everything students usually need, without extra clicks.</p>
          </div>
        </div>
        <div className="grid-4">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} style={{ textDecoration: 'none' }}>
              <div className="glass-card dashboard-action-card">
                <div className="dashboard-action-icon">{action.icon}</div>
                <h4>{action.title}</h4>
                <p className="text-muted">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="dashboard-section-head">
          <div>
            <h3>Live Snapshot</h3>
            <p className="text-muted">Room, roommate, and lottery status at a glance.</p>
          </div>
        </div>

        <div className="grid-3">
          <div className="glass-card-static dashboard-panel">
            <div className="flex items-center justify-between mb-md">
              <h3>🏠 Room</h3>
              {assignment ? <span className="badge badge-success">Assigned</span> : <span className="badge badge-cardinal">Pending</span>}
            </div>

            {assignment ? (
              <div>
                <p className="dashboard-panel-primary">{assignment.hostel_code} — {assignment.room_number}</p>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Floor {assignment.floor} • {assignment.hostel_name}
                </p>
                <div className="progress-bar mt-md">
                  <div className="progress-fill progress-fill-cardinal" style={{ width: `${(assignment.occupied / assignment.capacity) * 100}%` }} />
                </div>
                <p className="text-muted mt-sm" style={{ fontSize: '0.75rem' }}>{assignment.occupied}/{assignment.capacity} occupants</p>
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                No room assigned yet. <Link to="/rooms" className="text-cardinal">Select a room →</Link>
              </p>
            )}
          </div>

          <div className="glass-card-static dashboard-panel">
            <div className="flex items-center justify-between mb-md">
              <h3>👥 Mutual Roommate</h3>
              <Link to="/survey-matches" className="text-cardinal" style={{ fontSize: '0.8rem' }}>Top 5 Matches</Link>
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
                    <div key={request.id} className="dashboard-request-card">
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
                  } catch (e) {
                    alert(e.response?.data?.error || 'Invitation failed.');
                  }
                }}>Invite</button>
              </div>

              {(roommateStatus?.outgoingRequests?.length || 0) > 0 && (
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Pending outgoing: {roommateStatus.outgoingRequests.map((r) => `${r.invitee_name} (${r.invitee_roll})`).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="glass-card-static dashboard-panel">
            <div className="flex items-center justify-between mb-md">
              <h3>🎲 Lottery</h3>
              {lottery ? <span className="badge badge-success">Ranked</span> : <span className="badge badge-cardinal">Pending</span>}
            </div>
            {lottery ? (
              <div className="stat-card dashboard-lottery-highlight">
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
      </section>

      {infra.length > 0 && (
        <section className="glass-card-static">
          <div className="dashboard-section-head dashboard-section-head-compact">
            <div>
              <h3>🔌 Campus Infrastructure</h3>
              <p className="text-muted">Live utility visibility across your hostel blocks.</p>
            </div>
          </div>

          <div className="grid-4">
            {infra.map((block) => (
              <div key={block.id} className="dashboard-infra-card">
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--light-gray)' }}>{block.wifi_strength}%</span>
                </div>
                <div className="flex items-center gap-sm">
                  <span>⚡</span>
                  <span className={`badge ${block.power_status === 'on' ? 'badge-success' : 'badge-danger'}`}>{block.power_status}</span>
                  <span>💧</span>
                  <span className={`badge ${block.water_status === 'on' ? 'badge-success' : 'badge-danger'}`}>{block.water_status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showSettings && <SettingsModal user={user} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
