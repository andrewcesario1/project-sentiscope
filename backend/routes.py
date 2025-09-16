from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import firestore_config
import reddit_config
import re
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

def init_routes(app):
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"]
    )
    limiter.init_app(app)
    
    @app.route("/", methods=["GET"])
    def home():
        return jsonify({"message": "Welcome to Sentiscope!"})
    
    @app.route("/signup", methods=["POST"])
    @limiter.limit("5 per minute")
    def sign_up():
        try:
            new_user = request.get_json()
            if not new_user:
                return jsonify({"error": "Request body is required"}), 400
                
            required_fields = ["name", "email", "password", "plan"]
            missing_fields = [field for field in required_fields if field not in new_user]
            if missing_fields:
                return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
            
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, new_user["email"]):
                return jsonify({"error": "Invalid email format"}), 400
            
            if len(new_user["password"]) < 6:
                return jsonify({"error": "Password must be at least 6 characters long"}), 400
            
            try: 
                user = firestore_config.auth.create_user(
                    email=new_user["email"],
                    password=new_user["password"]
                )
            except Exception as e:
                error_msg = str(e)
                if "email already exists" in error_msg.lower():
                    return jsonify({"error": "An account with this email already exists"}), 409
                return jsonify({"error": "Failed to create user account"}), 500
            
            uid = user.uid

            try:
                custom_token = firestore_config.auth.create_custom_token(uid)
            except Exception as e:
                return jsonify({"error": "Failed to generate authentication token"}), 500

            try:
                user_ref = firestore_config.db.collection('users').document(str(uid))
                user_data = {
                    "name": new_user["name"],
                    "email": new_user["email"],
                    "plan": new_user["plan"],
                    "created_at": firestore_config.firestore.SERVER_TIMESTAMP
                } 
                user_ref.set(user_data)
            except Exception as e:
                return jsonify({"error": "Failed to save user data"}), 500

            return jsonify({
                "message": "User signed up successfully!",
                "custom_token": custom_token.decode('utf-8')
            }), 201
        except Exception as e:
            return jsonify({"error": "Internal server error"}), 500

    @app.route("/analyze", methods=["POST"])
    @limiter.limit("10 per minute")
    def analyze():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body is required"}), 400
                
            keyword = data.get("keyword")
            if not keyword or not keyword.strip():
                return jsonify({"error": "Keyword is required and cannot be empty"}), 400
            
            if len(keyword.strip()) < 2:
                return jsonify({"error": "Keyword must be at least 2 characters long"}), 400
            
            response = {
                "keyword": keyword.strip(),
                "sentiment": "Neutral",
                "confidence": 0.85
            }
            return jsonify(response)
        except Exception as e:
            return jsonify({"error": "Internal server error"}), 500
        

    @app.route("/fetch", methods=['GET'])
    @limiter.limit("20 per minute")
    def fetch_post():
        try:
            keyword = request.args.get('keyword', '').strip()
            limit = request.args.get('limit', '100')
            time_filter = request.args.get('filter', 'all')

            if not keyword:
                return jsonify({"error": "A valid keyword is required"}), 400

            try:
                limit = int(limit)
                if limit < 1 or limit > 1000:
                    return jsonify({"error": "Limit must be between 1 and 1000"}), 400
            except ValueError:
                return jsonify({"error": "Limit must be a valid number"}), 400

            valid_filters = ['all', 'day', 'week', 'month', 'year']
            if time_filter not in valid_filters:
                return jsonify({"error": f"Invalid time filter. Must be one of: {', '.join(valid_filters)}"}), 400

            try:
                posts_data = reddit_config.search_reddit_posts(keyword, limit, time_filter)

                all_posts = {}
                for post in posts_data:
                    post_data = post["data"]
                    subreddit_name = post_data.get("subreddit", "Unknown")
                    

                    if subreddit_name not in all_posts:
                        all_posts[subreddit_name] = []

                    permalink = post_data.get("permalink", "")
                    full_reddit_url = f"https://www.reddit.com{permalink}" if permalink else post_data.get("url", "https://reddit.com")

                    all_posts[subreddit_name].append({
                        "title": post_data.get("title", "Untitled"),
                        "text": post_data.get("selftext", ""),
                        "score": post_data.get("score", 0),
                        "num_comments": post_data.get("num_comments", 0), 
                        "url": full_reddit_url,
                        "author": post_data.get("author", "Unknown"),
                        "created_utc": post_data.get("created_utc", 0),
                        "is_video": post_data.get("is_video", False),
                        "upvote_ratio": post_data.get("upvote_ratio", 0),
                        "subreddit": subreddit_name
                    })

                return jsonify({
                        "keyword": keyword,
                        "total_subreddits": len(all_posts),
                        "subreddits": list(all_posts.keys()),
                        "posts": all_posts
                    })
                
            except Exception as e:
                return jsonify({"error": f"Search failed: {str(e)}"}), 500
            
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {str(e)}"}), 500
        
    
    @app.route("/generateSummary", methods=["POST"])
    @limiter.limit("5 per minute")
    def generateSummary():
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body is required"}), 400
                
            keyword = data.get("keyword", "").strip()
            sentiment_data = data.get("sentiment")
            posts = data.get("posts", [])

            if not keyword:
                return jsonify({"error": "Keyword is required"}), 400
            if not sentiment_data:
                return jsonify({"error": "Sentiment data is required"}), 400
            if not posts or not isinstance(posts, list):
                return jsonify({"error": "Posts array is required"}), 400

            required_sentiment_fields = ["sentiment", "positive_percentage", "negative_percentage"]
            if not all(field in sentiment_data for field in required_sentiment_fields):
                return jsonify({"error": "Invalid sentiment data structure"}), 400

            post_summaries = []
            for i, p in enumerate(posts[:6]):
                if isinstance(p, dict):
                    title = p.get('title', '')
                    text = p.get('text', '')
                    score = p.get('score', 0)
                    subreddit = p.get('subreddit', '')
                    
                    content = f"{title}. {text}".strip()
                    if len(content) > 150:
                        content = content[:150] + "..."
                    
                    if content and len(content.strip('. ')) > 10:
                        post_summaries.append(f"r/{subreddit}: {content} ({score} upvotes)")
                    elif title.strip():
                        post_summaries.append(f"r/{subreddit}: {title} ({score} upvotes)")
            
            if not post_summaries:
                return jsonify({"error": "No valid posts found for summary generation"}), 400
                
            system_prompt = (
                "You are an expert sentiment analyst specializing in Reddit community analysis. "
                "Provide comprehensive, insightful analysis that explains WHY the sentiment exists by examining actual post content and context. "
                "Use specific examples from posts to support your analysis. Create a well-structured, detailed summary with multiple sections. "
                "For financial topics, discuss whether the community is bullish/bearish and explain the reasoning."
            )

            prompt = (
                f"Analyze the sentiment for '{keyword}' based on Reddit community discussions.\n\n"
                f"SENTIMENT DATA:\n"
                f"Overall: {sentiment_data['sentiment']} ({sentiment_data.get('positive_percentage', 0)}% positive, {sentiment_data.get('negative_percentage', 0)}% negative)\n\n"
                f"SAMPLE POSTS:\n" + "\n".join(post_summaries) + "\n\n"
                f"Provide a comprehensive analysis with the following structure:\n\n"
                f"### 📊 Sentiment Overview\n"
                f"[Detailed explanation of why the sentiment is {sentiment_data['sentiment']} based on the post content and community discussions]\n\n"
                f"### 🔍 Key Themes & Insights\n"
                f"• **[Theme 1]:** [Detailed insight with specific examples from posts]\n"
                f"• **[Theme 2]:** [Another insight with context and evidence]\n"
                f"• **[Theme 3]:** [Third insight explaining sentiment drivers]\n"
                f"• **[Theme 4]:** [Additional insight about implications or trends]\n\n"
                f"### 💡 Community Perspective\n"
                f"[Explain what this sentiment tells us about how the community views this topic, including any notable patterns, concerns, or excitement]\n\n"
                f"### 🎯 What This Means\n"
                f"[Practical interpretation of the sentiment - what should someone understand about the community's current stance on this topic]"
                + (f"\n\n### ⚠️ Disclaimer\n[Standard investment disclaimer noting this is for informational purposes only]" if any(word in keyword.lower() for word in ['stock', 'crypto', 'invest', 'trade', '$', 'nvda', 'tesla', 'bitcoin', 'eth', 'amd', 'msft', 'aapl']) else "")
            )

            try:
                ai = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=700,
                    temperature=0.4
                )
                summary_text = ai.choices[0].message.content.strip()
            except Exception as e:
                return jsonify({"error": f"Failed to generate AI summary: {e}"}), 500

            return jsonify({
                "keyword": keyword,
                "summary": summary_text
            })
        except Exception as e:
            return jsonify({"error": "Internal server error"}), 500
