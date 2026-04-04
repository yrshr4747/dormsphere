# DormSphere — REST API Specification

Base URL: `http://localhost:3001/api`

## Authentication
All protected endpoints require: `Authorization: Bearer <JWT>`

---

## Auth Routes

### `POST /auth/register`
Register a new student account.
```json
{
  "rollNumber": "IIITDMK-0001",
  "name": "Alice",
  "email": "alice@iiitdm.ac.in",
  "password": "securepass",
  "year": 2,
  "department": "CSE"
}
```
**Response** `201`: `{ student, token }`

### `POST /auth/login`
```json
{ "email": "alice@iiitdm.ac.in", "password": "securepass" }
```
**Response** `200`: `{ student, token }`

---

## Room Routes

### `GET /rooms`
List all rooms with demand signals.
**Response** `200`: `{ rooms: [{ id, hostel_name, hostel_code, room_number, floor, capacity, occupied, is_available, demandLevel, demand_count }] }`

### `GET /rooms/hostel/:hostelId`
Rooms filtered by hostel.

### `POST /rooms/:id/attempt` 🔒 Student
Atomic room selection using `SELECT FOR UPDATE`.
**Response** `200`: `{ success, message, assignment: { roomId, roomNumber, floor, hostelId } }`
**Error** `409`: Room full or student already assigned.

### `GET /rooms/hostels/list`
List all hostels.

---

## Student Routes

### `POST /student/survey` 🔒 Student
Submit personality survey. Body: survey answer fields.
**Response** `200`: `{ message, vector: { sleep, study, social } }`

### `GET /student/vector` 🔒
Get own lifestyle vector.

### `GET /student/match` 🔒 Student
Get roommate match result.
**Response** `200`: `{ match: { partnerId, partnerName, partnerRoll, compatibilityScore } }`

### `GET /student/compatibility/:targetId` 🔒
Check compatibility with another student.

### `GET /student/assignment` 🔒
Get current room assignment.

---

## Lottery Routes

### `POST /lottery/generate` 🔒 Warden
Trigger C++ lottery engine.
```json
{ "seed": "public-seed-2026", "yearGroup": 4 }
```

### `GET /lottery/rank` 🔒
Get own lottery rank.

### `GET /lottery/rankings`
Public auditable ranking list.

---

## Outpass Routes

### `POST /outpass/generate` 🔒 Student
Generate HMAC-signed QR outpass.
```json
{ "purpose": "Medical", "destination": "Chennai", "outTime": "2026-05-01T09:00:00", "expectedReturn": "2026-05-01T18:00:00" }
```

### `GET /outpass/verify/:token` 🔒 Guard/Warden
Verify outpass QR code. Returns validity, student info, expiry check.

### `GET /outpass/my` 🔒
List own outpasses.

---

## Grievance Routes

### `POST /grievance` 🔒 Student
Submit AES-256-GCM encrypted grievance.
```json
{ "content": "Complaint text...", "category": "maintenance" }
```

### `GET /grievance` 🔒 JudComm/Warden
List all grievances (decrypted).

### `GET /grievance/my` 🔒
List own grievances (status only, no content).

### `PATCH /grievance/:id/resolve` 🔒 JudComm/Warden
Mark grievance as resolved.

---

## Infrastructure Routes

### `GET /infra/status`
Live WiFi/power/water status per hostel block.

### `PUT /infra/status/:hostelId` 🔒 Warden
Update infrastructure status.

---

## Asset Routes

### `GET /assets`
List all shared assets with availability.

### `POST /assets/checkout` 🔒 Student
Check out an asset (atomic with row lock).

### `POST /assets/checkin` 🔒
Return a checked-out asset.

---

## Election Routes

### `GET /elections`
List all elections with vote/candidate counts.

### `GET /elections/:id/candidates`
List candidates for an election.

### `POST /elections/vote` 🔒 Student
Cast one vote per election. Enforced by unique constraint.

### `GET /elections/:id/results`
Election results with vote counts per candidate.

---

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `room:updated` | Server→Client | Room occupancy changed |
| `room:demand` | Server→Client | Demand level changed |
| `wave:event` | Server→Client | Wave gate opening/closing |
| `selection:result` | Server→Client | Personal selection outcome |
| `join:hostel` | Client→Server | Join hostel-specific channel |
