# Transaction Ledger API

A RESTful backend API for managing a simple transaction ledger system — create accounts, record credit/debit transactions, check balances, browse history, and transfer money between accounts.

---

## Tech Stack

| Layer       | Technology              |
|-------------|-------------------------|
| Runtime     | Node.js ≥ 18            |
| Framework   | Express.js 4            |
| Database    | MongoDB (via Mongoose 8)|
| Validation  | express-validator 7     |
| Env config  | dotenv                  |
| Logging     | morgan                  |

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18.x  |
| npm         | ≥ 9.x   |
| MongoDB     | ≥ 6.x (local) **or** MongoDB Atlas |

> **MongoDB note:** Multi-document transactions (used for atomicity) require a **replica set** or **MongoDB Atlas** cluster. A local standalone `mongod` does **not** support sessions by default.  
> The easiest local option is to start MongoDB as a single-node replica set (see below).

---

## Local Setup

### 1. Clone / navigate to the project

```bash
cd transaction-ledger
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if needed:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/transaction_ledger
```

### 4. Start MongoDB as a replica set (required for transactions)

**Option A — Docker (recommended)**

```bash
docker run -d \
  --name mongo-rs \
  -p 27017:27017 \
  mongo:7 \
  --replSet rs0
```

Then initialise the replica set (run once):

```bash
docker exec -it mongo-rs mongosh --eval "rs.initiate()"
```

**Option B — Local `mongod`**

```bash
# In a separate terminal
mongod --replSet rs0 --bind_ip localhost --port 27017 --dbpath /data/db

# Initialise (run once in another terminal)
mongosh --eval "rs.initiate()"
```

### 5. Start the API

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The server starts at: **http://localhost:3000**

---

## Health Check

```
GET /health
```

Response:
```json
{ "success": true, "status": "ok", "timestamp": "..." }
```

---

## Running Tests

```bash
# Run all tests (uses an in-memory MongoDB replica set — no external DB needed)
npm test

# Run with coverage report
npm run test:coverage
```

> Tests use [`mongodb-memory-server`](https://github.com/typegoose/mongodb-memory-server) to spin up an ephemeral single-node replica set in-process. No running MongoDB instance is required.

### Test Coverage

| Suite | File | Cases |
|---|---|---|
| Health / 404 | `tests/health.test.js` | 2 |
| Account — Create | `tests/accounts/create.test.js` | 10 |
| Account — Balance | `tests/accounts/balance.test.js` | 5 |
| Transaction — Create | `tests/transactions/create.test.js` | 22 |
| Transaction — History | `tests/transactions/list.test.js` | 20 |
| Transfer | `tests/transfers/transfer.test.js` | 20 |
| **Total** | | **~79** |

---

## API Base URL

```
http://localhost:3000/api/v1
```

---

## Project Structure

```
transaction-ledger/
├── src/
│   ├── app.js                   # Express app entry point
│   ├── config/
│   │   └── db.js                # MongoDB connection
│   ├── models/
│   │   ├── Account.js           # Account schema
│   │   └── Transaction.js       # Transaction schema (immutable)
│   ├── controllers/
│   │   ├── accountController.js
│   │   ├── transactionController.js
│   │   └── transferController.js
│   ├── routes/
│   │   ├── accountRoutes.js
│   │   ├── transactionRoutes.js
│   │   └── transferRoutes.js
│   ├── validators/
│   │   ├── accountValidator.js
│   │   ├── transactionValidator.js
│   │   └── transferValidator.js
│   └── middlewares/
│       ├── validate.js          # Runs express-validator result
│       └── errorHandler.js      # Global error handler + AppError
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Key Design Decisions

1. **UUID primary keys** — `_id` on both `Account` and `Transaction` uses `uuid v4` (string). This avoids leaking MongoDB ObjectId implementation details and produces clean, human-readable IDs.

2. **Atomic operations via Mongo transactions** — Every write that touches both a `Transaction` document and the `Account.balance` runs inside a `mongoose.startSession()` / `session.withTransaction()` block, ensuring true atomicity.

3. **Running balance on account** — Rather than re-computing balance by summing all transactions on every read, the balance is kept as a denormalised field and updated atomically with each transaction. This makes balance reads O(1).

4. **Transaction immutability** — No update or delete endpoints are exposed for transactions. The schema does not include an `updatedAt` field.

5. **Per-account reference_id uniqueness** — Enforced via a compound MongoDB index `{ account_id: 1, reference_id: 1 }` with `unique: true`. The same `reference_id` may be reused across different accounts.

6. **Transfer leg reference IDs** — For the transfer endpoint, the debit and credit legs use `${reference_id}:debit` and `${reference_id}:credit` respectively, maintaining a clean audit trail while satisfying per-account uniqueness.

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": [                   // only present for validation failures
    { "field": "amount", "message": "amount must be greater than 0" }
  ]
}
```

---

## Assumptions

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for full endpoint reference.
