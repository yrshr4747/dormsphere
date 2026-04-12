import { useEffect, useState } from 'react';
import api from '../services/api';
import useSocket from '../hooks/useSocket';
import RoomGrid from '../components/RoomGrid';
import HostelMap from '../components/HostelMap';
import SelectionFeedback from '../components/SelectionFeedback';

export default function RoomArena() {
  const [rooms, setRooms] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [waveStatus, setWaveStatus] = useState(null);
  const { connected, onRoomUpdate, onDemandUpdate, onSignalUpdate, onWaveEvent } = useSocket();

  useEffect(() => {
    loadRooms();
    loadWaveStatus();
  }, []);

  useEffect(() => {
    const unsub1 = onRoomUpdate((data) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === data.roomId
            ? { ...r, occupied: data.occupied, is_available: data.isAvailable }
            : r
        )
      );
    });

    const unsub2 = onDemandUpdate((data) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === data.roomId
            ? { ...r, demandLevel: data.demandLevel, demand_count: data.attemptCount }
            : r
        )
      );
    });

    const unsub3 = onSignalUpdate((data) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === data.roomId
            ? { ...r, signal_count: data.signalCount, demandLevel: data.demandLevel }
            : r
        )
      );
    });

    const unsub4 = onWaveEvent(() => {
      loadWaveStatus();
    });

    return () => { unsub1?.(); unsub2?.(); unsub3?.(); unsub4?.(); };
  }, [onRoomUpdate, onDemandUpdate, onSignalUpdate, onWaveEvent]);

  const loadRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data.rooms);
      
      // Extract unique hostels
      const hostelMap = {};
      data.rooms.forEach((r) => {
        if (!hostelMap[r.hostel_id]) {
          hostelMap[r.hostel_id] = { id: r.hostel_id, name: r.hostel_name, code: r.hostel_code };
        }
      });
      setHostels(Object.values(hostelMap));
    } catch (err) {
      console.error('Load rooms error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWaveStatus = async () => {
    try {
      const { data } = await api.get('/rooms/waves/status');
      setWaveStatus(data);
    } catch (err) {
      // Not logged in or other error — ignore silently
    }
  };

  const handleSelectRoom = async (roomId) => {
    try {
      const { data } = await api.post(`/rooms/${roomId}/attempt`);
      setFeedback({ type: 'success', message: data.message, roomInfo: data.assignment });
      loadRooms();
    } catch (err) {
      setFeedback({
        type: 'fail',
        message: err.response?.data?.error || 'Selection failed.',
      });
    }
  };

  const handleSignal = async (roomId) => {
    try {
      await api.post(`/rooms/${roomId}/signal`);
    } catch (err) {
      console.error('Signal error:', err);
    }
  };

  const filteredRooms = selectedHostel === 'all'
    ? rooms
    : rooms.filter((r) => r.hostel_id === selectedHostel);

  const stats = {
    total: filteredRooms.length,
    available: filteredRooms.filter((r) => r.is_available).length,
    occupied: filteredRooms.filter((r) => !r.is_available).length,
    highDemand: filteredRooms.filter((r) => r.demandLevel === 'high' || r.demandLevel === 'critical').length,
  };

  if (loading) {
    return <div className="page container flex items-center justify-center"><div className="spinner" /></div>;
  }

  return (
    <div className="page container">
      {/* Wave Status Banner */}
      {waveStatus && (
        <div className={`wave-banner ${waveStatus.gateOpen ? 'wave-banner-open' : 'wave-banner-closed'}`}>
          <span className="wave-banner-icon">{waveStatus.gateOpen ? '🟢' : '🔴'}</span>
          <span>{waveStatus.message}</span>
          {waveStatus.wave && !waveStatus.gateOpen && (
            <span className="wave-banner-countdown">
              Opens: {new Date(waveStatus.wave.gate_open).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-xl animate-slide-up">
        <div>
          <h1>Room Selection Arena</h1>
          <p className="text-muted mt-sm">
            {connected ? '🟢 Live' : '🔴 Offline'} • {stats.available} rooms available
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-cardinal' : 'btn-ghost'}`}
            onClick={() => setViewMode('grid')}
          >
            ⊞ Grid
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'map' ? 'btn-cardinal' : 'btn-ghost'}`}
            onClick={() => setViewMode('map')}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid-4 mb-lg">
        <div className="glass-card-static stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Rooms</div>
        </div>
        <div className="glass-card-static stat-card">
          <div className="stat-value" style={{ color: 'var(--success-light)' }}>{stats.available}</div>
          <div className="stat-label">Available</div>
        </div>
        <div className="glass-card-static stat-card">
          <div className="stat-value" style={{ color: 'var(--light-gray)' }}>{stats.occupied}</div>
          <div className="stat-label">Occupied</div>
        </div>
        <div className="glass-card-static stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.highDemand}</div>
          <div className="stat-label">High Demand 🔥</div>
        </div>
      </div>

      {/* Hostel Filter */}
      <div className="flex gap-sm mb-lg" style={{ flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${selectedHostel === 'all' ? 'btn-cardinal' : 'btn-ghost'}`}
          onClick={() => setSelectedHostel('all')}
        >
          All Hostels
        </button>
        {hostels.map((h) => (
          <button
            key={h.id}
            className={`btn btn-sm ${selectedHostel === h.id ? 'btn-cardinal' : 'btn-ghost'}`}
            onClick={() => setSelectedHostel(h.id)}
          >
            {h.code}
          </button>
        ))}
      </div>

      {/* Room Display */}
      {viewMode === 'grid' ? (
        <RoomGrid rooms={filteredRooms} onSelect={handleSelectRoom} onSignal={handleSignal} />
      ) : (
        <HostelMap rooms={filteredRooms} hostels={hostels} onSelect={handleSelectRoom} />
      )}

      {/* Selection Feedback */}
      {feedback && (
        <SelectionFeedback
          type={feedback.type}
          message={feedback.message}
          roomInfo={feedback.roomInfo}
          onClose={() => setFeedback(null)}
        />
      )}
    </div>
  );
}
