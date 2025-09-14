import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { Navigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
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

interface SummaryResponse {
  summary: string;
}


type TimeFilter = "all" | "day" | "week" | "month" | "year";
type ActiveTab = "sentiment" | "posts" | "summary" | "visualization";

const HomePage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [sentiment, setSentiment] = useState<SentimentResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("sentiment");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [user] = useAuthState(auth);

  useEffect(() => {
    const trackVisit = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      try {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data()! : {};
        const last = data.lastVisit?.toDate?.() || new Date(0);
        if (Date.now() - last.getTime() > 2 * 60 * 60 * 1000) {
          await setDoc(
            userRef,
            {
              visits: (data.visits || 0) + 1,
              lastVisit: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (e) {
        // Visit tracking failed silently
      }
    };
    trackVisit();
  }, [user]);


  if (!user) return <Navigate to="/" replace />;

  const handleAnalyze = async (): Promise<void> => {
    if (!query.trim()) {
      setError("Please enter a keyword to analyze");
      return;
    }

    setError(null);
    setPosts([]);
    setSentiment(null);
    setSummary(null);
    setLoading(true);
    setCurrentPage(1);
  
    try {
      const limit = 100;
      let mdlData: SentimentResponse;
      let allPosts: Post[] = [];
  
      if (timeFilter === "all") {
        const mdlRes = await fetch(`http://localhost:5001/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: [query] }),
        });
        
        if (!mdlRes.ok) {
          const errorData = await mdlRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Model prediction failed");
        }
        mdlData = await mdlRes.json();
  
        const rRes = await fetch(
          `${API_BASE}/fetch?keyword=${encodeURIComponent(query)}&limit=${limit}`
        );
        
        if (!rRes.ok) {
          const errorData = await rRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch Reddit posts");
        }
        
        const rd = await rRes.json();
        allPosts = Object.entries(rd.posts || {}).flatMap(([sub, arr]) =>
          Array.isArray(arr)
            ? (arr as any[]).map((p) => ({ ...p, subreddit: sub }))
            : []
        );
      } else {
        const rRes = await fetch(
          `${API_BASE}/fetch?keyword=${encodeURIComponent(query)}&limit=${limit}&filter=${timeFilter}`
        );
        
        if (!rRes.ok) {
          const errorData = await rRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch filtered Reddit posts");
        }
        
        const rd = await rRes.json();
        allPosts = Object.entries(rd.posts || {}).flatMap(([sub, arr]) =>
          Array.isArray(arr)
            ? (arr as any[]).map((p) => ({ ...p, subreddit: sub }))
            : []
        );
  
        const texts = allPosts.map((p) => p.text || p.title).filter(Boolean);
        if (texts.length === 0) {
          throw new Error("No valid text found in posts for analysis");
        }
        
        const mdlRes = await fetch(`http://localhost:5001/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts }),
        });
        
        if (!mdlRes.ok) {
          const errorData = await mdlRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Model prediction failed");
        }
        mdlData = await mdlRes.json();
      }
  
      const sRes = await fetch(`${API_BASE}/generateSummary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: query,
          sentiment: mdlData,
          posts: allPosts,
        }),
      });
      
      if (!sRes.ok) {
        const errorData = await sRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Summary generation failed");
      }
      
      const sData: SummaryResponse = await sRes.json();
  
      setSentiment(mdlData);
      setPosts(allPosts);
      setSummary(sData);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { sentiments: increment(1) }).catch(() =>
          setDoc(userRef, { sentiments: 1 }, { merge: true })
        );
        
        const snap = await getDoc(userRef);
        const oldRec: string[] =
          snap.exists() && Array.isArray(snap.data()?.recent)
            ? snap.data()!.recent
            : [];
        await updateDoc(userRef, { recent: [query, ...oldRec] }).catch(() =>
          setDoc(userRef, { recent: [query] }, { merge: true })
        );
      } catch (trackingError) {
        // Fail silently
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const barData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      counts[p.subreddit] = (counts[p.subreddit] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([subreddit, count]) => ({ subreddit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString();
  
  const hasResultsOrError = posts.length > 0 || sentiment || summary || error;

  const postsPerPage = 10;
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(posts.length / postsPerPage);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  return (
    <div className={`hp-container ${hasResultsOrError ? 'results-visible' : ''}`}>
      <div className="hp-hero">
        <div className="hp-search-card">
            <h2 className="hp-title">Sentiment Analysis</h2>
            <p className="hp-subtitle">Enter a keyword, select a time frame, and get instant insights from Reddit.</p>
            
            <div className="hp-search-form">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Enter keyword or phrase"
                    className="hp-search-input"
                />
                
                <div className="hp-controls-row">
                    <div className="hp-filter-container">
                        <div className="hp-filter-dropdown">
                            <button
                                className="hp-filter-button"
                                onClick={() => setFilterOpen(o => !o)}
                            >
                                <span>Filter: <strong>{timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}</strong></span>
                                <span className="hp-dropdown-arrow">{filterOpen ? "▲" : "▼"}</span>
                            </button>
                            {filterOpen && (
                                <div className="hp-filter-menu">
                                {["all","day","week","month","year"].map(opt => (
                                    <div
                                    key={opt}
                                    className={`hp-filter-menu-item ${timeFilter===opt?"active":""}`}
                                    onClick={() => {
                                        setTimeFilter(opt as any);
                                        setFilterOpen(false);
                                    }}
                                    >
                                    {opt.charAt(0).toUpperCase()+opt.slice(1)}
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
                            disabled={loading || !query.trim()}
                        >
                            {loading ? "Analyzing…" : "Analyze"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {(sentiment || posts.length > 0 || summary || error) && (
        <div className="hp-results-section" ref={resultsRef}>
            {error && <p className="hp-error">{error}</p>}

            {(sentiment || posts.length > 0 || summary) && (
                <>
                <div className="hp-tabs">
                    <button className={activeTab === "sentiment" ? "active" : ""} onClick={() => setActiveTab("sentiment")}>Sentiment Analysis</button>
                    <button className={activeTab === "posts" ? "active" : ""} onClick={() => setActiveTab("posts")}>Fetched Posts ({posts.length})</button>
                    <button className={activeTab === "summary" ? "active" : ""} onClick={() => setActiveTab("summary")}>Summary</button>
                    <button className={activeTab === "visualization" ? "active" : ""} onClick={() => setActiveTab("visualization")}>Visualization</button>
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
                        <h3>Found {posts.length} posts</h3>
                        <ul className="hp-posts-list">
                            {currentPosts.map((post, index) => (
                            <li key={index} className="hp-post-item">
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
                                <a href={post.url} target="_blank" rel="noopener noreferrer">Link</a>
                            </li>
                            ))}
                        </ul>
                        {totalPages > 1 && (
                          <div className="hp-pagination">
                            <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                              &larr; Previous
                            </button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                              Next &rarr;
                            </button>
                          </div>
                        )}
                    </div>
                    )}

                    {activeTab === "summary" && summary && (
                    <div className="hp-summary-container">
                        <h3>AI Summary</h3>
                        <p>{summary.summary}</p>
                    </div>
                    )}

                    {activeTab === "visualization" && sentiment && (
                    <div className="hp-graphs">
                        <div className="hp-chart-container">
                            <h4>Positive Sentiment</h4>
                            <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                data={[
                                    { name: "Positive", value: sentiment.positive_percentage },
                                    { name: "Other",    value: 100 - sentiment.positive_percentage },
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
                                <Tooltip formatter={(val: number) => `${val.toFixed(1)}%`} 
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
                            <ResponsiveContainer width="100%" height={250}>
                            <BarChart
                                data={barData}
                                margin={{ top: 20, right: 20, left: 0, bottom: 100 }}
                            >
                                <defs>
                                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getComputedStyle(document.documentElement).getPropertyValue('--primary-color-start')} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={getComputedStyle(document.documentElement).getPropertyValue('--primary-color-end')} stopOpacity={0.1}/>
                                    </linearGradient>
                                </defs>
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
                                <Bar dataKey="count" name="Posts" fill="url(#colorUv)" />
                            </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    )}
                </div> 
                </>
            )}
        </div>
      )}
    </div>
  );
};

export default HomePage;
