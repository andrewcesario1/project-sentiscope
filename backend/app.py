from flask import Flask, request, jsonify
from firestore_config import db
from routes import init_routes
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os

def create_app():
    app = Flask(__name__)
    
    # Initialize rate limiter
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"]
    )
    limiter.init_app(app)
    
    # Security headers
    @app.after_request
    def after_request(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response
    
    # Configure CORS with specific origins in production
    if os.getenv('FLASK_ENV') == 'production':
        CORS(app, origins=['https://yourdomain.com'])
    else:
        CORS(app)
    
    init_routes(app)
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=False)
