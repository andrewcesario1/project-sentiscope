import React, { useState, useRef } from "react";
import { auth } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { Navigate, Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import "../styles/HomePage.css";

const API_BASE = "http://localhost:5000";

interface Post {
  title: string;
  text: string;
  score: number;
  num_comments: number;
  url: string;
  author: string;
  created_utc: number;
  is_video: boolean;
  upvote_ratio: number;
  subreddit: string;
}

interface SentimentResponse {
  sentiment: string;
  positive_percentage: number;
  negative_percentage: number;
}

type TimeFilter = "all" | "day" | "week" | "month" | "year";
type ActiveTab = "sentiment" | "posts" | "summary" | "visualization";

const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString();

const GuestPage: React.FC = () => {
  const [user] = useAuthState(auth);
  if (user) return <Navigate to="/home" replace />;

  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [sentiment, setSentiment] = useState<SentimentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("sentiment");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Guest limitation - only allow 3 searches
  const [searchCount, setSearchCount] = useState(0);
  const MAX_GUEST_SEARCHES = 3;

  const handleAnalyze = async () => {
    if (searchCount >= MAX_GUEST_SEARCHES) {
      setError(`Guest users are limited to ${MAX_GUEST_SEARCHES} searches. Please sign up for unlimited access.`);
      return;
    }

    if (!query.trim()) return;

    setError(null);
    setLoading(true);
    setPosts([]);
    setSentiment(null);
    setActiveTab("sentiment"); // Always default to sentiment tab

    try {
      const limit = 50; // Reduced limit for guests (vs 100 for authenticated users)

      // Fetch posts
      const rRes = await fetch(
        `${API_BASE}/fetch?keyword=${encodeURIComponent(query)}&limit=${limit}&filter=${timeFilter}`
      );
      if (!rRes.ok) throw new Error("Failed to fetch Reddit posts");
      const rd = await rRes.json();

      const fetchedPosts = Object.entries(rd.posts || {}).flatMap(
        ([sub, arr]) =>
          Array.isArray(arr)
            ? (arr as any[]).map((p) => ({ ...p, subreddit: sub }))
            : []
      );

      // Get sentiment prediction
      const texts = fetchedPosts
        .map((p) => `${p.title} ${p.text}`)
        .filter((t) => t.trim())
        .slice(0, 20); // Limit texts for guests

      if (texts.length === 0) {
        throw new Error("No valid posts found for sentiment analysis");
      }

      const mdlRes = await fetch(`http://localhost:5001/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      if (!mdlRes.ok) throw new Error("Sentiment analysis failed");
      const mdlData = await mdlRes.json();

      setSentiment(mdlData);
      setPosts(fetchedPosts);
      setSearchCount(prev => prev + 1);

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleAnalyze();
    }
  };

  // Create chart data
  const subredditCounts = posts.reduce((acc, post) => {
    acc[post.subreddit] = (acc[post.subreddit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(subredditCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([subreddit, count], index) => {
      const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];
      return {
        subreddit: `r/${subreddit}`,
        count,
        fill: colors[index % colors.length]
      };
    });

  const postsPerPage = 10;
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const currentPosts = posts.slice(startIndex, startIndex + postsPerPage);

  const hasResults = sentiment || posts.length > 0;

  return (
    <div className={`hp-container ${hasResults ? 'results-visible' : ''}`}>
      <div className="hp-hero">
        <div className="hp-search-card">
          <h1 className="hp-title">Sentiscope</h1>
          <p className="hp-subtitle">
            Discover sentiment insights from Reddit discussions. 
            <br />
            <strong>Guest Access:</strong> {MAX_GUEST_SEARCHES - searchCount} searches remaining.{" "}
            <Link to="/signup" style={{ color: 'var(--primary-color)', fontWeight: '600' }}>
              Sign up
            </Link>{" "}
            for unlimited access and premium features.
          </p>

          <div className="hp-search-form">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a keyword or phrase to analyze..."
              className="hp-search-input"
            />

            <div className="hp-controls-row">
              <div className="hp-filter-container">
                <div className="hp-filter-dropdown">
                  <button
                    className="hp-filter-button"
                    onClick={() => setFilterOpen(!filterOpen)}
                  >
                    Filter: {timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}
                    <span className={`hp-dropdown-arrow ${filterOpen ? 'rotated' : ''}`}>▼</span>
                  </button>
                  {filterOpen && (
                    <div className="hp-filter-menu">
                      {(["all", "day", "week", "month", "year"] as TimeFilter[]).map((option) => (
                        <div
                          key={option}
                          className={`hp-filter-menu-item ${timeFilter === option ? 'active' : ''}`}
                          onClick={() => {
                            setTimeFilter(option);
                            setFilterOpen(false);
                          }}
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="hp-analyze-container">
                <button
                  onClick={handleAnalyze}
                  className="hp-analyze-button"
                  disabled={loading || !query.trim() || searchCount >= MAX_GUEST_SEARCHES}
                >
                  {loading ? "Analyzing…" : "Analyze"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="hp-results-section">
          <div style={{ 
            background: '#fee2e2', 
            border: '1px solid #fecaca', 
            borderRadius: '12px', 
            padding: '1rem', 
            color: '#dc2626',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            {error}
          </div>
        </div>
      )}

      {hasResults && (
        <div className="hp-results-section" ref={resultsRef}>
          <div className="hp-tabs">
            <button
              className={activeTab === "sentiment" ? "active" : ""}
              onClick={() => setActiveTab("sentiment")}
            >
              Sentiment Analysis
            </button>
            <button
              className={activeTab === "posts" ? "active" : ""}
              onClick={() => setActiveTab("posts")}
            >
              Fetched Posts ({posts.length})
            </button>
            <button
              className="disabled"
              disabled
              title="Sign up to access AI-powered summaries"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              Summary 🔒
            </button>
            <button
              className={activeTab === "visualization" ? "active" : ""}
              onClick={() => setActiveTab("visualization")}
            >
              Visualization
            </button>
          </div>

          <div className="hp-pane">
            {activeTab === "sentiment" && sentiment && (
              <div className="hp-sentiment-container">
                <div className="hp-sentiment-card">
                  <h3>Overall Sentiment</h3>
                  <p>{sentiment.sentiment}</p>
                </div>
                <div className="hp-sentiment-card">
                  <h3>Positive</h3>
                  <p>{sentiment.positive_percentage}%</p>
                </div>
                <div className="hp-sentiment-card">
                  <h3>Negative</h3>
                  <p>{sentiment.negative_percentage}%</p>
                </div>
              </div>
            )}

            {activeTab === "posts" && posts.length > 0 && (
              <div className="hp-posts-container">
                <h3>Found {posts.length} posts (Guest limit: 50 posts)</h3>
                <ul className="hp-posts-list">
                  {currentPosts.map((post, i) => (
                    <li key={startIndex + i} className="hp-post-item">
                      <h4>{post.title}</h4>
                      <div className="hp-post-meta">
                        <span>r/{post.subreddit}</span> – 
                        <span> Posted by u/{post.author}</span> – 
                        <span> {formatDate(post.created_utc)}</span>
                      </div>
                      <div className="hp-post-stats">
                        <span>Score: {post.score}</span> – 
                        <span>Comments: {post.num_comments}</span> – 
                        <span>Upvote ratio: {(post.upvote_ratio * 100).toFixed(0)}%</span>
                        {post.is_video && <span> – Video</span>}
                      </div>
                      {post.text && (
                        <div className="hp-post-text">
                          {post.text.length > 300
                            ? `${post.text.slice(0, 300)}…`
                            : post.text}
                        </div>
                      )}
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Link
                      </a>
                    </li>
                  ))}
                </ul>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    marginTop: '2rem',
                    flexWrap: 'wrap'
                  }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          padding: '0.5rem 1rem',
                          border: currentPage === page ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                          background: currentPage === page ? 'var(--primary-color)' : 'white',
                          color: currentPage === page ? 'white' : 'var(--text-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: currentPage === page ? '600' : '500'
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "visualization" && sentiment && (
              <div className="hp-graphs">
                <div className="hp-chart-container">
                  <h4>Positive Sentiment</h4>
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Positive", value: sentiment.positive_percentage },
                          { name: "Other", value: 100 - sentiment.positive_percentage },
                        ]}
                        dataKey="value"
                        innerRadius={70}
                        outerRadius={100}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {[sentiment.positive_percentage, 100 - sentiment.positive_percentage].map(
                          (v, i) => (
                            <Cell
                              key={i}
                              fill={
                                i === 0
                                  ? v > 70
                                    ? "#1e8e3e" // Good
                                    : v >= 50
                                    ? "#fbbc04" // Mid
                                    : "#d93025" // Bad
                                  : "rgba(0, 0, 0, 0.05)"
                              }
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip 
                        formatter={(val: number) => `${val.toFixed(1)}%`} 
                        contentStyle={{ 
                          backgroundColor: 'var(--card-background)', 
                          borderColor: 'var(--border-color)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="hp-chart-container">
                  <h4>Top Subreddits</h4>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={barData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis
                        dataKey="subreddit"
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 10, fill: "var(--text-color-secondary)" }}
                      />
                      <YAxis tick={{ fill: 'var(--text-color-secondary)' }}/>
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: 'var(--card-background)', 
                          borderColor: 'var(--border-color)'
                        }}
                      />
                      <Legend wrapperStyle={{ color: 'var(--text-color)' }}/>
                      <Bar dataKey="count" name="Posts">
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #0ea5e9',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  marginTop: '2rem'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#0369a1' }}>🔒 Premium Features</h4>
                  <p style={{ margin: '0 0 1rem 0', color: '#0369a1' }}>
                    Word clouds, advanced analytics, and unlimited searches available with a free account.
                  </p>
                  <Link 
                    to="/signup" 
                    style={{
                      display: 'inline-block',
                      background: 'var(--primary-gradient)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    Sign Up Free
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestPage;