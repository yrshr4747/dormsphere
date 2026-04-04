export default function RoomGrid({ rooms, onSelect }) {
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
            {floorRooms.map((room) => (
              <div
                key={room.id}
                className={`room-cell ${!room.is_available ? 'occupied' : ''} ${getDemandClass(room)}`}
                onClick={() => room.is_available && onSelect(room.id)}
                title={room.is_available ? 'Click to select' : 'Room full'}
              >
                <div className="flex items-center justify-between mb-sm">
                  <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-serif)' }}>
                    {room.room_number}
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
                  {room.demand_count > 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--warning)' }}>
                      {room.demand_count} attempts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
