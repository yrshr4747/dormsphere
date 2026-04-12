import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RoomArena from './pages/RoomArena';
import Survey from './pages/Survey';
import Outpass from './pages/Outpass';
import MediaPortal from './pages/MediaPortal';
import Elections from './pages/Elections';
import MVHRHostel from './pages/MVHRHostel';
import Community from './pages/Community';

function roleHome(role) {
  if (role === 'student') return '/student/dashboard';
  if (role === 'guard' || role === 'warden') return '/outpass';
  if (role === 'admin' || role === 'judcomm') return '/admin/dashboard';
  return '/login';
}

// ── PROTECTED ROUTE WITH ROLE-BASED REDIRECTS ─────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('dormsphere_token');
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || 'null');
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Generic index mapping
  if (location.pathname === '/') {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Isolated route for MVHR so it can optionally ignore the dark mode Navbar if desired, but we'll include it here inside ProtectedRoute */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div>
                <Navbar />
                <Routes>
                  {/* Both endpoints map to the exact dashboards */}
                  <Route path="/student/dashboard" element={<StudentDashboard />} />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />

                  {/* Student Only Routes */}
                  <Route path="/rooms" element={
                    <ProtectedRoute allowedRoles={['student', 'admin']}>
                      <RoomArena />
                    </ProtectedRoute>
                  } />
                  <Route path="/survey" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <Survey />
                    </ProtectedRoute>
                  } />
                  <Route path="/outpass" element={
                    <ProtectedRoute allowedRoles={['student', 'admin', 'guard', 'warden']}>
                      <Outpass />
                    </ProtectedRoute>
                  } />
                  <Route path="/media" element={<MediaPortal />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/elections" element={<Elections />} />
                  <Route path="/hostels/mvhr" element={<MVHRHostel />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
