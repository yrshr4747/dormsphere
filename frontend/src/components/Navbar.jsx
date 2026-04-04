import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('dormsphere_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('dormsphere_token');
    localStorage.removeItem('dormsphere_user');
    navigate('/login');
  };

  const links = [
    { to: '/', label: 'Dashboard', icon: '🏠' },
    { to: '/rooms', label: 'Rooms', icon: '🏢' },
    { to: '/survey', label: 'Survey', icon: '📋' },
    { to: '/outpass', label: 'Outpass', icon: '🎫' },
    { to: '/media', label: 'Media', icon: '📸' },
    { to: '/elections', label: 'Elections', icon: '🗳️' },
  ];

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-brand-icon">🏛️</div>
        DormSphere
      </Link>

      <ul className="navbar-links">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className={`navbar-link ${location.pathname === link.to ? 'active' : ''}`}
            >
              {link.icon} {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-md">
        <span className="badge badge-gold">{user.role || 'student'}</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--light-gray)' }}>
          {user.name || 'User'}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
