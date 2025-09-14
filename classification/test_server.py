import pytest
import json
from unittest.mock import patch, MagicMock
from server import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_clean_text():
    """Test the clean_text function with various inputs."""
    from server import clean_text
    
    # Test normal text
    result = clean_text("Hello World! This is a test.")
    assert isinstance(result, str)
    assert len(result) > 0
    
    # Test empty string
    result = clean_text("")
    assert result == ""
    
    # Test non-string input
    result = clean_text(123)
    assert result == ""
    
    # Test text with URLs
    result = clean_text("Check out https://example.com for more info")
    assert "https://example.com" not in result
    
    # Test text with numbers
    result = clean_text("I have 5 cats and 3 dogs")
    assert "5" not in result
    assert "3" not in result

def test_predict_missing_data(client):
    """Test predict endpoint with missing request body."""
    response = client.post('/predict')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Request body is required' in data['error']

def test_predict_missing_texts(client):
    """Test predict endpoint with missing texts field."""
    response = client.post('/predict', json={})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Texts array is required' in data['error']

def test_predict_empty_texts(client):
    """Test predict endpoint with empty texts array."""
    response = client.post('/predict', json={"texts": []})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Texts must be a non-empty array' in data['error']

def test_predict_invalid_texts(client):
    """Test predict endpoint with invalid texts format."""
    response = client.post('/predict', json={"texts": "not an array"})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Texts must be a non-empty array' in data['error']

@patch('server.vectorizer.transform')
@patch('server.LRmodel.predict_proba')
def test_predict_success(mock_predict, mock_transform, client):
    """Test successful prediction."""
    # Mock the vectorizer and model
    mock_transform.return_value = MagicMock()
    mock_predict.return_value = [[0.3, 0.7], [0.8, 0.2]]  # [negative, positive] probabilities
    
    response = client.post('/predict', json={"texts": ["I love this!", "This is terrible."]})
    assert response.status_code == 200
    data = json.loads(response.data)
    
    assert 'sentiment' in data
    assert 'positive_percentage' in data
    assert 'negative_percentage' in data
    assert data['sentiment'] in ['Positive', 'Negative']
    assert isinstance(data['positive_percentage'], (int, float))
    assert isinstance(data['negative_percentage'], (int, float))

def test_predict_no_valid_text(client):
    """Test predict endpoint with no valid text after cleaning."""
    response = client.post('/predict', json={"texts": ["", "   ", "123"]})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'No valid text found for analysis' in data['error']

def test_predict_large_input(client):
    """Test predict endpoint with large input (should be limited)."""
    large_texts = ["test"] * 1500  # More than 1000 limit
    response = client.post('/predict', json={"texts": large_texts})
    # Should still work but be limited to 1000
    assert response.status_code == 200

@patch('server.vectorizer.transform')
@patch('server.LRmodel.predict_proba')
def test_predict_positive_sentiment(mock_predict, mock_transform, client):
    """Test prediction with positive sentiment."""
    mock_transform.return_value = MagicMock()
    mock_predict.return_value = [[0.2, 0.8]]  # 80% positive
    
    response = client.post('/predict', json={"texts": ["I love this product!"]})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['sentiment'] == 'Positive'
    assert data['positive_percentage'] > data['negative_percentage']

@patch('server.vectorizer.transform')
@patch('server.LRmodel.predict_proba')
def test_predict_negative_sentiment(mock_predict, mock_transform, client):
    """Test prediction with negative sentiment."""
    mock_transform.return_value = MagicMock()
    mock_predict.return_value = [[0.9, 0.1]]  # 90% negative
    
    response = client.post('/predict', json={"texts": ["This is terrible!"]})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['sentiment'] == 'Negative'
    assert data['negative_percentage'] > data['positive_percentage']

def test_predict_error_handling(client):
    """Test predict endpoint error handling."""
    with patch('server.vectorizer.transform', side_effect=Exception("Vectorizer error")):
        response = client.post('/predict', json={"texts": ["test"]})
        assert response.status_code == 500
        data = json.loads(response.data)
        assert 'An error occurred during prediction' in data['error']
