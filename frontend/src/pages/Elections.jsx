import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Elections() {
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    try {
      const { data } = await api.get('/elections');
      setElections(data.elections);
    } catch (err) {
      console.error('Load elections error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async (electionId) => {
    try {
      const { data } = await api.get(`/elections/${electionId}/candidates`);
      setCandidates(data.candidates);
      setSelectedElection(electionId);
      
      const resultData = await api.get(`/elections/${electionId}/results`);
      setResults(resultData.data);
    } catch (err) {
      console.error('Load candidates error:', err);
    }
  };

  const handleVote = async (candidateId) => {
    try {
      await api.post('/elections/vote', {
        electionId: selectedElection,
        candidateId,
      });
      setVoted(true);
      loadCandidates(selectedElection);
    } catch (err) {
      const msg = err.response?.data?.error || 'Vote failed.';
      if (msg.includes('already voted')) setVoted(true);
      else alert(msg);
    }
  };

  if (loading) {
    return <div className="page container flex items-center justify-center"><div className="spinner" /></div>;
  }

  return (
    <div className="page container">
      <div className="mb-xl animate-slide-up">
        <h1>🗳️ Elections</h1>
        <p className="text-muted mt-sm">One-vote secure voting for block representatives & committees</p>
      </div>

      {!selectedElection ? (
        /* Election List */
        <div className="grid-2">
          {elections.length === 0 ? (
            <div className="glass-card-static text-center" style={{ gridColumn: '1/-1', padding: 'var(--space-3xl)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)', opacity: 0.5 }}>🗳️</div>
              <h3 className="text-muted">No Active Elections</h3>
              <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>Check back when elections are announced.</p>
            </div>
          ) : (
            elections.map((el) => (
              <div key={el.id} className="glass-card" onClick={() => loadCandidates(el.id)}>
                <div className="flex items-center justify-between mb-md">
                  <span className="badge badge-gold">{el.election_type}</span>
                  <span className={`badge ${el.is_active ? 'badge-success' : 'badge-cardinal'}`}>
                    {el.is_active ? 'Active' : 'Closed'}
                  </span>
                </div>
                <h3>{el.title}</h3>
                <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>{el.description}</p>
                <div className="flex items-center justify-between mt-lg">
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {el.candidate_count} candidates
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {el.total_votes} votes cast
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Candidate View */
        <div>
          <button className="btn btn-ghost mb-lg" onClick={() => { setSelectedElection(null); setVoted(false); }}>
            ← Back to Elections
          </button>

          {voted && (
            <div style={{
              background: 'rgba(45,138,78,0.1)', border: '1px solid rgba(45,138,78,0.3)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <p style={{ color: 'var(--success-light)', fontWeight: 600, marginTop: 'var(--space-sm)' }}>
                Your vote has been recorded!
              </p>
            </div>
          )}

          <div className="grid-2">
            {candidates.map((c) => {
              const voteCount = results?.results?.find((r) => r.id === c.id)?.vote_count || 0;
              const totalVotes = results?.results?.reduce((sum, r) => sum + parseInt(r.vote_count || 0), 0) || 1;
              const percentage = Math.round((voteCount / totalVotes) * 100);

              return (
                <div key={c.id} className="glass-card-static">
                  <div className="flex items-center gap-md mb-md">
                    <div style={{
                      width: 48, height: 48, borderRadius: 'var(--radius-full)',
                      background: 'linear-gradient(135deg, var(--cardinal) 0%, var(--cardinal-light) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', fontWeight: 700, color: 'white',
                    }}>
                      {c.name?.[0] || '?'}
                    </div>
                    <div>
                      <h4>{c.name}</h4>
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {c.roll_number} • {c.department} • Year {c.year}
                      </p>
                    </div>
                  </div>
                  {c.manifesto && (
                    <p className="text-muted mb-md" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                      "{c.manifesto}"
                    </p>
                  )}
                  <div className="progress-bar mb-sm">
                    <div className="progress-fill progress-fill-gold" style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {voteCount} votes ({percentage}%)
                    </span>
                    {!voted && (
                      <button className="btn btn-cardinal btn-sm" onClick={() => handleVote(c.id)}>
                        Vote
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
