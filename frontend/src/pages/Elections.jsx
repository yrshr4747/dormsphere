import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

export default function Elections() {
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const isAdmin = user.role === 'admin';
  const isStudent = user.role === 'student';

  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    electionType: 'block_rep',
    eligibleYearGroup: '',
    eligibleHostelCode: '',
    eligibleDepartment: '',
    minCgpa: '',
    nominationStart: '',
    nominationEnd: '',
    voteStart: '',
    voteEnd: '',
  });

  const [nominationForm, setNominationForm] = useState({
    cgpa: '',
    manifesto: '',
  });
  const [editForm, setEditForm] = useState({
    eligibleYearGroup: '',
    eligibleHostelCode: '',
    eligibleDepartment: '',
    minCgpa: '',
    nominationStart: '',
    nominationEnd: '',
    voteStart: '',
    voteEnd: '',
  });
  const [editingElectionId, setEditingElectionId] = useState('');

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    try {
      const { data } = await api.get('/elections');
      setElections(data.elections || []);
    } catch (err) {
      console.error('Load elections error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async (election) => {
    try {
      const { data } = await api.get(`/elections/${election.id}/candidates`);
      setCandidates(data.candidates || []);
      setSelectedElection(election);

      const resultData = await api.get(`/elections/${election.id}/results`);
      setResults(resultData.data);
      setMessage('');
      setEditingElectionId('');
      setEditForm({
        eligibleYearGroup: election.eligible_year_group || '',
        eligibleHostelCode: election.eligible_hostel_code || '',
        eligibleDepartment: election.eligible_department || '',
        minCgpa: election.min_cgpa || '',
        nominationStart: election.nomination_start ? new Date(election.nomination_start).toISOString().slice(0, 16) : '',
        nominationEnd: election.nomination_end ? new Date(election.nomination_end).toISOString().slice(0, 16) : '',
        voteStart: election.start_time ? new Date(election.start_time).toISOString().slice(0, 16) : '',
        voteEnd: election.end_time ? new Date(election.end_time).toISOString().slice(0, 16) : '',
      });
    } catch (err) {
      console.error('Load candidates error:', err);
    }
  };

  const refreshSelectedElection = async (electionId) => {
    const { data } = await api.get('/elections');
    const nextElection = (data.elections || []).find((e) => e.id === electionId) || null;
    setElections(data.elections || []);
    if (nextElection) {
      await loadCandidates(nextElection);
    }
  };

  const handleCreateElection = async (e) => {
    e.preventDefault();
    try {
      await api.post('/elections', createForm);
      setCreateForm({
        title: '',
        description: '',
        electionType: 'block_rep',
        eligibleYearGroup: '',
        eligibleHostelCode: '',
        eligibleDepartment: '',
        minCgpa: '',
        nominationStart: '',
        nominationEnd: '',
        voteStart: '',
        voteEnd: '',
      });
      setMessage('Election created successfully.');
      loadElections();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create election.');
    }
  };

  const handleNominate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/elections/${selectedElection.id}/nominate`, nominationForm);
      setNominationForm({ cgpa: '', manifesto: '' });
      setMessage('Nomination submitted successfully.');
      refreshSelectedElection(selectedElection.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Nomination failed.');
    }
  };

  const handleVote = async (candidateId) => {
    try {
      await api.post('/elections/vote', {
        electionId: selectedElection.id,
        candidateId,
      });
      setMessage('Your vote has been recorded.');
      refreshSelectedElection(selectedElection.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Vote failed.');
    }
  };

  const handleUpdateTimings = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/elections/${selectedElectionMeta.id}`, editForm);
      setMessage('Election timings updated successfully.');
      setEditingElectionId('');
      refreshSelectedElection(selectedElectionMeta.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update election.');
    }
  };

  const handleDeleteElection = async () => {
    if (!window.confirm('Delete this election and all its nominations/votes?')) return;
    try {
      await api.delete(`/elections/${selectedElectionMeta.id}`);
      setMessage('Election deleted successfully.');
      setSelectedElection(null);
      setCandidates([]);
      setResults(null);
      loadElections();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete election.');
    }
  };

  const selectedElectionMeta = useMemo(
    () => elections.find((e) => e.id === selectedElection?.id) || selectedElection,
    [elections, selectedElection],
  );

  const phaseColors = {
    nomination: 'badge-gold',
    voting: 'badge-success',
    upcoming: 'badge-cardinal',
    closed: 'badge-danger',
  };

  if (loading) {
    return <div className="page container flex items-center justify-center"><div className="spinner" /></div>;
  }

  return (
    <div className="page container">
      <div className="mb-xl animate-slide-up">
        <h1>🗳️ Elections</h1>
        <p className="text-muted mt-sm">
          {isAdmin ? 'Create elections and control nomination and voting windows.' : 'File nominations during nomination windows and vote once during the official voting window.'}
        </p>
      </div>

      {isAdmin && (
        <div className="glass-card-static mb-xl">
          <div className="flex items-center justify-between mb-lg">
            <h3>Create New Election</h3>
            {message && <span className="badge badge-success">{message}</span>}
          </div>

          <form onSubmit={handleCreateElection}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Election Type</label>
                <select className="form-input" value={createForm.electionType} onChange={(e) => setCreateForm({ ...createForm, electionType: e.target.value })}>
                  <option value="block_rep">Block Representative</option>
                  <option value="mess_committee">Mess Committee</option>
                  <option value="cultural">Cultural</option>
                  <option value="sports">Sports</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows="3" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Eligible Year Group</label>
                <select className="form-input" value={createForm.eligibleYearGroup} onChange={(e) => setCreateForm({ ...createForm, eligibleYearGroup: e.target.value })}>
                  <option value="">All Years</option>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                  <option value="5">Year 5</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Eligible Hostel</label>
                <select className="form-input" value={createForm.eligibleHostelCode} onChange={(e) => setCreateForm({ ...createForm, eligibleHostelCode: e.target.value })}>
                  <option value="">All Hostels</option>
                  <option value="MVHR-A">MVHR-A</option>
                  <option value="MVHR-B">MVHR-B</option>
                  <option value="MVHR-C">MVHR-C</option>
                  <option value="MVHR-D">MVHR-D</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Eligible Department</label>
                <select className="form-input" value={createForm.eligibleDepartment} onChange={(e) => setCreateForm({ ...createForm, eligibleDepartment: e.target.value })}>
                  <option value="">All Departments</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Artificial Intelligence & Data Science">Artificial Intelligence & Data Science</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Minimum CGPA</label>
                <input type="number" className="form-input" min="0" max="10" step="0.01" value={createForm.minCgpa} onChange={(e) => setCreateForm({ ...createForm, minCgpa: e.target.value })} placeholder="Optional" />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nomination Start</label>
                <input type="datetime-local" className="form-input" value={createForm.nominationStart} onChange={(e) => setCreateForm({ ...createForm, nominationStart: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nomination End</label>
                <input type="datetime-local" className="form-input" value={createForm.nominationEnd} onChange={(e) => setCreateForm({ ...createForm, nominationEnd: e.target.value })} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Voting Start</label>
                <input type="datetime-local" className="form-input" value={createForm.voteStart} onChange={(e) => setCreateForm({ ...createForm, voteStart: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Voting End</label>
                <input type="datetime-local" className="form-input" value={createForm.voteEnd} onChange={(e) => setCreateForm({ ...createForm, voteEnd: e.target.value })} required />
              </div>
            </div>

            <button className="btn btn-cardinal">Create Election</button>
          </form>
        </div>
      )}

      {!selectedElectionMeta ? (
        <div className="grid-2">
          {elections.length === 0 ? (
            <div className="glass-card-static text-center" style={{ gridColumn: '1/-1', padding: 'var(--space-3xl)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)', opacity: 0.5 }}>🗳️</div>
              <h3 className="text-muted">No Elections Yet</h3>
              <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>Admins can create a new election when needed.</p>
            </div>
          ) : (
            elections.map((el) => (
              <div key={el.id} className="glass-card" onClick={() => loadCandidates(el)} style={{ cursor: 'pointer' }}>
                <div className="flex items-center justify-between mb-md">
                  <span className="badge badge-gold">{el.election_type}</span>
                  <span className={`badge ${phaseColors[el.phase] || 'badge-cardinal'}`}>{el.phase}</span>
                </div>
                <h3>{el.title}</h3>
                <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>{el.description}</p>
                <div className="mt-md text-muted" style={{ fontSize: '0.8rem' }}>
                  {el.nomination_start && <div>Nomination: {new Date(el.nomination_start).toLocaleString()} to {new Date(el.nomination_end).toLocaleString()}</div>}
                  <div>Voting: {new Date(el.start_time).toLocaleString()} to {new Date(el.end_time).toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between mt-lg">
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{el.candidate_count} nominations</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{el.total_votes} votes cast</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          <button className="btn btn-ghost mb-lg" onClick={() => { setSelectedElection(null); setCandidates([]); setResults(null); setMessage(''); }}>
            ← Back to Elections
          </button>

          <div className="glass-card-static mb-xl">
            <div className="flex items-center justify-between mb-md">
              <div>
                <h3>{selectedElectionMeta.title}</h3>
                <p className="text-muted mt-sm">{selectedElectionMeta.description}</p>
              </div>
              <div className="flex gap-sm items-center">
                <span className={`badge ${phaseColors[selectedElectionMeta.phase] || 'badge-cardinal'}`}>{selectedElectionMeta.phase}</span>
                {isAdmin && (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingElectionId(selectedElectionMeta.id)}>
                      Edit Timings
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={handleDeleteElection}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid-2">
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                {(selectedElectionMeta.eligible_year_group || selectedElectionMeta.eligible_hostel_code || selectedElectionMeta.eligible_department || selectedElectionMeta.min_cgpa) && (
                  <p>
                    Eligibility:
                    {selectedElectionMeta.eligible_year_group ? ` Year ${selectedElectionMeta.eligible_year_group}` : ' All years'}
                    {selectedElectionMeta.eligible_hostel_code ? ` • ${selectedElectionMeta.eligible_hostel_code}` : ''}
                    {selectedElectionMeta.eligible_department ? ` • ${selectedElectionMeta.eligible_department}` : ''}
                    {selectedElectionMeta.min_cgpa ? ` • Min CGPA ${selectedElectionMeta.min_cgpa}` : ''}
                  </p>
                )}
                {selectedElectionMeta.nomination_start && (
                  <p>Nomination Window: {new Date(selectedElectionMeta.nomination_start).toLocaleString()} to {new Date(selectedElectionMeta.nomination_end).toLocaleString()}</p>
                )}
                <p>Voting Window: {new Date(selectedElectionMeta.start_time).toLocaleString()} to {new Date(selectedElectionMeta.end_time).toLocaleString()}</p>
              </div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                <p>{selectedElectionMeta.candidate_count} candidates</p>
                <p>{selectedElectionMeta.total_votes} votes cast</p>
              </div>
            </div>
          </div>

          {isAdmin && editingElectionId === selectedElectionMeta.id && (
            <div className="glass-card-static mb-xl">
              <h3 className="mb-lg">Update Election Timings</h3>
              <form onSubmit={handleUpdateTimings}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Eligible Year Group</label>
                    <select className="form-input" value={editForm.eligibleYearGroup} onChange={(e) => setEditForm({ ...editForm, eligibleYearGroup: e.target.value })}>
                      <option value="">All Years</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                      <option value="5">Year 5</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Eligible Hostel</label>
                    <select className="form-input" value={editForm.eligibleHostelCode} onChange={(e) => setEditForm({ ...editForm, eligibleHostelCode: e.target.value })}>
                      <option value="">All Hostels</option>
                      <option value="MVHR-A">MVHR-A</option>
                      <option value="MVHR-B">MVHR-B</option>
                      <option value="MVHR-C">MVHR-C</option>
                      <option value="MVHR-D">MVHR-D</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Eligible Department</label>
                    <select className="form-input" value={editForm.eligibleDepartment} onChange={(e) => setEditForm({ ...editForm, eligibleDepartment: e.target.value })}>
                      <option value="">All Departments</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Electronics & Communication">Electronics & Communication</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Artificial Intelligence & Data Science">Artificial Intelligence & Data Science</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minimum CGPA</label>
                    <input type="number" className="form-input" min="0" max="10" step="0.01" value={editForm.minCgpa} onChange={(e) => setEditForm({ ...editForm, minCgpa: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Nomination Start</label>
                    <input type="datetime-local" className="form-input" value={editForm.nominationStart} onChange={(e) => setEditForm({ ...editForm, nominationStart: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nomination End</label>
                    <input type="datetime-local" className="form-input" value={editForm.nominationEnd} onChange={(e) => setEditForm({ ...editForm, nominationEnd: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Voting Start</label>
                    <input type="datetime-local" className="form-input" value={editForm.voteStart} onChange={(e) => setEditForm({ ...editForm, voteStart: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Voting End</label>
                    <input type="datetime-local" className="form-input" value={editForm.voteEnd} onChange={(e) => setEditForm({ ...editForm, voteEnd: e.target.value })} required />
                  </div>
                </div>
                <div className="flex gap-sm">
                  <button className="btn btn-cardinal">Save Timings</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditingElectionId('')}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {message && (
            <div className="glass-card-static mb-xl" style={{ border: '1px solid rgba(45,138,78,0.35)' }}>
              <p className="text-success" style={{ margin: 0 }}>{message}</p>
            </div>
          )}

          {isStudent && selectedElectionMeta.phase === 'nomination' && !selectedElectionMeta.has_nominated && (
            <div className="glass-card-static mb-xl">
              <h3 className="mb-lg">File Nomination</h3>
              <div className="mb-md text-muted" style={{ fontSize: '0.85rem' }}>
                <p>{user.name} • {user.rollNumber}</p>
                <p>{user.department}</p>
              </div>
              <form onSubmit={handleNominate}>
                <div className="form-group">
                  <label className="form-label">CGPA</label>
                  <input className="form-input" type="number" min="0" max="10" step="0.01" value={nominationForm.cgpa} onChange={(e) => setNominationForm({ ...nominationForm, cgpa: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Manifesto</label>
                  <textarea className="form-input" rows="4" value={nominationForm.manifesto} onChange={(e) => setNominationForm({ ...nominationForm, manifesto: e.target.value })} required />
                </div>
                <button className="btn btn-cardinal">Submit Nomination</button>
              </form>
            </div>
          )}

          {isStudent && selectedElectionMeta.phase === 'nomination' && selectedElectionMeta.has_nominated && (
            <div className="glass-card-static mb-xl">
              <p className="text-success" style={{ margin: 0 }}>You have already filed your nomination for this election.</p>
            </div>
          )}

          <div className="grid-2">
            {candidates.map((c) => {
              const voteCount = results?.results?.find((r) => r.id === c.id)?.vote_count || 0;
              const totalVotes = results?.results?.reduce((sum, r) => sum + parseInt(r.vote_count || 0, 10), 0) || 1;
              const percentage = Math.round((voteCount / totalVotes) * 100);
              const canVote = isStudent && selectedElectionMeta.phase === 'voting' && !selectedElectionMeta.has_voted;

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
                        {c.roll_number} • {c.department} • Year {c.year_group || c.year}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted mb-sm" style={{ fontSize: '0.82rem' }}>CGPA: {c.cgpa ?? 'N/A'}</p>
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
                    {canVote && (
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
