from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import pickle
import numpy as np
import re
import string
import nltk
from nltk import WordNetLemmatizer
from nltk import PorterStemmer
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from flask_cors import CORS


nltk.download('stopwords')
nltk.download('wordnet')

stop_word = nltk.corpus.stopwords.words('english')

vectorizer_path = os.path.join(os.path.dirname(__file__), "vectoriser.pkl")
model_path = os.path.join(os.path.dirname(__file__), "sentiscope.pkl")

app = Flask(__name__)
CORS(app)

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per hour", "20 per minute"]
)
limiter.init_app(app)

with open(model_path, "rb") as model_file:
    LRmodel = pickle.load(model_file)

with open(vectorizer_path, "rb") as vec_file:
    vectorizer = pickle.load(vec_file)


def clean_text(text):
    """
    Clean and preprocess text for sentiment analysis.
    
    Args:
        text (str): Raw text to be cleaned
        
    Returns:
        str: Cleaned and preprocessed text
    """
    try:
        if not isinstance(text, str):
            return ""
            
        text = text.lower()
        text = re.sub(r'/[^\s]+', '', text)  # Remove URLs
        text = re.sub(r'https?://[^\s]+', '', text)  # Remove HTTP URLs
        text = re.sub(r'[0-9]+', '', text)  # Remove numbers
        text = "".join([char for char in text if char not in string.punctuation])
        
        stemmer = PorterStemmer()
        lemmatizer = WordNetLemmatizer()
        words = text.split()
        words = [word for word in words if word not in stop_word]
        words = [lemmatizer.lemmatize(word) for word in words]
        words = [stemmer.stem(word) for word in words]
        return " ".join(words).strip()
    except Exception:
        return ""

@app.route("/predict", methods=["POST"])
@limiter.limit("30 per minute")
def predict():
    """
    Predict sentiment of provided texts using trained ML model.
    
    Expected JSON payload:
    {
        "texts": ["text1", "text2", ...]
    }
    
    Returns:
    {
        "sentiment": "Positive" or "Negative",
        "positive_percentage": float,
        "negative_percentage": float
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        if 'texts' not in data:
            return jsonify({'error': 'Texts array is required'}), 400

        texts = data['texts']
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({'error': 'Texts must be a non-empty array'}), 400

        # Clean and validate texts
        cleaned_texts = []
        for item in texts:
            if isinstance(item, str) and item.strip():
                cleaned = clean_text(item.strip())
                if cleaned:
                    cleaned_texts.append(cleaned)
        
        if not cleaned_texts:
            return jsonify({'error': 'No valid text found for analysis'}), 400

        # Limit to prevent resource exhaustion
        if len(cleaned_texts) > 1000:
            cleaned_texts = cleaned_texts[:1000]

        vectorized_texts = vectorizer.transform(cleaned_texts)
        predictions = LRmodel.predict_proba(vectorized_texts)
        
        positive_percentage = np.mean([prob[1] for prob in predictions]) * 100  
        negative_percentage = np.mean([prob[0] for prob in predictions]) * 100 
        sentiment = "Positive" if positive_percentage > negative_percentage else "Negative"

        return jsonify({
            'sentiment': sentiment,
            'positive_percentage': round(positive_percentage, 2),
            'negative_percentage': round(negative_percentage, 2)
        })
    
    except Exception as e:
        return jsonify({'error': 'An error occurred during prediction'}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)