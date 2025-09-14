import "../styles/AboutPage.css";

const AboutPage = () => {
  return (
    <div className="about-page">
      <div className="about-content">
        <h1>About Sentiscope</h1>
        <p className="about-description">
          Sentiscope is a sentiment analysis tool that helps you gauge the public sentiment on any keyword by analyzing Reddit posts in real-time.
        </p>
        
        <div className="features-section">
          <h2>Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>Real-time Analysis</h3>
              <p>Get instant sentiment analysis from the latest Reddit discussions</p>
            </div>
            <div className="feature-card">
              <h3>Time Filtering</h3>
              <p>Filter posts by time periods to understand sentiment trends</p>
            </div>
            <div className="feature-card">
              <h3>AI Summaries</h3>
              <p>Get intelligent summaries of the sentiment and key insights</p>
            </div>
            <div className="feature-card">
              <h3>Visualizations</h3>
              <p>Beautiful charts and graphs to understand data at a glance</p>
            </div>
          </div>
        </div>

        <div className="roadmap-section">
          <h2>Coming Soon</h2>
          <ul className="roadmap-list">
            <li>Enhanced ML model for improved accuracy</li>
            <li>More data sources beyond Reddit</li>
            <li>Advanced analytics and trend tracking</li>
            <li>Team collaboration features</li>
            <li>API access for developers</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
