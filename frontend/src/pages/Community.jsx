import { useState, useEffect } from 'react';
import api from '../services/api';
import useSocket from '../hooks/useSocket';

export default function Community() {
  const [activeTab, setActiveTab] = useState('grievances'); // 'grievances' or 'lostfound'
  
  // Grievance State
  const [grievances, setGrievances] = useState([]);
  const [showGrievanceForm, setShowGrievanceForm] = useState(false);
  const [gForm, setGForm] = useState({ title: '', description: '', category: 'General', anonymous: false });

  // Lost & Found State
  const [items, setItems] = useState([]);
  const [showLFForm, setShowLFForm] = useState(false);
  const [lfForm, setLFForm] = useState({ itemType: 'lost', title: '', description: '', location: '', image: null });

  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const socket = useSocket();

  useEffect(() => {
    fetchGrievances();
    fetchLostFound();

    if (socket) {
      socket.on('grievance:upvote', ({ grievanceId, upvotes }) => {
        setGrievances(prev => prev.map(g => g.id === grievanceId ? { ...g, upvotes } : g));
      });
      socket.on('grievance:resolved', ({ grievanceId }) => {
        setGrievances(prev => prev.map(g => g.id === grievanceId ? { ...g, status: 'resolved' } : g));
      });
    }

    return () => {
      if (socket) {
        socket.off('grievance:upvote');
        socket.off('grievance:resolved');
      }
    };
  }, [socket]);

  const fetchGrievances = async () => {
    try {
      const { data } = await api.get('/community/grievances');
      setGrievances(data.grievances);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLostFound = async () => {
    try {
      const { data } = await api.get('/community/lost-found');
      setItems(data.items);
    } catch (err) {
      console.error(err);
    }
  };

  // Actions
  const handleGrievanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/community/grievances', gForm);
      setShowGrievanceForm(false);
      setGForm({ title: '', description: '', category: 'General', anonymous: false });
      fetchGrievances();
    } catch (err) {
      alert('Failed to post grievance');
    }
  };

  const handleUpvote = async (id, e) => {
    e.stopPropagation();
    try {
      const { data } = await api.post(`/community/grievances/${id}/upvote`);
      setGrievances(prev => prev.map(g => 
        g.id === id ? { ...g, has_upvoted: data.upvoted, upvotes: data.upvotes } : g
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminResolveGrievance = async (id) => {
    if (user.role !== 'admin' && user.role !== 'warden') return;
    try {
      await api.patch(`/community/grievances/${id}/resolve`);
    } catch (err) {
      alert('Failed to resolve');
    }
  };

  const handleLFSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('itemType', lfForm.itemType);
    formData.append('title', lfForm.title);
    formData.append('description', lfForm.description);
    formData.append('location', lfForm.location);
    if (lfForm.image) {
      formData.append('image', lfForm.image);
    }

    try {
      await api.post('/community/lost-found', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowLFForm(false);
      setLFForm({ itemType: 'lost', title: '', description: '', location: '', image: null });
      fetchLostFound();
    } catch (err) {
      alert('Failed to post item');
    }
  };

  const handleResolveLF = async (id) => {
    try {
      await api.patch(`/community/lost-found/${id}/resolve`);
      fetchLostFound();
    } catch (err) {
      alert('Failed to claim/resolve item. ' + (err.response?.data?.error || ''));
    }
  };

  return (
    <div className="page container">
      <div className="flex justify-between items-center mb-xl animate-slide-up">
        <h1>Community <span className="text-cardinal">Forum</span></h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${activeTab === 'grievances' ? '' : 'btn-ghost'}`}
            onClick={() => setActiveTab('grievances')}
          >
            📢 Public Grievances
          </button>
          <button 
            className={`btn ${activeTab === 'lostfound' ? '' : 'btn-ghost'}`}
            onClick={() => setActiveTab('lostfound')}
          >
            🔍 Lost & Found
          </button>
        </div>
      </div>

      {activeTab === 'grievances' && (
        <div className="animate-slide-up">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-gold">Campus Grievances</h3>
            <button className="btn btn-outline" onClick={() => setShowGrievanceForm(!showGrievanceForm)}>
              + Write Grievance
            </button>
          </div>

          {showGrievanceForm && (
            <div className="glass-card mb-lg animate-slide-up">
              <h4>New Grievance</h4>
              <form onSubmit={handleGrievanceSubmit}>
                <div className="grid-2 my-md">
                  <div>
                    <label className="form-label">Title</label>
                    <input type="text" className="form-input" required 
                           value={gForm.title} onChange={e => setGForm({...gForm, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="form-label">Category</label>
                    <select className="form-input" value={gForm.category} onChange={e => setGForm({...gForm, category: e.target.value})}>
                      <option>Maintenance</option>
                      <option>Mess & Food</option>
                      <option>Network/Wi-Fi</option>
                      <option>Housekeeping</option>
                      <option>General</option>
                    </select>
                  </div>
                </div>
                <div className="mb-md">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" required rows="3"
                            value={gForm.description} onChange={e => setGForm({...gForm, description: e.target.value})}></textarea>
                </div>
                <div className="mb-md flex items-center gap-sm">
                  <input type="checkbox" id="anon" checked={gForm.anonymous} onChange={e => setGForm({...gForm, anonymous: e.target.checked})} />
                  <label htmlFor="anon" className="text-muted">Post Anonymously (Only Admins can see your ID)</label>
                </div>
                <button type="submit" className="btn btn-block">Post to Community</button>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {grievances.length === 0 && <p className="text-muted">No grievances reported yet.</p>}
            {grievances.map(g => (
              <div key={g.id} className="glass-card flex items-start gap-md" style={{ borderLeft: g.status === 'resolved' ? '4px solid var(--success)' : '4px solid var(--cardinal)' }}>
                <div className="text-center" style={{ minWidth: '60px' }}>
                  <button 
                    className="btn btn-sm" 
                    style={{ background: g.has_upvoted ? 'var(--cardinal)' : 'rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem 0.5rem', width: '100%', marginBottom: '0.25rem' }}
                    onClick={(e) => handleUpvote(g.id, e)}
                  >
                    ⇧
                  </button>
                  <strong style={{ fontSize: '1.2rem' }}>{g.upvotes}</strong>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex justify-between items-start">
                    <h3 style={{ margin: 0 }}>{g.title}</h3>
                    {g.status === 'resolved' ? (
                      <span className="badge badge-success">✅ Resolved</span>
                    ) : (
                      <span className="badge badge-danger">Pending</span>
                    )}
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
                    {g.category} • Posted by {g.author_name} ({g.author_dept}) on {new Date(g.created_at).toLocaleDateString()}
                  </p>
                  <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{g.description}</p>
                  
                  {user.role === 'admin' && g.status !== 'resolved' && (
                    <button className="btn btn-sm btn-success mt-md" onClick={() => handleAdminResolveGrievance(g.id)}>
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'lostfound' && (
        <div className="animate-slide-up">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-gold">Lost & Found</h3>
            <button className="btn btn-outline" onClick={() => setShowLFForm(!showLFForm)}>
              + Report Item
            </button>
          </div>

          {showLFForm && (
            <div className="glass-card mb-lg animate-slide-up">
              <h4>Report Lost or Found Item</h4>
              <form onSubmit={handleLFSubmit}>
                <div className="grid-2 my-md">
                  <div>
                    <label className="form-label">I have...</label>
                    <select className="form-input" value={lfForm.itemType} onChange={e => setLFForm({...lfForm, itemType: e.target.value})}>
                      <option value="lost">Lost an item</option>
                      <option value="found">Found an item</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Item Title</label>
                    <input type="text" className="form-input" required placeholder="e.g. Blue Umbrella"
                           value={lfForm.title} onChange={e => setLFForm({...lfForm, title: e.target.value})} />
                  </div>
                </div>
                <div className="grid-2 my-md">
                  <div>
                    <label className="form-label">Location (where lost/found)</label>
                    <input type="text" className="form-input" placeholder="e.g. MVHR Library"
                           value={lfForm.location} onChange={e => setLFForm({...lfForm, location: e.target.value})} />
                  </div>
                  <div>
                    <label className="form-label">Image (optional)</label>
                    <input type="file" className="form-input" accept="image/*"
                           onChange={e => setLFForm({...lfForm, image: e.target.files[0]})} />
                  </div>
                </div>
                <div className="mb-md">
                  <label className="form-label">Description & Contact Info</label>
                  <textarea className="form-input" required rows="2" placeholder="Details about the item..."
                            value={lfForm.description} onChange={e => setLFForm({...lfForm, description: e.target.value})}></textarea>
                </div>
                <button type="submit" className="btn btn-block">Post to Board</button>
              </form>
            </div>
          )}

          <div className="grid-3">
            {items.length === 0 && <p className="text-muted">No items reported.</p>}
            {items.map(item => (
              <div key={item.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {item.image_url ? (
                  <div style={{ width: '100%', height: '200px', backgroundColor: '#222' }}>
                    <img src={item.image_url} alt="Item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '150px', background: 'var(--cardinal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '3rem', opacity: 0.5 }}>{item.item_type === 'lost' ? '❓' : '💡'}</span>
                  </div>
                )}
                <div style={{ padding: 'var(--space-md)' }}>
                  <div className="flex justify-between items-center mb-sm">
                    <span className={`badge ${item.item_type === 'lost' ? 'badge-danger' : 'badge-gold'}`}>
                      {item.item_type.toUpperCase()}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 var(--space-xs) 0' }}>{item.title}</h4>
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                    📍 {item.location || 'Unknown'}
                  </p>
                  <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-md)', whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </p>
                  <div className="flex items-center gap-sm mb-md" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.reporter_name?.[0]}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 'bold' }}>{item.reporter_name}</div>
                      <div className="text-muted">{item.reporter_roll}</div>
                    </div>
                  </div>
                  
                  {item.status === 'resolved' ? (
                    <button className="btn btn-block btn-sm" disabled style={{ background: 'var(--success)' }}>Item Resolved / Returned</button>
                  ) : (
                    <button 
                      className="btn btn-block btn-sm btn-outline" 
                      onClick={() => handleResolveLF(item.id)}
                    >
                      {item.reported_by === user.id ? 'Mark as Resolved' : 'I claim this / Contact Finder'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
