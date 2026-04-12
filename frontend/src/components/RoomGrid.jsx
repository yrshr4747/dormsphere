export default function RoomGrid({ rooms, onSelect, onSignal }) {
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const yearGroup = user.yearGroup || user.year || 1;
  
  const getDemandClass = (room) => {
    if (room.demandLevel === 'critical') return 'critical-demand heatmap-critical';
    if (room.demandLevel === 'high') return 'high-demand heatmap-high';
    if (room.demandLevel === 'medium') return 'heatmap-medium';
    return 'heatmap-low';
  };

  // Group by floor
  const floors = {};
  rooms.forEach((room) => {
    const key = `${room.hostel_code || room.hostel_name} — Floor ${room.floor}`;
    if (!floors[key]) floors[key] = [];
    floors[key].push(room);
  });

  return (
    <div className="flex flex-col gap-xl">
      {Object.entries(floors).map(([floorLabel, floorRooms]) => (
        <div key={floorLabel}>
          <h3 className="mb-md" style={{ fontSize: '1rem' }}>
            {floorLabel}
          </h3>
          <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {floorRooms.map((room) => {
              const isSeniorityLocked = yearGroup <= 2 && room.capacity === 1 && user.role !== 'admin';
              return (
              <div
                key={room.id}
                className={`room-cell ${(!room.is_available || isSeniorityLocked) ? 'occupied' : ''} ${getDemandClass(room)}`}
                onClick={() => {
                  if (isSeniorityLocked) {
                    alert("🔒 Seniority Restriction: Freshmen and Sophomores cannot select Single rooms.");
                    return;
                  }
                  if (room.is_available) onSelect(room.id);
                }}
                title={isSeniorityLocked ? 'Seniority Locked' : room.is_available ? 'Click to select' : 'Room full'}
              >
                {isSeniorityLocked && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '2.5rem', opacity: 0.8, zIndex: 2, pointerEvents: 'none' }}>
                    🔒
                  </div>
                )}
                <div className="flex items-center justify-between mb-sm">
                  <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-serif)' }}>
                    {room.room_number} <span style={{ fontSize: '0.65rem', color: 'var(--light-gray)', marginLeft: '4px', fontWeight: 'bold' }}>{room.capacity === 1 ? 'Wing A (Single)' : 'Wing B (Double)'}</span>
                  </span>
                  <span className={`badge ${room.is_available ? 'badge-success' : 'badge-cardinal'}`}
                    style={{ fontSize: '0.6rem' }}
                  >
                    {room.is_available ? 'Open' : 'Full'}
                  </span>
                </div>

                {/* Capacity Bar */}
                <div className="progress-bar" style={{ height: 4 }}>
                  <div
                    className={`progress-fill ${room.occupied >= room.capacity ? 'progress-fill-cardinal' : 'progress-fill-success'}`}
                    style={{ width: `${(room.occupied / room.capacity) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-sm">
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    {room.occupied}/{room.capacity}
                  </span>

                  {/* 🔥 Signal Badge + Button */}
                  <div className="flex items-center gap-sm">
                    {(room.signal_count > 0 || room.demand_count > 0) && (
                      <span className={`signal-badge ${room.signal_count >= 5 ? 'signal-pulse' : ''}`}>
                        🔥 {(room.signal_count || 0) + (room.demand_count || 0)}
                      </span>
                    )}
                    {room.is_available && onSignal && (
                      <button
                        className="signal-btn"
                        onClick={(e) => { e.stopPropagation(); onSignal(room.id); }}
                        title="Signal interest"
                      >
                        🔥
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
