import { useState } from 'react';
import { Link } from 'react-router-dom';

/* 
  High-Fidelity Stanford-Style Landing Page
*/
const styles = {
  container: {
    fontFamily: "'Source Sans Pro', 'Inter', sans-serif",
    backgroundColor: '#FAF8F5', // Stanford off-white background
    color: '#2E2D29',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  heroImageContainer: {
    position: 'relative',
    width: '100%',
    height: '500px',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  headerBanner: {
    backgroundColor: '#8C1515', // Stanford Cardinal Red
    color: '#FFFFFF',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    position: 'relative',
    zIndex: 10,
  },
  title: {
    fontFamily: "'Source Serif Pro', 'Merriweather', serif",
    fontSize: '2.8rem',
    fontWeight: 700,
    margin: '0 0 1.5rem 0',
    letterSpacing: '0.02em',
  },
  navTabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '3rem',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    flexWrap: 'wrap',
  },
  navTab: {
    color: '#FFFFFF',
    fontSize: '1.05rem',
    fontWeight: 600,
    cursor: 'pointer',
    position: 'relative',
    paddingBottom: '0.5rem',
    transition: 'all 0.2s',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '4px',
    backgroundColor: '#FFFFFF',
  },
  contentSection: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '4rem 2rem',
    flex: 1,
    width: '100%',
  },
  sectionTitle: {
    fontFamily: "'Source Serif Pro', 'Merriweather', serif",
    fontSize: '2.2rem',
    color: '#2E2D29',
    textAlign: 'center',
    marginBottom: '2.5rem',
    fontWeight: 700,
  },
  textRow: {
    display: 'flex',
    borderBottom: '1px solid #D5D1C4',
    padding: '1.2rem 0',
    alignItems: 'flex-start',
  },
  textRowLabel: {
    fontWeight: 600,
    width: '40%',
    color: '#2E2D29',
    fontSize: '1.05rem',
  },
  textRowValue: {
    width: '60%',
    color: '#4D4F53',
    lineHeight: 1.6,
  },
  actionButton: {
    padding: '1rem 2rem',
    backgroundColor: '#8C1515',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1.1rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '2rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(140, 21, 21, 0.2)',
    transition: 'background-color 0.2s',
  },
  carouselContainer: {
    position: 'relative',
    width: '100%',
    height: '500px',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  carouselButton: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.8)',
    border: 'none',
    fontSize: '2rem',
    cursor: 'pointer',
    padding: '1rem',
    zIndex: 10,
  }
};

const carouselImages = [
  {
    url: "/login-bg.jpg",
    caption: "IIITDM Kurnool Main Campus"
  },
  {
    url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
    caption: "Lounge Area"
  },
  {
    url: "https://images.unsplash.com/photo-1522771730849-f4d2f02cb849?auto=format&fit=crop&w=1200&q=80",
    caption: "Typical Room"
  }
];

export default function MVHRHostel() {
  const [activeTab, setActiveTab] = useState('general');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);

  return (
    <div style={styles.container}>
      {/* Dynamic Hero Image */}
      <div style={styles.heroImageContainer}>
        <img src={carouselImages[0].url} alt="Hostel Exterior" style={styles.heroImage} />
      </div>

      {/* Red Header Banner with Tabs */}
      <div style={styles.headerBanner}>
        <h1 style={styles.title}>MVHR Hall</h1>
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
            <p style={{ lineHeight: 1.8, marginBottom: '3rem', color: '#4D4F53', fontSize: '1.1rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto 3rem auto' }}>
              MVHR is an elegant, premier residential building known for its vibrant spirit. It houses approximately 240 students, primarily in singles and doubles. 
              Designed to reflect modern university architecture, it provides an exceptional living and learning environment for scholars.
            </p>
            
            <div style={{ background: '#FFFFFF', padding: '3rem', border: '1px solid #D5D1C4', borderRadius: '4px' }}>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Population</div>
                <div style={styles.textRowValue}>~ 240 Undergraduate Students</div>
              </div>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Room Types</div>
                <div style={styles.textRowValue}>Singles, Doubles (Standard & Attached Bath)</div>
              </div>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Common Areas</div>
                <div style={styles.textRowValue}>Grand Lounge, Seminar Room, Fully Equipped Computer Cluster, Music Room</div>
              </div>
              <div style={styles.textRow}>
                <div style={styles.textRowLabel}>Accessibility</div>
                <div style={styles.textRowValue}>Elevator access, ADA-compliant ramps on the ground floor. For information on accessibility, please reference our Undergraduate Residences Accessibility Summary chart.</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '4rem' }}>
              <Link to="/rooms" style={styles.actionButton}>
                Enter Room Selection Portal →
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'pictures' && (
          <div className="animate-fade-in">
            <h2 style={styles.sectionTitle}>Pictures and Floor Plans</h2>
            
            {/* Image Carousel */}
            <div style={{...styles.carouselContainer, marginBottom: '3rem'}}>
              <button style={{...styles.carouselButton, left: 10}} onClick={prevImage}>〈</button>
              <img 
                src={carouselImages[currentImageIndex].url} 
                alt={carouselImages[currentImageIndex].caption} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'rgba(140,21,21,0.9)', color: 'white', padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
                {carouselImages[currentImageIndex].caption}
              </div>
              <button style={{...styles.carouselButton, right: 10}} onClick={nextImage}>〉</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '2rem' }}>
              <div style={{ background: '#FFFFFF', padding: '2rem', border: '1px solid #D5D1C4', textAlign: 'center' }}>
                <h4 style={{ color: '#8C1515', marginBottom: '1rem' }}>A - Single Room Blueprint</h4>
                <img 
                  src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80" 
                  alt="Single Room Blueprint" 
                  style={{ width: '100%', height: '250px', objectFit: 'cover', border: '1px solid #E5E5E5' }} 
                />
              </div>
              <div style={{ background: '#FFFFFF', padding: '2rem', border: '1px solid #D5D1C4', textAlign: 'center' }}>
                <h4 style={{ color: '#8C1515', marginBottom: '1rem' }}>B - Double Room Blueprint</h4>
                <img 
                  src="https://images.unsplash.com/photo-1628624747186-a941c476b7ef?auto=format&fit=crop&w=600&q=80" 
                  alt="Double Room Blueprint" 
                  style={{ width: '100%', height: '250px', objectFit: 'cover', border: '1px solid #E5E5E5' }} 
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'furnishings' && (
          <div className="animate-fade-in">
            <h2 style={styles.sectionTitle}>Furnishings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>
              <div>
                <div style={styles.textRow}>Wall-to-wall carpeting or Tile</div>
                <div style={styles.textRow}>Window coverings</div>
                <div style={styles.textRow}>High-speed internet access</div>
                <div style={styles.textRow}>Waste basket and recycling bin</div>
                <div style={styles.textRow}>Centralized Air Conditioning</div>
              </div>
              <div>
                <div style={styles.textRow}>Standard twin bed</div>
                <div style={styles.textRow}>Desk and chair</div>
                <div style={styles.textRow}>Bookcase</div>
                <div style={styles.textRow}>Dresser</div>
                <div style={styles.textRow}>Sink with mirror (in select rooms)</div>
              </div>
            </div>
            <p style={{ marginTop: '3rem', fontSize: '0.95rem', color: '#4D4F53', padding: '1.5rem', background: '#FFFFFF', border: '1px solid #D5D1C4' }}>
              Note: Students who want to bring their own beds may store the university-supplied bed at their own expense. No storage is available for unneeded furniture. Students provide their own cookware, dishes, utensils, towels, and other kitchen items.
            </p>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ backgroundColor: '#F0EFEA', padding: '3rem 2rem', marginTop: 'auto', borderTop: '1px solid #D5D1C4' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <h4 style={{ color: '#8C1515', margin: '0 0 0.5rem 0', fontFamily: "'Source Serif Pro', serif" }}>Residential & Dining Enterprises</h4>
            <p style={{ margin: 0, color: '#4D4F53', fontSize: '0.9rem' }}>Creating a Culture of Excellence</p>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#2E2D29', fontWeight: 600 }}>
            <span style={{cursor:'pointer'}}>Terms of Use</span>
            <span style={{cursor:'pointer'}}>Privacy</span>
            <span style={{cursor:'pointer'}}>Contact</span>
            <span style={{cursor:'pointer'}}>Careers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
