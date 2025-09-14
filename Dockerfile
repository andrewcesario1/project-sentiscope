# Multi-stage build for Sentiscope
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY sentiscope-vite-app/package*.json ./
RUN npm ci --only=production

COPY sentiscope-vite-app/ ./
RUN npm run build

# Python backend
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY classification/requirements.txt ./classification-requirements.txt
RUN pip install --no-cache-dir -r classification-requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY classification/ ./classification/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create non-root user
RUN useradd -m -u 1000 sentiscope && chown -R sentiscope:sentiscope /app
USER sentiscope

# Expose ports
EXPOSE 5000 5001

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Start services
CMD ["sh", "-c", "cd classification && python server.py & cd ../backend && python app.py"]
