# High-Availability Survey System

A production-ready, scalable survey platform built with Node.js, Express, PostgreSQL, Redis, RabbitMQ, and React. Designed for high availability, real-time synchronization, and offline-first capabilities.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## ✨ Features

### Core Functionality
- ✅ Create and manage surveys
- ✅ Real-time response collection
- ✅ Live data synchronization across clients
- ✅ WebSocket integration for instant updates
- ✅ Auto-save with debouncing and conflict resolution

### High Availability
- ✅ Connection pooling for database
- ✅ Redis caching and session management
- ✅ RabbitMQ for async messaging
- ✅ Circuit breaker pattern for resilience
- ✅ Graceful degradation and error handling
- ✅ Health checks and monitoring

### Offline Support
- ✅ IndexedDB for offline persistence
- ✅ Service worker integration
- ✅ Automatic sync when online
- ✅ Conflict resolution strategies

### Security
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ CORS configuration
- ✅ Input validation and sanitization
- ✅ Rate limiting ready

### Developer Experience
- ✅ Docker Compose for local development
- ✅ Comprehensive logging
- ✅ Request tracing
- ✅ Structured error handling
- ✅ Hot reload support

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React SPA                                           │  │
│  │  - Survey Form Component                            │  │
│  │  - Survey List Component                            │  │
│  │  - useAutoSave Hook (debounced)                      │  │
│  │  - useWebSocket Hook (real-time)                     │  │
│  │  - IndexedDB Storage (offline support)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                         │
│  Express Server with Middleware                             │
│  - Authentication (JWT)                                     │
│  - Request Logging                                          │
│  - Error Handling                                           │
│  - Rate Limiting (ready)                                    │
└─────────────────────────────────────────────────────────────┘
      ▼ Routes            ▼ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌────────────────┬────────────────┬─────────────────────┐ │
│  │ Survey Routes  │Response Routes │ Health Routes       │ │
│  └────────────────┴────────────────┴─────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Services & Modules                                     │ │
│  │ - Auto-save Service (optimistic locking)             │ │
│  │ - Redis Manager (caching/sessions)                   │ │
│  │ - Message Queue (async tasks)                         │ │
│  │ - Circuit Breaker (resilience)                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ▼              ▼              ▼
┌─────────────┬─────────────┬──────────────┐
│ PostgreSQL  │   Redis     │  RabbitMQ    │
│ (Data)      │ (Cache)     │  (Queue)     │
│             │ (Sessions)  │  (Events)    │
└─────────────┴─────────────┴──────────────┘
```

### Data Flow - Auto-Save Example

```
User Input
    ▼
Debounce (1 second)
    ▼
useAutoSave Hook
    ▼
Send to API (/responses/:id)
    ▼
Server receives with version
    ▼
Check version for conflicts
    ├─ No conflict: Update DB, broadcast via WebSocket
    ├─ Conflict: Return version, client triggers UI conflict dialog
    └─ Retry with exp backoff if temp error
    ▼
Update Redis cache
    ▼
Publish to RabbitMQ for processing
    ▼
Response sent to client
    ▼
Client updates UI optimistically or shows conflict
```

## 🚀 Prerequisites

- **Node.js**: >=18.0.0
- **npm**: >=9.0.0
- **Docker & Docker Compose**: Latest stable
- **Git**: For version control

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone <repository>
cd Survey-System
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Environment

```bash
# Start all services (database, cache, queue)
npm run dev

# Or run individually:
docker-compose up -d          # Start services
npm run dev:server            # Terminal 1: Start backend
npm run dev:client            # Terminal 2: Start frontend
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## 📁 Project Structure

```
Survey-System/
├── package.json                 # Root package (monorepo)
├── docker-compose.yml           # Local dev environment
├── Dockerfile                   # Backend container
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── README.md                    # This file
│
├── docs/
│   └── API.md                   # API documentation
│
├── scripts/
│   ├── init-db.sh              # Database initialization
│   └── deploy.sh               # Deployment script
│
├── server/                      # Backend (Node.js/Express)
│   ├── package.json
│   ├── index.js                # Entry point
│   ├── config/
│   │   ├── config.js           # Configuration loader
│   │   └── logger.js           # Logger setup
│   ├── database/
│   │   ├── schema.sql          # Database schema
│   │   └── pool.js             # Connection pool
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   ├── errorHandler.js     # Global error handler
│   │   └── requestLogger.js    # HTTP request logging
│   ├── modules/
│   │   ├── redis-manager.js    # Redis operations
│   │   ├── message-queue.js    # RabbitMQ integration
│   │   └── circuit-breaker.js  # Circuit breaker pattern
│   ├── routes/
│   │   ├── surveys.js          # Survey CRUD
│   │   ├── responses.js        # Response collection
│   │   └── health.js           # Health checks
│   ├── services/
│   │   └── auto-save.js        # Auto-save with versioning
│   └── .env                    # Server env (gitignored)
│
└── client/                      # Frontend (React)
    ├── package.json
    ├── public/
    │   └── index.html          # HTML template
    ├── src/
    │   ├── index.js            # React entry point
    │   ├── App.jsx             # Root component
    │   ├── components/
    │   │   ├── SurveyForm.jsx   # Form component
    │   │   └── SurveyList.jsx   # List component
    │   ├── hooks/
    │   │   ├── useAutoSave.js   # Auto-save hook
    │   │   └── useWebSocket.js  # WebSocket hook
    │   ├── services/
    │   │   ├── api.js           # API client
    │   │   └── storage.js       # IndexedDB wrapper
    │   └── index.css            # Global styles
    └── .env                    # Client env
```

## 🔧 Development

### Backend Development

```bash
cd server
npm install
npm run dev

# Available commands:
npm run dev           # Start with hot reload
npm start            # Production start
npm test             # Run tests
npm run lint         # Run linter
```

### Frontend Development

```bash
cd client
npm install
npm run dev

# Available commands:
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview build
npm test             # Run tests
npm run lint         # Run linter
```

### Database

```bash
# Initialize database
./scripts/init-db.sh

# View logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U surveyapp -d survey_db
```

### Redis & RabbitMQ

```bash
# View Redis
docker-compose exec redis redis-cli -a redispass
INFO

# View RabbitMQ
# Open http://localhost:15672 in browser (guest/guest)

# Check logs
docker-compose logs redis
docker-compose logs rabbitmq
```

## 🌍 Deployment

### Docker Build

```bash
# Build image
npm run docker:build

# Push to registry
npm run docker:push
```

### Deploy Script

```bash
./scripts/deploy.sh production

# This script:
# 1. Pulls latest code
# 2. Builds Docker image
# 3. Pulls latest images for dependencies
# 4. Runs migrations
# 5. Deploys with zero downtime
```

### Production Checklist

- [ ] Set `.env` with production secrets
- [ ] Configure database backups
- [ ] Set up monitoring and alerting
- [ ] Configure SSL/TLS certificates
- [ ] Set up log aggregation
- [ ] Configure auto-scaling
- [ ] Load testing completed
- [ ] Security audit passed

## 📚 API Documentation

See [docs/API.md](./docs/API.md) for complete API reference including:
- Survey endpoints
- Response endpoints
- Health checks
- WebSocket events
- Error codes

## 🔐 Security

- **Environment Variables**: Never commit `.env` files
- **JWT**: Tokens stored in secure HTTP-only cookies
- **CORS**: Configured for allowed origins
- **Input Validation**: All inputs validated server-side
- **Rate Limiting**: Ready for implementation
- **SQL Injection**: Protected via parameterized queries

## 📊 Monitoring

- **Health Checks**: `/health` endpoint with detailed status
- **Metrics**: Prometheus-ready (future)
- **Logging**: Structured JSON logging to stdout
- **Error Tracking**: Sentry integration ready
- **APM**: Application Performance Monitoring ready

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues, questions, or suggestions:
1. Check existing issues
2. Create a new issue with detailed description
3. Contact the team

## 🗺️ Roadmap

- [ ] GraphQL API option
- [ ] Real-time analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Advanced export formats (PDF, Excel)
- [ ] Custom theming
- [ ] AI-powered insights
- [ ] Integration with popular survey tools

---

**Built with ❤️ for high availability and real-time collaboration**
