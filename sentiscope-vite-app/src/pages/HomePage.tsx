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
import { Wordcloud } from '@visx/wordcloud';
import { Text } from '@visx/text';
// Simple markdown-to-HTML converter for basic formatting
const convertMarkdownToHtml = (markdown: string): string => {
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/^### (.*$)/gim, '<h3>$1</h3>') // H3
    .replace(/^## (.*$)/gim, '<h2>$1</h2>') // H2
    .replace(/^# (.*$)/gim, '<h1>$1</h1>') // H1
    .replace(/^• (.*$)/gim, '<li>$1</li>') // List items
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>') // Wrap list items
    .replace(/\n\n/g, '</p><p>') // Paragraphs
    .replace(/^(.+)$/gm, '<p>$1</p>') // Wrap remaining lines in paragraphs
    .replace(/<p><h/g, '<h') // Fix headers in paragraphs
    .replace(/<\/h([1-6])><\/p>/g, '</h$1>') // Fix headers in paragraphs
    .replace(/<p><ul>/g, '<ul>') // Fix lists in paragraphs
    .replace(/<\/ul><\/p>/g, '</ul>') // Fix lists in paragraphs
    .replace(/<p><\/p>/g, ''); // Remove empty paragraphs
};
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
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("sentiment");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [user] = useAuthState(auth);

  // Async summary generation function
  const generateSummaryAsync = async (keyword: string, sentimentData: SentimentResponse, posts: Post[]) => {
    setSummaryLoading(true);
    try {
      const sRes = await fetch(`${API_BASE}/generateSummary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword,
          sentiment: sentimentData,
          posts: posts,
        }),
      });
      
      if (sRes.ok) {
        const sData: SummaryResponse = await sRes.json();
        setSummary(sData);
      } else {
        console.warn("Summary generation failed, but not blocking main results");
      }
    } catch (error) {
      console.warn("Summary generation error:", error);
    } finally {
      setSummaryLoading(false);
    }
  };

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
    setSummaryLoading(false);
    setLoading(true);
    setCurrentPage(1);
    setActiveTab("sentiment");
  
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
  
  
      setSentiment(mdlData);
      setPosts(allPosts);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Generate summary asynchronously without blocking results
      generateSummaryAsync(query, mdlData, allPosts);
  
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
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
    return Object.entries(counts)
      .map(([subreddit, count], index) => ({ 
        subreddit, 
        count, 
        fill: colors[index % colors.length] 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [posts]);

  const wordCloudData = React.useMemo(() => {
    if (posts.length === 0) return [];
    
    // Comprehensive list of common words to filter out
    const stopWords = new Set([
      // Articles, conjunctions, prepositions
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'among', 'under', 'over', 'out', 'off', 'down', 'within', 'without', 'against',
      
      // Verbs
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'get', 'got', 'getting',
      'go', 'going', 'went', 'gone', 'come', 'came', 'coming', 'see', 'saw', 'seen', 'seeing',
      'know', 'knew', 'known', 'think', 'thought', 'thinking', 'want', 'wanted', 'wanting',
      'make', 'made', 'making', 'take', 'took', 'taken', 'taking', 'give', 'gave', 'given', 'giving',
      
      // Pronouns
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'myself', 'yourself', 'himself',
      'herself', 'itself', 'ourselves', 'yourselves', 'themselves', 'this', 'that', 'these', 'those',
      
      // Common adverbs and adjectives
      'not', 'no', 'yes', 'so', 'just', 'only', 'also', 'well', 'still', 'even', 'never',
      'always', 'often', 'sometimes', 'usually', 'really', 'very', 'quite', 'too', 'much',
      'many', 'more', 'most', 'less', 'least', 'some', 'any', 'all', 'every', 'each',
      'few', 'several', 'both', 'either', 'neither', 'other', 'another', 'such', 'same',
      
      // Time and place
      'now', 'then', 'here', 'there', 'where', 'when', 'how', 'why', 'today', 'yesterday',
      'tomorrow', 'ago', 'since', 'until', 'while', 'once', 'twice', 'again', 'back',
      
      // Question words and others
      'what', 'who', 'which', 'whose', 'whom', 'whatever', 'whoever', 'whichever',
      
      // Numbers and quantifiers
      'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third', 'last', 'next',
      'previous', 'final', 'initial', 'original', 'new', 'old', 'young', 'long', 'short',
      'high', 'low', 'big', 'small', 'large', 'little', 'great', 'good', 'bad', 'best',
      'worst', 'better', 'worse', 'right', 'wrong', 'true', 'false', 'sure', 'certain',
      
      // Common Reddit/internet words
      'like', 'said', 'say', 'says', 'saying', 'tell', 'told', 'telling', 'ask', 'asked',
      'asking', 'look', 'looking', 'looks', 'looked', 'find', 'found', 'finding', 'try',
      'trying', 'tried', 'use', 'used', 'using', 'work', 'working', 'worked', 'need',
      'needed', 'needing', 'put', 'putting', 'call', 'called', 'calling', 'than', 'then',
      'way', 'ways', 'thing', 'things', 'stuff', 'people', 'person', 'guy', 'guys',
      'man', 'men', 'woman', 'women', 'time', 'times', 'day', 'days', 'year', 'years',
      'week', 'weeks', 'month', 'months', 'hour', 'hours', 'minute', 'minutes'
    ]);

    const wordCounts: Record<string, number> = {};
    
    posts.forEach(post => {
      const text = `${post.title} ${post.text}`.toLowerCase();
      const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
      
      words.forEach(word => {
        if (!stopWords.has(word) && word.length > 2) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    // Sort by text to ensure consistent ordering
    return Object.entries(wordCounts)
      .filter(([_, count]) => count > 1) // Only words that appear more than once
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) // Sort by count, then alphabetically for stability
      .slice(0, 50) // Top 50 words
      .map(([text, value]) => ({ text, value }));
  }, [posts.length, posts.map(p => `${p.title}${p.text}`).join('')]);

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

                    {activeTab === "summary" && (
                    <div className="hp-summary-container">
                        <h3>AI Summary</h3>
                        {summaryLoading ? (
                            <div className="hp-summary-loading">
                                <div className="hp-loading-spinner"></div>
                                <p>Generating AI insights from Reddit posts...</p>
                            </div>
                        ) : summary ? (
                            <div 
                                className="hp-summary-content"
                                dangerouslySetInnerHTML={{
                                    __html: typeof summary.summary === 'string' 
                                        ? convertMarkdownToHtml(summary.summary)
                                        : '<p>Unable to load summary</p>'
                                }}
                            />
                        ) : (
                            <div className="hp-summary-placeholder">
                                <p>No summary available. Try running an analysis first.</p>
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
                        {wordCloudData.length > 0 && (
                        <div className="hp-chart-container hp-wordcloud-container">
                            <h4>Common Words</h4>
                            <div style={{ width: '100%', height: '320px' }}>
                                <svg width="100%" height="100%">
                                    <Wordcloud
                                        key={`wordcloud-${posts.length}-${wordCloudData.length}`}
                                        words={wordCloudData}
                                        width={580}
                                        height={320}
                                        fontSize={(datum) => {
                                            const maxValue = Math.max(...wordCloudData.map(w => w.value));
                                            const minValue = Math.min(...wordCloudData.map(w => w.value));
                                            const scale = (datum.value - minValue) / (maxValue - minValue);
                                            return 12 + scale * 48; // Range from 12 to 60
                                        }}
                                        rotate={(datum) => {
                                            // Create deterministic rotation based on word text
                                            let hash = 0;
                                            for (let i = 0; i < datum.text.length; i++) {
                                                const char = datum.text.charCodeAt(i);
                                                hash = ((hash << 5) - hash) + char;
                                                hash = hash & hash; // Convert to 32-bit integer
                                            }
                                            return ((hash % 120) - 60); // Range from -60 to 60 degrees
                                        }}
                                        padding={2}
                                    >
                                        {(cloudWords) =>
                                            cloudWords.map((w, i) => {
                                                const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
                                                return (
                                                    <Text
                                                        key={w.text}
                                                        fill={colors[i % colors.length]}
                                                        textAnchor="middle"
                                                        transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
                                                        fontSize={w.size}
                                                        fontFamily="Inter, system-ui, sans-serif"
                                                        fontWeight={600}
                                                    >
                                                        {w.text}
                                                    </Text>
                                                );
                                            })
                                        }
                                    </Wordcloud>
                                </svg>
                            </div>
                        </div>
                        )}
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
