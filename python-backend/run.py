#!/usr/bin/env python3
"""
Simple runner script for the video processing backend
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == '__main__':
    from app import app
    
    host = os.getenv('HOST', '127.0.0.1')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"🚀 Starting video processing server on {host}:{port}")
    print(f"📝 Debug mode: {debug}")
    print(f"🔗 Health check: http://{host}:{port}/health")
    
    app.run(host=host, port=port, debug=debug)