# Survey System - Setup & Getting Started Guide

## ✅ Project Complete!

Your production-ready High-Availability Survey System has been successfully created at `~/Survey-System`.

## 📦 What Was Created

### Root Directory Files
- **package.json** - Monorepo configuration with workspaces
- **docker-compose.yml** - Local development environment with PostgreSQL, Redis, RabbitMQ
- **Dockerfile** - Backend container for production deployment
- **.env.example** - Environment variables template
- **.gitignore** - Git ignore patterns for Node/React
- **README.md** - Comprehensive project documentation
- **docs/API.md** - Complete API reference

### Scripts Directory
- **scripts/init-db.sh** - Database initialization script
- **scripts/deploy.sh** - Production deployment script

### Server (Node.js/Express Backend)
```
server/
├── index.js - Express server entry point with WebSocket support
├── package.json - Backend dependencies
├── .env - Development environment variables
├── config/
│   ├── config.js - Configuration loader
│   └── logger.js - Winston logging setup
├── database/
│   ├── schema.sql - PostgreSQL database schema
│   └── pool.js - Connection pool management
├── middleware/
│   ├── auth.js - JWT authentication & token generation
│   ├── errorHandler.js - Global error handler
│   └── requestLogger.js - HTTP request logging with request IDs
├── modules/
│   ├── redis-manager.js - Redis client wrapper
│   ├── message-queue.js - RabbitMQ integration
│   └── circuit-breaker.js - Circuit breaker pattern implementation
├── routes/
│   ├── surveys.js - Survey CRUD endpoints
│   ├── responses.js - Response collection & analytics
│   └── health.js - Health check endpoints
└── services/
    └── auto-save.js - Auto-save with debouncing & conflict resolution
```

### Client (React Frontend)
```
client/
├── package.json - Frontend dependencies
├── vite.config.js - Vite configuration
├── .env - React environment variables
├── public/
│   └── index.html - HTML template with service worker support
└── src/
    ├── index.js - React entry point
    ├── App.jsx - Root component
    ├── index.css - Global styles with responsive design
    ├── components/
    │   ├── SurveyForm.jsx - Survey form with auto-save
    │   └── SurveyList.jsx - Survey listing component
    ├── hooks/
    │   ├── useAutoSave.js - Auto-save hook with debouncing
    │   └── useWebSocket.js - WebSocket connection hook
    └── services/
        ├── api.js - API client with offline support
        └── storage.js - IndexedDB wrapper for local storage
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd ~/Survey-System
npm install
```

### 2. Start Docker Services
```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **RabbitMQ** on port 5672 (management UI: http://localhost:15672)

### 3. Initialize Database
```bash
chmod +x scripts/init-db.sh
./scripts/init-db.sh
```

### 4. Start Development Servers

**In Terminal 1 - Backend:**
```bash
cd server
npm install
npm run dev
# Runs on http://localhost:3000
```

**In Terminal 2 - Frontend:**
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:3001 (proxied to backend)
```

### 5. Access Application
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health
- **RabbitMQ UI**: http://localhost:15672 (guest/guest)

## 📋 Key Features

### Backend Features
✅ Express.js REST API with WebSocket support
✅ PostgreSQL with connection pooling
✅ Redis session/cache management
✅ RabbitMQ for async message processing
✅ JWT authentication with bcrypt hashing
✅ Circuit breaker pattern for resilience
✅ Optimistic locking with version control for conflict detection
✅ Comprehensive logging with Winston
✅ Health check endpoints for monitoring
✅ Graceful shutdown handling

### Frontend Features
✅ React with Vite for fast development
✅ Auto-save with 1-second debouncing
✅ Real-time updates via WebSocket
✅ IndexedDB for offline persistence
✅ Conflict resolution UI
✅ Service Worker support
✅ Responsive design
✅ Request tracing with unique IDs

### Database Features
✅ JSONB support for flexible data
✅ Automatic timestamp triggers
✅ Performance indexes on common queries
✅ Audit logging capability
✅ Versioning for optimistic locking

## 🔧 Configuration

### Server Configuration (.env)
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=surveyapp
DB_PASSWORD=surveysecret
REDIS_HOST=localhost
RABBITMQ_HOST=localhost
JWT_SECRET=your-secret-key
LOG_LEVEL=info
```

### Client Configuration (.env)
```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=ws://localhost:3000/ws
```

## 📚 API Endpoints

### Surveys
- `GET /api/surveys` - List surveys (paginated)
- `POST /api/surveys` - Create survey
- `GET /api/surveys/:id` - Get survey details
- `PATCH /api/surveys/:id` - Update survey (with version control)
- `DELETE /api/surveys/:id` - Delete survey

### Responses
- `POST /api/surveys/:surveyId/responses` - Submit/save response
- `GET /api/surveys/:surveyId/responses` - List responses
- `GET /api/surveys/:surveyId/responses/analytics` - Get analytics
- `POST /api/surveys/:surveyId/responses/:responseId/complete` - Complete response

### Health
- `GET /health` - Full health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

See **docs/API.md** for complete endpoint documentation.

## 🧪 Testing

### Backend Tests
```bash
cd server
npm test
npm run test:watch
```

### Frontend Tests
```bash
cd client
npm test
npm run test:watch
```

### Linting
```bash
npm run lint              # Check all
npm run lint:server       # Backend only
npm run lint:client       # Frontend only
npm run lint:fix          # Auto-fix
```

## 🐳 Docker

### Build Docker Image
```bash
npm run docker:build
```

### Run Container
```bash
docker run -p 3000:3000 survey-system:latest
```

### Deploy to Production
```bash
./scripts/deploy.sh production v1.0.0
```

## 📊 Monitoring & Debugging

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f rabbitmq
docker-compose logs -f backend
```

### Database Access
```bash
docker-compose exec postgres psql -U surveyapp -d survey_db

# List tables
\dt

# View surveys
SELECT * FROM surveys;
```

### Redis CLI
```bash
docker-compose exec redis redis-cli -a redispass
```

### RabbitMQ Management
Open http://localhost:15672 in browser (guest/guest)

## 🔐 Security Considerations

### Development
- ✅ Default credentials for local dev only
- ✅ JWT secret should be changed in production
- ✅ CORS configured for development

### Production Checklist
- [ ] Change all default passwords/secrets in .env
- [ ] Use environment-specific secrets manager
- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable database encryption
- [ ] Configure automated backups
- [ ] Set up monitoring and alerting
- [ ] Perform security audit
- [ ] Configure log aggregation

## 🚀 Production Deployment

### Prerequisites
- Docker & Docker Compose
- Kubernetes cluster (optional, for scaling)
- PostgreSQL managed database
- Redis managed service
- RabbitMQ managed service

### Deployment Steps
1. Build Docker image: `npm run docker:build`
2. Push to registry: `npm run docker:push`
3. Run deployment script: `./scripts/deploy.sh production`
4. Verify health: `curl http://your-domain/health`

## 📞 Support & Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check database is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify credentials
docker-compose exec postgres psql -U surveyapp -c "\conninfo"
```

**Redis Connection Error**
```bash
# Check Redis is running
docker-compose exec redis redis-cli -a redispass ping
```

**RabbitMQ Connection Error**
```bash
# Check RabbitMQ status
docker-compose logs rabbitmq

# Access management UI
open http://localhost:15672
```

**Port Already in Use**
```bash
# Kill process using port
lsof -ti:3000 | xargs kill -9
# Or change PORT in .env
```

## 📚 Documentation

- **README.md** - Project overview and features
- **docs/API.md** - Complete API documentation
- **Architecture** - See ASCII diagrams in README.md
- **Code Comments** - Inline documentation in critical sections

## 🛠️ Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create Pull Request

## 📈 Scaling Considerations

- **Horizontal Scaling**: Use multiple backend instances with load balancer
- **Database**: Use read replicas for analytics queries
- **Cache**: Redis cluster for distributed caching
- **Queue**: RabbitMQ clustering for message reliability
- **Storage**: Move response data to time-series DB for large scale

## 🎯 Next Steps

1. **Customize**: Update branding and configuration
2. **Add Auth**: Implement user registration/login
3. **Deploy**: Follow production deployment checklist
4. **Monitor**: Set up APM and error tracking
5. **Scale**: Optimize for your expected load

## 📝 License

MIT - See LICENSE file for details

---

**Questions or Issues?** Check docs/API.md or review inline code comments.

**Ready to Build?** Start with `npm install` and `docker-compose up -d` 🚀
