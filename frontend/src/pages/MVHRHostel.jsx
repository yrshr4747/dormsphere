import { useState } from 'react';
import { Link } from 'react-router-dom';

/* 
  We use an isolated CSS block here to apply the Stanford "Light Mode Academic" 
  aesthetic solely to this component, without breaking the dark glassmorphism
  of the rest of the application.
*/
const styles = {
  container: {
    fontFamily: "'Inter', sans-serif",
    backgroundColor: '#FFFFFF',
    color: '#212529',
    minHeight: '100vh',
  },
  heroImage: {
    width: '100%',
    height: '400px',
    objectFit: 'cover',
    display: 'block',
  },
  headerBanner: {
    backgroundColor: '#2D368B', // IIITDM Sapphire Blue
    color: '#FFFFFF',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  title: {
    fontFamily: "'Merriweather', serif",
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 1.5rem 0',
  },
  navTabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    flexWrap: 'wrap',
  },
  navTab: {
    color: '#FFFFFF',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    position: 'relative',
    paddingBottom: '0.25rem',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    width: '100%',
    height: '3px',
    backgroundColor: '#74BD44', // IIITDM Lime Green
  },
  contentSection: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '4rem 2rem',
  },
  sectionTitle: {
    fontFamily: "'Merriweather', serif",
    fontSize: '2rem',
    color: '#2D368B',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  textRow: {
    display: 'flex',
    borderBottom: '1px solid #DEE2E6',
    padding: '1rem 0',
    alignItems: 'center',
  },
  textRowLabel: {
    fontWeight: 700,
    width: '35%',
    color: '#495057',
  },
  textRowValue: {
    width: '65%',
    color: '#212529',
  },
  backButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#FFFFFF',
    color: '#2D368B',
    border: '1px solid #2D368B',
    borderRadius: '4px',
    textDecoration: 'none',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '2rem',
  }
};

export default function MVHRHostel() {
  const [activeTab, setActiveTab] = useState('general');

  // Replace with actual IIITDM Kurnool Main Gate image if available
  const heroImageUrl = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80";

  return (
    <div style={styles.container}>
      {/* Hero Image - IIITDM Main Gate placeholder */}
      <img src={heroImageUrl} alt="IIITDM Kurnool Campus" style={styles.heroImage} />

      {/* Red/Blue Header Banner with Tabs */}
      <div style={styles.headerBanner}>
        <h1 style={styles.title}>MVHR Hostel</h1>
        
        <ul style={styles.navTabs}>
          {['General Information', 'Pictures and Floor Plans', 'Furnishings'].map((tab) => {
            const tabKey = tab.split(' ')[0].toLowerCase();
            return (
              <li 
                key={tabKey} 
                style={styles.navTab}
                onClick={() => setActiveTab(tabKey)}
              >
                {tab}
                {activeTab === tabKey && <div style={styles.activeTabIndicator} />}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Content Rendering based on Active Tab */}
      <div style={styles.contentSection}>
        {activeTab === 'general' && (
          <div className="animate-fade-in">
            <h2 style={styles.sectionTitle}>General Information</h2>
            <p style={{ lineHeight: 1.8, marginBottom: '2rem', color: '#495057' }}>
              MVHR is an elegant, structured building known for its vibrant spirit. It houses students primarily in singles and doubles. Located near the main academic blocks, it provides a highly focused environment for the scholars at IIITDM Kurnool.
            </p>
            
            <div style={{ background: '#F8F9FA', padding: '2rem', border: '1px solid #DEE2E6' }}>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Population</div>
                <div style={styles.textRowValue}>~ 240 Students</div>
              </div>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Room Types</div>
                <div style={styles.textRowValue}>Singles, Doubles</div>
              </div>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Common Areas</div>
                <div style={styles.textRowValue}>Lounge, Seminar Room, Computer Cluster</div>
              </div>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Accessibility</div>
                <div style={styles.textRowValue}>Elevator access, ramps on ground floor</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pictures' && (
          <div className="animate-fade-in">
            <h2 style={styles.sectionTitle}>Pictures and Floor Plans</h2>
            <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#6C757D' }}>
              Floor plans are restricted to verified residents only.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <img 
                src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80" 
                alt="Lounge Area" 
                style={{ width: '100%', height: '250px', objectFit: 'cover', border: '4px solid #F8F9FA', outline: '1px solid #DEE2E6' }} 
              />
              <img 
                src="https://images.unsplash.com/photo-1522771730849-f4d2f02cb849?auto=format&fit=crop&w=600&q=80" 
                alt="Typical Room" 
                style={{ width: '100%', height: '250px', objectFit: 'cover', border: '4px solid #F8F9FA', outline: '1px solid #DEE2E6' }} 
              />
            </div>
          </div>
        )}

        {activeTab === 'furnishings' && (
          <div className="animate-fade-in">
            <h2 style={styles.sectionTitle}>Furnishings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Tile/Vitrified Flooring</div></div>
                <div style={styles.textRow}><div style={{width:'100%'}}>High-speed internet access (LAN & WiFi)</div></div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Waste basket and recycling bin</div></div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Ceiling fan and tube lights</div></div>
              </div>
              <div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Standard single bed</div></div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Study desk and chair</div></div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Built-in bookshelf</div></div>
                <div style={styles.textRow}><div style={{width:'100%'}}>Wooden wardrobe/dresser</div></div>
              </div>
            </div>
            <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6C757D', padding: '1rem', background: '#F8F9FA' }}>
              Note: Students must provide their own mattresses, bed linens, cookware, and other personal items. No institutional storage is available for unneeded furniture.
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <Link to="/" style={styles.backButton}>
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
