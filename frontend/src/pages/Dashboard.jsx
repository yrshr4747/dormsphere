import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const [assignment, setAssignment] = useState(null);
  const [match, setMatch] = useState(null);
  const [lottery, setLottery] = useState(null);
  const [infra, setInfra] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/student/assignment'),
      api.get('/student/match'),
      api.get('/lottery/rank'),
      api.get('/infra/status'),
    ]).then(([aRes, mRes, lRes, iRes]) => {
      if (aRes.status === 'fulfilled') setAssignment(aRes.value.data.assignment);
      if (mRes.status === 'fulfilled') setMatch(mRes.value.data.match);
      if (lRes.status === 'fulfilled') setLottery(lRes.value.data.lottery);
      if (iRes.status === 'fulfilled') setInfra(iRes.value.data.infrastructure || []);
      setLoading(false);
    });
  }, []);

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
      <div className="mb-xl animate-slide-up" style={{ padding: '2rem 0', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: '2.5rem' }}>Welcome, <span className="text-sapphire">{user.name || 'Student'}</span></h1>
        <p className="text-muted mt-sm" style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {user.rollNumber} • {user.department} • YEAR {user.year}
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid-4 mb-xl">
        <Link to="/rooms" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ animationDelay: '0.1s', padding: 'var(--space-lg)' }}>
            <h4 style={{ margin: 0 }}>Room Selection</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Browse & book rooms
            </p>
          </div>
        </Link>
        <Link to="/survey" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ padding: 'var(--space-lg)' }}>
            <h4 style={{ margin: 0 }}>Personality Survey</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Find your ideal roommate
            </p>
          </div>
        </Link>
        <Link to="/outpass" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ padding: 'var(--space-lg)' }}>
            <h4 style={{ margin: 0 }}>QR Outpass</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
              Generate digital pass
            </p>
          </div>
        </Link>
        <Link to="/elections" style={{ textDecoration: 'none' }}>
          <div className="glass-card text-center" style={{ padding: 'var(--space-lg)' }}>
            <h4 style={{ margin: 0 }}>Elections</h4>
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
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Housing Assignment</h3>
            {assignment ? (
              <span className="badge badge-success">Assigned</span>
            ) : (
              <span className="badge badge-cardinal">Pending</span>
            )}
          </div>
          {assignment ? (
            <div>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--sapphire)' }}>
                {assignment.hostel_code} — {assignment.room_number}
              </p>
              <p className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Floor {assignment.floor} • {assignment.hostel_name}
              </p>
              <div className="progress-bar mt-md">
                <div
                  className="progress-fill progress-fill-cardinal"
                  style={{ width: `${(assignment.occupied / assignment.capacity) * 100}%` }}
                />
              </div>
              <p className="text-muted mt-sm" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                {assignment.occupied}/{assignment.capacity} occupants
              </p>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              No room assigned yet. <Link to="/rooms" className="text-sapphire" style={{ fontWeight: 600 }}>Select a room →</Link>
            </p>
          )}
        </div>

        {/* Roommate Match */}
        <div className="glass-card-static">
          <div className="flex items-center justify-between mb-md">
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Roommate Match</h3>
            {match ? (
              <span className="badge badge-gold">{match.compatibilityScore}% Compatible</span>
            ) : (
              <span className="badge badge-cardinal">No Match</span>
            )}
          </div>
          {match ? (
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{match.partnerName}</p>
              <p className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{match.partnerRoll}</p>
              <div className="progress-bar mt-md">
                <div
                  className="progress-fill progress-fill-gold"
                  style={{ width: `${match.compatibilityScore}%` }}
                />
              </div>
              <p className="text-muted mt-sm" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                Compatibility Score: {match.compatibilityScore}%
              </p>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Complete the <Link to="/survey" className="text-sapphire" style={{ fontWeight: 600 }}>personality survey →</Link>
            </p>
          )}
        </div>

        {/* Lottery Rank */}
        <div className="glass-card-static">
          <div className="flex items-center justify-between mb-md">
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Draw Lottery</h3>
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
              <p className="text-muted mt-md" style={{ fontSize: '0.7rem', wordBreak: 'break-all', opacity: 0.6 }}>
                Verification: {lottery.hash?.slice(0, 16)}...
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
          <h3 className="mb-lg" style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Campus Infrastructure</h3>
          <div className="grid-4">
            {infra.map((block) => (
              <div key={block.id} style={{
                padding: 'var(--space-md)', borderRadius: '0px',
                background: '#F8F9FA', border: '1px solid var(--border)',
              }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                  {block.hostel_name}
                </h4>
                <div className="flex items-center gap-sm mb-sm">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, width: '40px' }}>WIFI</span>
                  <div className="progress-bar" style={{ flex: 1, height: '4px' }}>
                    <div
                      className={`progress-fill ${block.wifi_strength > 70 ? 'progress-fill-success' : 'progress-fill-cardinal'}`}
                      style={{ width: `${block.wifi_strength}%` }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {block.wifi_strength}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>PWR</span>
                    <span className={`badge ${block.power_status === 'on' ? 'badge-success' : 'badge-danger'}`}>
                      {block.power_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>WTR</span>
                    <span className={`badge ${block.water_status === 'on' ? 'badge-success' : 'badge-danger'}`}>
                      {block.water_status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
