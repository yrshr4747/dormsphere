import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function MediaPortal() {
  const [media, setMedia] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [uploadModal, setUploadModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadBlock, setUploadBlock] = useState('MVHR-A');
  const [uploadType, setUploadType] = useState('photo');
  const [preview, setPreview] = useState(null);

  const blocks = ['all', 'MVHR-A', 'MVHR-B', 'MVHR-C', 'MVHR-D'];
  const blockColors = {
    'MVHR-A': '#8C1515',
    'MVHR-B': '#D4A843',
    'MVHR-C': '#2D8A4E',
    'MVHR-D': '#3B82F6',
  };

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      const params = selectedBlock !== 'all' ? { hostel: selectedBlock } : {};
      const res = await api.get('/media', { params });
      setMedia(res.data.media || []);
    } catch (err) {
      console.error('Failed to fetch media:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBlock]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // File preview
  useEffect(() => {
    if (!uploadFile) { setPreview(null); return; }
    const url = URL.createObjectURL(uploadFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  const handleUpload = async () => {
    if (!uploadFile) { setError('Please select a file.'); return; }
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('hostelCode', uploadBlock);
    formData.append('caption', uploadCaption);
    formData.append('mediaType', uploadType);

    try {
      await api.post('/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadModal(false);
      setUploadFile(null);
      setUploadCaption('');
      setPreview(null);
      fetchMedia();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this media?')) return;
    try {
      await api.delete(`/media/${id}`);
      fetchMedia();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="page container">
      <div className="flex items-center justify-between mb-xl animate-slide-up">
        <div>
          <h1>📸 Media Portal</h1>
          <p className="text-muted mt-sm">Block-specific photo galleries & community videos</p>
        </div>
        <button className="btn btn-cardinal" onClick={() => setUploadModal(true)}>
          📤 Upload Media
        </button>
      </div>

      {/* Block Filter */}
      <div className="flex gap-sm mb-xl" style={{ flexWrap: 'wrap' }}>
        {blocks.map((b) => (
          <button
            key={b}
            className={`btn btn-sm ${selectedBlock === b ? 'btn-cardinal' : 'btn-ghost'}`}
            onClick={() => setSelectedBlock(b)}
          >
            {b === 'all' ? '🏠 All Blocks' : `🏢 ${b}`}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="text-muted">Loading media...</div>
        </div>
      ) : (
        <div className="grid-3">
          {media.map((item) => {
            const color = blockColors[item.hostel_code] || '#8C1515';
            return (
              <div key={item.id} className="glass-card" style={{ overflow: 'hidden', position: 'relative' }}>
                {/* Thumbnail */}
                <div style={{
                  height: 200, borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)',
                  overflow: 'hidden', position: 'relative',
                  background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
                }}>
                  {item.media_type === 'photo' ? (
                    <img
                      src={item.url}
                      alt={item.caption || 'Media'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={item.url}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      controls
                      preload="metadata"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between mb-sm">
                  <span className="badge badge-gold">{item.hostel_code || 'General'}</span>
                  <span className="badge badge-cardinal">{item.media_type}</span>
                </div>
                {item.caption && (
                  <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xs)' }}>{item.caption}</p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {item.uploaded_by_name} • {formatDate(item.created_at)}
                  </p>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleDelete(item.id)}
                    title="Delete"
                    style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          {/* Upload Card */}
          <div
            className="glass-card flex items-center justify-center flex-col"
            style={{ minHeight: 280, cursor: 'pointer', borderStyle: 'dashed' }}
            onClick={() => setUploadModal(true)}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.5 }}>+</div>
            <p className="text-muted">Upload New Media</p>
          </div>

          {media.length === 0 && (
            <div className="glass-card flex items-center justify-center flex-col" style={{ minHeight: 280 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.4 }}>📭</div>
              <p className="text-muted">No media uploaded yet</p>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="selection-overlay" onClick={() => { setUploadModal(false); setError(''); }}>
          <div className="glass-card-static animate-slide-up" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-lg">📤 Upload Media</h3>

            {error && (
              <div style={{
                background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.3)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-sm)', marginBottom: 'var(--space-md)',
                color: '#f87171', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Block</label>
              <select className="form-input" value={uploadBlock} onChange={(e) => setUploadBlock(e.target.value)}>
                <option value="MVHR-A">MVHR-A</option>
                <option value="MVHR-B">MVHR-B</option>
                <option value="MVHR-C">MVHR-C</option>
                <option value="MVHR-D">MVHR-D</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Media Type</label>
              <select className="form-input" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                <option value="photo">Photo</option>
                <option value="video">Video</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Caption</label>
              <input
                className="form-input"
                placeholder="Describe the media..."
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">File</label>
              <input
                className="form-input"
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Preview */}
            {preview && (
              <div style={{
                marginBottom: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', maxHeight: 200,
              }}>
                {uploadType === 'photo' ? (
                  <img src={preview} alt="Preview" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                ) : (
                  <video src={preview} style={{ width: '100%', height: 200, objectFit: 'cover' }} controls />
                )}
              </div>
            )}

            <div className="flex gap-sm justify-between">
              <button className="btn btn-ghost" onClick={() => { setUploadModal(false); setError(''); }}>Cancel</button>
              <button className="btn btn-cardinal" onClick={handleUpload} disabled={uploading}>
                {uploading ? '⏳ Uploading...' : '📤 Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
