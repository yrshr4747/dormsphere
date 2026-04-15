import { useEffect, useState } from 'react';
import api from '../services/api';
import useSocket from '../hooks/useSocket';
import RoomGrid from '../components/RoomGrid';
import HostelMap from '../components/HostelMap';
import SelectionFeedback from '../components/SelectionFeedback';

export default function RoomArena() {
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');
  const [rooms, setRooms] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [waveStatus, setWaveStatus] = useState(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [pendingOverrideRoom, setPendingOverrideRoom] = useState(null);
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [movePartnerChoice, setMovePartnerChoice] = useState(true);
  const { connected, onRoomUpdate, onDemandUpdate, onSignalUpdate, onWaveEvent } = useSocket();

  useEffect(() => {
    loadRooms();
    loadWaveStatus();
  }, []);

  useEffect(() => {
    if (user.role !== 'admin') return undefined;
    if (studentQuery.trim().length < 2) {
      setStudentResults([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchingStudents(true);
        const { data } = await api.get('/admin/students/search', { params: { q: studentQuery.trim() } });
        setStudentResults(data.students || []);
      } catch (err) {
        console.error('Student search error:', err);
      } finally {
        setSearchingStudents(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [studentQuery, user.role]);

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

  const submitRoomSelection = async (roomId) => {
    try {
      let payload = {};
      if (user.role === 'admin') {
        payload = { student_id: selectedStudent.id, move_partner: movePartnerChoice };
      }

      const { data } = await api.post(`/rooms/${roomId}/attempt`, payload);
      setFeedback({ type: 'success', message: data.message, roomInfo: data.assignment });
      loadRooms();
      if (user.role === 'admin') {
        setStudentResults([]);
      }
    } catch (err) {
      setFeedback({
        type: 'fail',
        message: err.response?.data?.error || 'Selection failed.',
      });
    }
  };

  const handleSelectRoom = async (roomId) => {
    if (user.role === 'admin') {
      if (!selectedStudent) {
        setFeedback({
          type: 'fail',
          message: 'Select a student from the admin override panel before clicking a room.',
        });
        return;
      }
      const room = rooms.find((entry) => entry.id === roomId);
      if (!room) {
        setFeedback({
          type: 'fail',
          message: 'Could not load room details for confirmation.',
        });
        return;
      }
      setPendingOverrideRoom(room);
      return;
    }

    await submitRoomSelection(roomId);
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

  const pendingBedsNeeded = selectedStudent?.partner && movePartnerChoice ? 2 : 1;
  const pendingFreeBedsAfterAssignment = pendingOverrideRoom
    ? pendingOverrideRoom.capacity - pendingOverrideRoom.occupied - pendingBedsNeeded
    : null;

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
          {user.role === 'admin' && (
            <p className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
              Pick a student first, review their current room and roommate, then click the destination room.
            </p>
          )}
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

      {user.role === 'admin' && (
        <div className="glass-card-static mb-lg animate-slide-up">
          <div className="flex items-center justify-between" style={{ gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div>
              <h3 className="mb-sm">🔑 Admin Override Panel</h3>
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                Search by roll number or name. Accepted roommate pairs will be moved together automatically and can only go into double rooms.
              </p>
            </div>
            {selectedStudent && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setSelectedStudent(null);
                  setStudentQuery('');
                  setStudentResults([]);
                  setPendingOverrideRoom(null);
                  setMovePartnerChoice(true);
                }}
              >
                Clear Selection
              </button>
            )}
          </div>

          <div className="flex gap-md mt-md" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search roll number or student name"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value.toUpperCase())}
              />
              <div className="mt-sm text-muted" style={{ fontSize: '0.75rem' }}>
                {searchingStudents ? 'Searching students...' : 'Type at least 2 characters to search.'}
              </div>

              {studentResults.length > 0 && (
                <div className="mt-md" style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  {studentResults.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="glass-card-static"
                      onClick={() => {
                        setSelectedStudent(student);
                        setStudentQuery(`${student.rollNumber} — ${student.name}`);
                        setStudentResults([]);
                        setPendingOverrideRoom(null);
                        setMovePartnerChoice(true);
                      }}
                      style={{
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: selectedStudent?.id === student.id ? '1px solid var(--cardinal)' : '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-sm">
                        <strong>{student.rollNumber}</strong>
                        <span className="badge badge-gold">Year {student.yearGroup}</span>
                      </div>
                      <div className="mt-sm">{student.name}</div>
                      <div className="text-muted mt-sm" style={{ fontSize: '0.78rem' }}>
                        {student.department} • {student.currentRoom ? `Current room: ${student.currentRoom}` : 'No room assigned'}
                      </div>
                      {student.partner && (
                        <div className="text-muted mt-sm" style={{ fontSize: '0.78rem' }}>
                          Accepted roommate: {student.partner.rollNumber} ({student.partner.name})
                        </div>
                      )}
                      {!student.partner && student.currentRoommate && (
                        <div className="text-muted mt-sm" style={{ fontSize: '0.78rem' }}>
                          Current roommate: {student.currentRoommate.rollNumber} ({student.currentRoommate.name})
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card-static" style={{ flex: '1 1 280px', minWidth: 260 }}>
              <h4 className="mb-sm">Selected Student</h4>
              {selectedStudent ? (
                <>
                  <div style={{ fontWeight: 700 }}>{selectedStudent.rollNumber}</div>
                  <div className="mt-sm">{selectedStudent.name}</div>
                  <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                    {selectedStudent.department} • Year {selectedStudent.yearGroup}
                  </div>
                  <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                    {selectedStudent.currentRoom ? `Current room: ${selectedStudent.currentRoom}` : 'Currently unassigned'}
                  </div>
                  <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                    Retention status: {selectedStudent.retentionStatus || 'none'}
                  </div>
                  {selectedStudent.partner ? (
                    <div className="mt-md" style={{ fontSize: '0.82rem' }}>
                      <strong>Accepted roommate</strong>
                      <div className="text-muted mt-sm">
                        {selectedStudent.partner.rollNumber} • {selectedStudent.partner.name}
                      </div>
                      <div className="text-muted mt-sm">
                        You will choose whether to move both students together or move only this student.
                      </div>
                    </div>
                  ) : selectedStudent.currentRoommate ? (
                    <div className="mt-md" style={{ fontSize: '0.82rem' }}>
                      <strong>Current roommate</strong>
                      <div className="text-muted mt-sm">
                        {selectedStudent.currentRoommate.rollNumber} • {selectedStudent.currentRoommate.name}
                      </div>
                      <div className="text-muted mt-sm">
                        This student shares a room currently, but there is no accepted roommate-pair record linked for automatic pair movement.
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted mt-md" style={{ fontSize: '0.8rem' }}>
                      No accepted roommate linked to this student.
                    </div>
                  )}
                  <div className="mt-md text-muted" style={{ fontSize: '0.78rem' }}>
                    Click any available room below to review the override before confirming it.
                  </div>
                </>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                  No student selected yet. Use the search box, then click a room to assign.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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

      {user.role === 'admin' && pendingOverrideRoom && selectedStudent && (
        <div className="selection-overlay" onClick={() => !submittingOverride && setPendingOverrideRoom(null)}>
          <div
            className="glass-card-static"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 92vw)', padding: 'var(--space-xl)' }}
          >
            <div className="flex items-center justify-between gap-sm mb-md">
              <div>
                <h3>Confirm Room Override</h3>
                <p className="text-muted mt-sm" style={{ fontSize: '0.82rem' }}>
                  Review the student, room, and roommate impact before applying the override.
                </p>
              </div>
              <span className="badge badge-gold">
                {selectedStudent.partner ? 'Pair Move' : 'Single Move'}
              </span>
            </div>

            <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
              <div className="glass-card-static">
                <h4 className="mb-sm">Student</h4>
                <div style={{ fontWeight: 700 }}>{selectedStudent.rollNumber}</div>
                <div className="mt-sm">{selectedStudent.name}</div>
                <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                  {selectedStudent.department} • Year {selectedStudent.yearGroup}
                </div>
                <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                  {selectedStudent.currentRoom ? `Current room: ${selectedStudent.currentRoom}` : 'Currently unassigned'}
                </div>
                {selectedStudent.partner && (
                  <div className="mt-md text-muted" style={{ fontSize: '0.8rem' }}>
                    Roommate also moves: {selectedStudent.partner.rollNumber} • {selectedStudent.partner.name}
                  </div>
                )}
              </div>

              <div className="glass-card-static">
                <h4 className="mb-sm">Destination Room</h4>
                <div style={{ fontWeight: 700 }}>
                  {pendingOverrideRoom.hostel_code} {pendingOverrideRoom.room_number}
                </div>
                <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                  Floor {pendingOverrideRoom.floor} • {pendingOverrideRoom.capacity === 1 ? 'Single room' : 'Double room'}
                </div>
                <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                  Current occupancy: {pendingOverrideRoom.occupied}/{pendingOverrideRoom.capacity}
                </div>
                <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                  Beds needed: {pendingBedsNeeded}
                </div>
                <div className="text-muted mt-sm" style={{ fontSize: '0.8rem' }}>
                  Free beds after assignment: {pendingFreeBedsAfterAssignment}
                </div>
              </div>
            </div>

            <div className="glass-card-static mt-md">
              <div style={{ fontWeight: 700, marginBottom: 'var(--space-sm)' }}>What will happen</div>
              {selectedStudent.partner ? (
                <div className="flex flex-col gap-sm">
                  <label className="text-muted" style={{ fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="override-move-partner"
                      checked={movePartnerChoice === true}
                      onChange={() => setMovePartnerChoice(true)}
                      style={{ marginRight: 8 }}
                    />
                    Move both roommates together.
                  </label>
                  <label className="text-muted" style={{ fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="override-move-partner"
                      checked={movePartnerChoice === false}
                      onChange={() => setMovePartnerChoice(false)}
                      style={{ marginRight: 8 }}
                    />
                    Move only the selected student. This will dissolve the accepted roommate pairing.
                  </label>
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                  This override will move only the selected student into the destination room.
                </div>
              )}
              <div className="text-muted mt-sm" style={{ fontSize: '0.82rem' }}>
                The existing room assignment, if any, will be released automatically.
              </div>
            </div>

            <div className="flex justify-end gap-sm mt-lg">
              <button
                className="btn btn-ghost"
                disabled={submittingOverride}
                onClick={() => setPendingOverrideRoom(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-cardinal"
                disabled={submittingOverride}
                onClick={async () => {
                  try {
                    setSubmittingOverride(true);
                    await submitRoomSelection(pendingOverrideRoom.id);
                    setPendingOverrideRoom(null);
                  } finally {
                    setSubmittingOverride(false);
                  }
                }}
              >
                {submittingOverride ? 'Assigning...' : 'Confirm Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
