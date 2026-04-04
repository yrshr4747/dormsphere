export default function HostelMap({ rooms, hostels, onSelect }) {
  // Group rooms by hostel then floor
  const hostelFloors = {};
  rooms.forEach((room) => {
    const hostelKey = room.hostel_code || room.hostel_id;
    if (!hostelFloors[hostelKey]) hostelFloors[hostelKey] = {};
    if (!hostelFloors[hostelKey][room.floor]) hostelFloors[hostelKey][room.floor] = [];
    hostelFloors[hostelKey][room.floor].push(room);
  });

  const getRoomColor = (room) => {
    if (!room.is_available) return 'room-occupied';
    if (room.demandLevel === 'critical' || room.demandLevel === 'high') return 'room-high-demand';
    return 'room-available';
  };

  const getColorFill = (room) => {
    if (!room.is_available) return 'rgba(140, 21, 21, 0.4)';
    if (room.demandLevel === 'critical') return 'rgba(220, 38, 38, 0.5)';
    if (room.demandLevel === 'high') return 'rgba(249, 115, 22, 0.5)';
    if (room.demandLevel === 'medium') return 'rgba(217, 119, 6, 0.4)';
    return 'rgba(45, 138, 78, 0.5)';
  };

  return (
    <div className="flex flex-col gap-xl">
      {Object.entries(hostelFloors).map(([hostelCode, floors]) => (
        <div key={hostelCode} className="hostel-map">
          <h3 className="mb-lg">{hostelCode} — Floor Plan</h3>

          {Object.entries(floors).sort(([a], [b]) => Number(a) - Number(b)).map(([floor, floorRooms]) => (
            <div key={floor} className="mb-lg">
              <h4 className="mb-md" style={{ fontSize: '0.85rem', color: 'var(--light-gray)' }}>
                Floor {floor}
              </h4>
              <svg
                width="100%"
                viewBox={`0 0 ${Math.max(floorRooms.length * 60 + 20, 400)} 80`}
                style={{ borderRadius: 'var(--radius-md)', background: 'rgba(15,14,13,0.3)' }}
              >
                {/* Corridor */}
                <rect x="10" y="35" width={floorRooms.length * 60} height="10" rx="3"
                  fill="rgba(155,154,151,0.1)" stroke="rgba(155,154,151,0.15)" strokeWidth="0.5"
                />

                {/* Rooms */}
                {floorRooms.map((room, i) => (
                  <g key={room.id}>
                    <rect
                      x={10 + i * 60}
                      y={5}
                      width={52}
                      height={28}
                      rx={4}
                      className={getRoomColor(room)}
                      fill={getColorFill(room)}
                      stroke="rgba(155,154,151,0.2)"
                      strokeWidth="1"
                      style={{ cursor: room.is_available ? 'pointer' : 'default' }}
                      onClick={() => room.is_available && onSelect(room.id)}
                    >
                      <title>
                        Room {room.room_number} — {room.is_available ? 'Available' : 'Occupied'} ({room.occupied}/{room.capacity})
                      </title>
                    </rect>
                    <text
                      x={10 + i * 60 + 26}
                      y={23}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--sand)"
                      style={{ pointerEvents: 'none', fontFamily: 'var(--font-primary)' }}
                    >
                      {room.room_number}
                    </text>

                    {/* Demand indicator */}
                    {(room.demandLevel === 'high' || room.demandLevel === 'critical') && (
                      <text x={10 + i * 60 + 44} y={14} fontSize="8" style={{ pointerEvents: 'none' }}>
                        🔥
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          ))}

          {/* Legend */}
          <div className="flex gap-lg mt-md" style={{ fontSize: '0.75rem' }}>
            <div className="flex items-center gap-sm">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(45, 138, 78, 0.5)' }} />
              <span className="text-muted">Available</span>
            </div>
            <div className="flex items-center gap-sm">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(249, 115, 22, 0.5)' }} />
              <span className="text-muted">High Demand</span>
            </div>
            <div className="flex items-center gap-sm">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(140, 21, 21, 0.4)' }} />
              <span className="text-muted">Occupied</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
