import pytest
import json
from unittest.mock import patch, MagicMock
from app import create_app

@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    return app

@pytest.fixture
def client(app):
    return app.test_client()

def test_home_endpoint(client):
    response = client.get('/')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['message'] == 'Welcome to Sentiscope!'

def test_signup_missing_fields(client):
    response = client.post('/signup', json={})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Missing required fields' in data['error']

def test_signup_invalid_email(client):
    user_data = {
        "name": "Test User",
        "email": "invalid-email",
        "password": "password123",
        "plan": "free"
    }
    response = client.post('/signup', json=user_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Invalid email format' in data['error']

def test_signup_short_password(client):
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "123",
        "plan": "free"
    }
    response = client.post('/signup', json=user_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Password must be at least 6 characters long' in data['error']

@patch('routes.firestore_config.auth.create_user')
def test_signup_success(mock_create_user, client):
    mock_user = MagicMock()
    mock_user.uid = 'test-uid'
    mock_create_user.return_value = mock_user
    
    with patch('routes.firestore_config.auth.create_custom_token') as mock_token, \
         patch('routes.firestore_config.db.collection') as mock_collection:
        
        mock_token.return_value = b'test-token'
        mock_doc = MagicMock()
        mock_collection.return_value.document.return_value = mock_doc
        
        user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "password123",
            "plan": "free"
        }
        
        response = client.post('/signup', json=user_data)
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'User signed up successfully!'
        assert 'custom_token' in data

def test_analyze_missing_keyword(client):
    response = client.post('/analyze', json={})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Keyword is required' in data['error']

def test_analyze_empty_keyword(client):
    response = client.post('/analyze', json={"keyword": "   "})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Keyword is required and cannot be empty' in data['error']

def test_analyze_short_keyword(client):
    response = client.post('/analyze', json={"keyword": "a"})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Keyword must be at least 2 characters long' in data['error']

def test_analyze_success(client):
    response = client.post('/analyze', json={"keyword": "artificial intelligence"})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'keyword' in data
    assert 'sentiment' in data
    assert 'confidence' in data

def test_fetch_missing_keyword(client):
    response = client.get('/fetch')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'A valid keyword is required' in data['error']

def test_fetch_invalid_limit(client):
    response = client.get('/fetch?keyword=test&limit=invalid')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Limit must be a valid number' in data['error']

def test_fetch_invalid_filter(client):
    response = client.get('/fetch?keyword=test&filter=invalid')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Invalid time filter' in data['error']

def test_generate_summary_missing_data(client):
    response = client.post('/generateSummary', json={})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Request body is required' in data['error']

def test_generate_summary_missing_keyword(client):
    response = client.post('/generateSummary', json={"sentiment": {}, "posts": []})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Keyword is required' in data['error']

def test_generate_summary_missing_sentiment(client):
    response = client.post('/generateSummary', json={"keyword": "test", "posts": []})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Sentiment data is required' in data['error']

def test_generate_summary_missing_posts(client):
    response = client.post('/generateSummary', json={"keyword": "test", "sentiment": {}})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Posts array is required' in data['error']
