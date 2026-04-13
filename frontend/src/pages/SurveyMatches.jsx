import { useEffect, useState } from 'react';
import api from '../services/api';

export default function SurveyMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const { data } = await api.get('/student/top-matches');
        setMatches(data.matches || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load survey matches right now.');
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
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
      <div className="mb-xl animate-slide-up">
        <h1>Survey <span className="text-cardinal">Matches</span></h1>
        <p className="text-muted mt-sm">
          Top 5 same-year students based on your personality survey compatibility.
        </p>
      </div>

      {error && (
        <div className="glass-card mb-lg">
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!error && matches.length === 0 && (
        <div className="glass-card">
          <p style={{ margin: 0 }}>No survey matches available yet.</p>
        </div>
      )}

      <div className="grid-2">
        {matches.map((match, index) => (
          <div key={match.id} className="glass-card">
            <div className="flex justify-between items-start mb-md">
              <div>
                <h3 style={{ margin: 0 }}>{match.name}</h3>
                <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>
                  {match.rollNumber} • {match.department}
                </p>
              </div>
              <span className="badge badge-success">#{index + 1}</span>
            </div>

            <div className="stat-card" style={{ padding: '1rem 0' }}>
              <div className="stat-value">{match.compatibilityScore}%</div>
              <div className="stat-label">Compatibility Score</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
