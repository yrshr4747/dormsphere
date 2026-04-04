import { useState } from 'react';

const SAMPLE_GALLERIES = [
  { id: 1, hostel: 'MVHR-A', title: 'Block A Common Room', type: 'photo', caption: 'Renovated common room with new furniture', color: '#8C1515' },
  { id: 2, hostel: 'MVHR-B', title: 'Block B Events', type: 'photo', caption: 'Inter-block cricket tournament 2026', color: '#D4A843' },
  { id: 3, hostel: 'MVHR-C', title: 'Block C Study Area', type: 'photo', caption: '24/7 quiet study zone', color: '#2D8A4E' },
  { id: 4, hostel: 'MVHR-D', title: 'Block D Cultural Night', type: 'video', caption: 'Annual cultural fest highlights', color: '#3B82F6' },
];

export default function MediaPortal() {
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [uploadModal, setUploadModal] = useState(false);

  const blocks = ['all', 'MVHR-A', 'MVHR-B', 'MVHR-C', 'MVHR-D'];
  const filtered = selectedBlock === 'all'
    ? SAMPLE_GALLERIES
    : SAMPLE_GALLERIES.filter((g) => g.hostel === selectedBlock);

  return (
    <div className="page container">
      <div className="flex items-center justify-between mb-xl animate-slide-up">
        <div>
          <h1>i3 Media Portal</h1>
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
      <div className="grid-3">
        {filtered.map((item) => (
          <div key={item.id} className="glass-card" style={{ cursor: 'pointer', overflow: 'hidden' }}>
            {/* Placeholder thumbnail */}
            <div style={{
              height: 180, borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)',
              background: `linear-gradient(135deg, ${item.color}40 0%, ${item.color}20 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3rem', border: `1px solid ${item.color}30`,
            }}>
              {item.type === 'photo' ? '📸' : '🎥'}
            </div>
            <div className="flex items-center justify-between mb-sm">
              <span className="badge badge-gold">{item.hostel}</span>
              <span className="badge badge-cardinal">{item.type}</span>
            </div>
            <h4 style={{ fontSize: '1rem', marginBottom: 'var(--space-xs)' }}>{item.title}</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>{item.caption}</p>
          </div>
        ))}

        {/* Upload Card */}
        <div
          className="glass-card flex items-center justify-center flex-col"
          style={{ minHeight: 280, cursor: 'pointer', borderStyle: 'dashed' }}
          onClick={() => setUploadModal(true)}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)', opacity: 0.5 }}>+</div>
          <p className="text-muted">Upload New Media</p>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="selection-overlay" onClick={() => setUploadModal(false)}>
          <div className="glass-card-static animate-slide-up" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-lg">Upload Media</h3>
            <div className="form-group">
              <label className="form-label">Block</label>
              <select className="form-input">
                <option>MVHR-A</option>
                <option>MVHR-B</option>
                <option>MVHR-C</option>
                <option>MVHR-D</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Media Type</label>
              <select className="form-input">
                <option value="photo">Photo</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Caption</label>
              <input className="form-input" placeholder="Describe the media..." />
            </div>
            <div className="form-group">
              <label className="form-label">File</label>
              <input className="form-input" type="file" accept="image/*,video/*" />
            </div>
            <div className="flex gap-sm justify-between">
              <button className="btn btn-ghost" onClick={() => setUploadModal(false)}>Cancel</button>
              <button className="btn btn-cardinal">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
