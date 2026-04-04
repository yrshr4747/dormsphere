import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

export default function Outpass() {
  const [outpasses, setOutpasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [form, setForm] = useState({
    purpose: '',
    destination: '',
    outTime: '',
    expectedReturn: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOutpasses();
  }, []);

  const loadOutpasses = async () => {
    try {
      const { data } = await api.get('/outpass/my');
      setOutpasses(data.outpasses);
    } catch (err) {
      console.error('Load outpasses error:', err);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/outpass/generate', form);
      setQrData(data.qrPayload);
      setShowForm(false);
      setForm({ purpose: '', destination: '', outTime: '', expectedReturn: '' });
      loadOutpasses();
    } catch (err) {
      console.error('Generate error:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    active: 'badge-success',
    used: 'badge-gold',
    expired: 'badge-danger',
    cancelled: 'badge-cardinal',
  };

  return (
    <div className="page container">
      <div className="flex items-center justify-between mb-xl animate-slide-up">
        <div>
          <h1>Digital QR Outpass</h1>
          <p className="text-muted mt-sm">Cryptographically signed entry/exit passes</p>
        </div>
        <button className="btn btn-cardinal" onClick={() => { setShowForm(!showForm); setQrData(null); }}>
          {showForm ? 'Cancel' : '+ Generate Outpass'}
        </button>
      </div>

      {/* QR Display */}
      {qrData && (
        <div className="glass-card-static text-center mb-xl animate-slide-up">
          <h3 className="mb-lg">Your Outpass QR Code</h3>
          <div style={{
            background: 'white', display: 'inline-block', padding: 'var(--space-lg)',
            borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
          }}>
            <QRCodeSVG value={qrData} size={220} level="H" />
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            Show this QR code to the guard at the gate<br />
            HMAC-SHA256 signed • Tamper-proof
          </p>
          <button className="btn btn-ghost btn-sm mt-md" onClick={() => setQrData(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Generation Form */}
      {showForm && (
        <div className="glass-card-static mb-xl animate-slide-up" style={{ maxWidth: 560 }}>
          <h3 className="mb-lg">New Outpass</h3>
          <form onSubmit={handleGenerate}>
            <div className="form-group">
              <label className="form-label">Purpose</label>
              <input className="form-input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g., Medical appointment" required />
            </div>
            <div className="form-group">
              <label className="form-label">Destination</label>
              <input className="form-input" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g., Chennai Hospital" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Out Time</label>
                <input className="form-input" type="datetime-local" value={form.outTime} onChange={(e) => setForm({ ...form, outTime: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Return</label>
                <input className="form-input" type="datetime-local" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} required />
              </div>
            </div>
            <button className="btn btn-cardinal w-full" disabled={loading}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : '🔐 Generate Signed QR Outpass'}
            </button>
          </form>
        </div>
      )}

      {/* Outpass History */}
      <div className="glass-card-static">
        <h3 className="mb-lg">Outpass History</h3>
        {outpasses.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: 'var(--space-xl)' }}>
            No outpasses generated yet.
          </p>
        ) : (
          <div className="flex flex-col gap-md">
            {outpasses.map((op) => (
              <div key={op.id} style={{
                padding: 'var(--space-md) var(--space-lg)', borderRadius: 'var(--radius-md)',
                background: 'rgba(15,14,13,0.4)', border: '1px solid var(--border)',
              }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontWeight: 600 }}>{op.purpose}</p>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {op.destination && `${op.destination} • `}
                      {new Date(op.out_time).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`badge ${statusColors[op.status] || 'badge-cardinal'}`}>
                    {op.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
