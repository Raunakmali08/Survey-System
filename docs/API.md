# Survey System API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST /auth/refresh
Refresh JWT token.

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /auth/logout
Logout the current user.

**Response:** `204 No Content`

---

### Surveys

#### GET /surveys
List all surveys for authenticated user.

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20) - Items per page
- `status` (string) - Filter by status (draft, published, closed)
- `sort` (string) - Sort field (createdAt, name, responses)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Customer Satisfaction",
      "description": "How satisfied are you?",
      "status": "published",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z",
      "responseCount": 42,
      "version": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

#### POST /surveys
Create a new survey.

**Request:**
```json
{
  "title": "Customer Satisfaction",
  "description": "How satisfied are you?",
  "questions": [
    {
      "id": "q1",
      "type": "rating",
      "text": "How satisfied are you?",
      "scale": 5,
      "required": true
    },
    {
      "id": "q2",
      "type": "text",
      "text": "Additional comments?",
      "required": false
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "title": "Customer Satisfaction",
  "description": "How satisfied are you?",
  "status": "draft",
  "questions": [...],
  "createdAt": "2024-01-15T10:00:00Z",
  "version": 1
}
```

#### GET /surveys/:id
Get survey details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Customer Satisfaction",
  "description": "How satisfied are you?",
  "status": "published",
  "questions": [...],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "version": 1
}
```

#### PATCH /surveys/:id
Update survey (with version for conflict detection).

**Request:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "published",
  "version": 1
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Updated Title",
  "updatedAt": "2024-01-15T11:00:00Z",
  "version": 2
}
```

**Error: Conflict**
```json
{
  "error": "VERSION_CONFLICT",
  "message": "Survey was updated by another user",
  "currentVersion": 2
}
```

#### DELETE /surveys/:id
Delete survey.

**Response:** `204 No Content`

---

### Responses

#### POST /surveys/:surveyId/responses
Submit survey response (auto-save compatible).

**Request:**
```json
{
  "responseId": "uuid",
  "answers": [
    {
      "questionId": "q1",
      "value": 5
    },
    {
      "questionId": "q2",
      "value": "Great product"
    }
  ],
  "version": 1
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "surveyId": "uuid",
  "answers": [...],
  "submittedAt": "2024-01-15T10:05:00Z",
  "version": 1,
  "conflicts": null
}
```

#### PATCH /surveys/:surveyId/responses/:responseId
Update response (auto-save).

**Request:**
```json
{
  "answers": [
    {
      "questionId": "q1",
      "value": 4
    }
  ],
  "version": 1
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "updatedAt": "2024-01-15T10:10:00Z",
  "version": 2,
  "conflicts": null
}
```

**Error: Version Conflict**
```json
{
  "error": "VERSION_CONFLICT",
  "message": "Response was modified",
  "serverVersion": 2,
  "clientVersion": 1,
  "conflicts": [
    {
      "questionId": "q1",
      "clientValue": 4,
      "serverValue": 5
    }
  ]
}
```

#### GET /surveys/:surveyId/responses
List responses for survey.

**Query Parameters:**
- `page` (integer) - Pagination
- `limit` (integer) - Items per page
- `status` (string) - Filter by status

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "surveyId": "uuid",
      "submittedAt": "2024-01-15T10:05:00Z",
      "answers": [...]
    }
  ],
  "pagination": {...}
}
```

#### GET /surveys/:surveyId/responses/analytics
Get survey analytics.

**Response:** `200 OK`
```json
{
  "surveyId": "uuid",
  "totalResponses": 42,
  "completionRate": 85,
  "questions": [
    {
      "id": "q1",
      "text": "How satisfied are you?",
      "type": "rating",
      "results": {
        "1": 2,
        "2": 5,
        "3": 10,
        "4": 15,
        "5": 10
      },
      "average": 3.8
    }
  ]
}
```

---

### Health & Status

#### GET /health
Health check endpoint.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 86400,
  "services": {
    "database": "connected",
    "redis": "connected"
  },
  "version": "1.0.0"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication token missing or invalid"
}
```

### 403 Forbidden
```json
{
  "error": "FORBIDDEN",
  "message": "You do not have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "NOT_FOUND",
  "message": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "VERSION_CONFLICT",
  "message": "Resource was modified by another user",
  "currentVersion": 2
}
```

### 429 Too Many Requests
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests, please retry after 60 seconds",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "requestId": "req-uuid-for-debugging"
}
```

---

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **Survey endpoints**: 100 requests per minute per user
- **Response submission**: 1000 requests per minute per user
- **WebSocket**: 1000 messages per minute per connection

---

## Versioning & Conflict Resolution

All mutable resources implement optimistic concurrency control:

1. Client sends `version` with update request
2. Server compares with current version
3. If versions match: Update succeeds, new version returned
4. If versions differ: Return 409 Conflict with server version and conflicts
5. Client triggers UI conflict dialog for user to resolve

---

## Pagination

List endpoints support pagination:

```
GET /surveys?page=2&limit=10&sort=-createdAt
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

---

## Request Tracing

All responses include a request ID for debugging:

```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

Include this in bug reports for tracking.

---

## Examples

### Complete Survey Flow

```bash
# 1. Create survey
curl -X POST http://localhost:3000/api/surveys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @survey.json

# 2. Get survey ID from response
SURVEY_ID="uuid"

# 3. Submit response
curl -X POST http://localhost:3000/api/surveys/$SURVEY_ID/responses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @response.json

# 4. Get analytics
curl http://localhost:3000/api/surveys/$SURVEY_ID/responses/analytics \
  -H "Authorization: Bearer $TOKEN"
```

