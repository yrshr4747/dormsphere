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
    { to: '/', label: 'Dashboard' },
    { to: '/rooms', label: 'Housing Options' },
    { to: '/survey', label: 'Room Assessment' },
    { to: '/outpass', label: 'Outpass Services' },
    { to: '/media', label: 'Media Portal' },
    { to: '/elections', label: 'Student Elections' },
  ];

  return (
    <header>
      {/* Top Utility Bar - Crisp White */}
      <div style={{ background: '#FFFFFF', padding: '16px 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div className="navbar-brand-icon" style={{ background: 'var(--sapphire)', color: 'white', border: 'none', borderRadius: '4px' }}>🏛️</div>
          <div>
            <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--sapphire)', fontFamily: 'var(--font-serif)', fontWeight: 700 }}>IIITDM Kurnool</h1>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>DormSphere Residence</div>
          </div>
        </Link>

        {user.name && (
          <div className="flex items-center gap-md">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.role === 'admin' ? 'Administrator' : 'Student'}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ borderRadius: 0, padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Primary Navigation - Sapphire Blue */}
      <nav className="navbar" style={{ height: 'auto', minHeight: '54px', padding: '0', display: 'flex', justifyContent: 'center' }}>
        <ul className="navbar-links" style={{ margin: 0, padding: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`navbar-link ${location.pathname === link.to ? 'active' : ''}`}
                style={{ display: 'block', padding: '1rem 1.25rem', letterSpacing: '0.05em' }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
