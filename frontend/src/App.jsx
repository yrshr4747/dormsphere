import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomArena from './pages/RoomArena';
import Survey from './pages/Survey';
import Outpass from './pages/Outpass';
import MediaPortal from './pages/MediaPortal';
import Elections from './pages/Elections';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('dormsphere_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/rooms" element={<RoomArena />} />
                  <Route path="/survey" element={<Survey />} />
                  <Route path="/outpass" element={<Outpass />} />
                  <Route path="/media" element={<MediaPortal />} />
                  <Route path="/elections" element={<Elections />} />
                </Routes>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
