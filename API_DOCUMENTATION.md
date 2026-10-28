# API Documentation — Transaction Ledger

**Base URL:** `http://localhost:3000/api/v1`

**Content-Type:** `application/json` for all requests and responses.

---

## Table of Contents

1. [Create Account](#1-create-account)
2. [Get Account Balance](#2-get-account-balance)
3. [Add Transaction](#3-add-transaction)
4. [Get Transaction History](#4-get-transaction-history)
5. [Money Transfer (Bonus)](#5-money-transfer-bonus)
6. [Error Codes Reference](#6-error-codes-reference)

---

## 1. Create Account

Creates a new account. Balance is always initialised to `0` by the server.

**`POST /accounts`**

### Request Body

| Field  | Type   | Required | Description             |
|--------|--------|----------|-------------------------|
| `name` | string | ✅       | Full name of the account holder |

> ⚠️ Sending a `balance` field is rejected with `422`.

### Example Request

```bash
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{ "name": "Alice Johnson" }'
```

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "c3a1e2d4-1234-4abc-9def-000000000001",
    "name": "Alice Johnson",
    "balance": 0,
    "created_at": "2024-11-01T10:00:00.000Z"
  }
}
```

### Error Responses

| Status | Condition                        |
|--------|----------------------------------|
| `422`  | `name` is missing or empty       |
| `422`  | `balance` field is present       |

---

## 2. Get Account Balance

Returns the current balance for a specific account.

**`GET /accounts/:accountId/balance`**

### Path Parameters

| Parameter   | Type   | Description       |
|-------------|--------|-------------------|
| `accountId` | string | The account's UUID |

### Example Request

```bash
curl http://localhost:3000/api/v1/accounts/c3a1e2d4-1234-4abc-9def-000000000001/balance
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "account_id": "c3a1e2d4-1234-4abc-9def-000000000001",
    "name": "Alice Johnson",
    "balance": 150.00
  }
}
```

### Error Responses

| Status | Condition                  |
|--------|----------------------------|
| `404`  | Account ID does not exist  |

---

## 3. Add Transaction

Records a credit or debit transaction on an account and updates the balance atomically.

**`POST /accounts/:accountId/transactions`**

### Path Parameters

| Parameter   | Type   | Description        |
|-------------|--------|--------------------|
| `accountId` | string | The account's UUID |

### Request Body

| Field          | Type   | Required | Description                             |
|----------------|--------|----------|-----------------------------------------|
| `type`         | string | ✅       | `"credit"` or `"debit"`                |
| `amount`       | number | ✅       | Positive number greater than `0`        |
| `reference_id` | string | ✅       | Unique identifier for this transaction (per account) |
| `description`  | string | ❌       | Optional human-readable description     |

### Example — Credit

```bash
curl -X POST http://localhost:3000/api/v1/accounts/c3a1e2d4-1234-4abc-9def-000000000001/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 200,
    "reference_id": "INV-2024-001",
    "description": "Invoice payment received"
  }'
```

### Example — Debit

```bash
curl -X POST http://localhost:3000/api/v1/accounts/c3a1e2d4-1234-4abc-9def-000000000001/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debit",
    "amount": 50,
    "reference_id": "EXP-2024-042",
    "description": "Office supplies"
  }'
```

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": "a1b2c3d4-5678-4abc-9def-000000000002",
    "account_id": "c3a1e2d4-1234-4abc-9def-000000000001",
    "type": "credit",
    "amount": 200,
    "description": "Invoice payment received",
    "reference_id": "INV-2024-001",
    "created_at": "2024-11-01T10:05:00.000Z"
  }
}
```

### Error Responses

| Status | Condition                                                    |
|--------|--------------------------------------------------------------|
| `404`  | Account ID does not exist                                    |
| `409`  | `reference_id` already used for this account (duplicate)    |
| `422`  | Debit amount exceeds current balance (insufficient funds)    |
| `422`  | Validation failure (missing fields, bad type, amount ≤ 0)   |

### Duplicate Transaction Behaviour

If the same `reference_id` is submitted again for the **same account**, the API returns `409` and the account balance is **not changed**. No new transaction document is created.

---

## 4. Get Transaction History

Retrieves a paginated and filtered list of transactions for an account, sorted latest-first.

**`GET /accounts/:accountId/transactions`**

### Path Parameters

| Parameter   | Type   | Description        |
|-------------|--------|--------------------|
| `accountId` | string | The account's UUID |

### Query Parameters

| Parameter | Type    | Default | Description                                     |
|-----------|---------|---------|-------------------------------------------------|
| `type`    | string  | —       | Filter by `"credit"` or `"debit"` (optional)    |
| `page`    | integer | `1`     | Page number (min: `1`)                          |
| `limit`   | integer | `10`    | Records per page (min: `1`, max: `100`)         |

### Example Requests

```bash
# All transactions, page 1
curl "http://localhost:3000/api/v1/accounts/c3a1e2d4-1234-4abc-9def-000000000001/transactions"

# Only credits, page 2, 5 per page
curl "http://localhost:3000/api/v1/accounts/c3a1e2d4-1234-4abc-9def-000000000001/transactions?type=credit&page=2&limit=5"
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "a1b2c3d4-5678-4abc-9def-000000000002",
        "account_id": "c3a1e2d4-1234-4abc-9def-000000000001",
        "type": "credit",
        "amount": 200,
        "description": "Invoice payment received",
        "reference_id": "INV-2024-001",
        "created_at": "2024-11-01T10:05:00.000Z"
      }
    ],
    "pagination": {
      "total_records": 12,
      "total_pages": 2,
      "current_page": 1,
      "page_size": 10
    }
  }
}
```

### Error Responses

| Status | Condition                         |
|--------|-----------------------------------|
| `404`  | Account ID does not exist         |
| `422`  | Invalid `type`, `page`, or `limit` |

---

## 5. Money Transfer (Bonus)

Atomically transfers funds from one account to another. Both legs (debit + credit) are committed in a single MongoDB transaction — a partial transfer is impossible.

**`POST /transfers`**

### Request Body

| Field             | Type   | Required | Description                                    |
|-------------------|--------|----------|------------------------------------------------|
| `from_account_id` | string | ✅       | Source account UUID                            |
| `to_account_id`   | string | ✅       | Destination account UUID (must differ from source) |
| `amount`          | number | ✅       | Positive amount to transfer                    |
| `reference_id`    | string | ✅       | Unique reference for this transfer             |
| `description`     | string | ❌       | Optional description                           |

### Example Request

```bash
curl -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from_account_id": "c3a1e2d4-1234-4abc-9def-000000000001",
    "to_account_id":   "f9e8d7c6-5432-4abc-9def-000000000003",
    "amount": 75,
    "reference_id": "TXF-2024-001",
    "description": "Rent payment"
  }'
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Transfer completed successfully",
  "data": {
    "reference_id": "TXF-2024-001",
    "amount": 75,
    "from_account": {
      "account_id": "c3a1e2d4-1234-4abc-9def-000000000001",
      "new_balance": 125,
      "transaction_id": "tx-debit-uuid"
    },
    "to_account": {
      "account_id": "f9e8d7c6-5432-4abc-9def-000000000003",
      "new_balance": 175,
      "transaction_id": "tx-credit-uuid"
    }
  }
}
```

### Error Responses

| Status | Condition                                          |
|--------|----------------------------------------------------|
| `404`  | Source account not found                           |
| `404`  | Destination account not found                      |
| `409`  | Transfer with this `reference_id` already executed |
| `422`  | Insufficient balance in source account             |
| `422`  | `from_account_id` equals `to_account_id`           |
| `422`  | Validation failure                                 |

---

## 6. Error Codes Reference

| HTTP Status | Meaning                                      |
|-------------|----------------------------------------------|
| `201`       | Resource created successfully                |
| `200`       | Request succeeded                            |
| `400`       | Bad request (malformed data / cast error)    |
| `404`       | Resource not found                           |
| `409`       | Conflict (duplicate reference_id)            |
| `422`       | Unprocessable — validation or business rule  |
| `500`       | Internal server error                        |

### Standard Error Body

```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": [
    { "field": "amount", "message": "amount must be greater than 0" }
  ]
}
```

> `errors` array is only included in `422` validation responses.

---

## Assumptions

1. **Monetary amounts** are stored and returned as plain JavaScript numbers (floats). For production-grade financial systems, consider using integer cents or a decimal library to avoid floating-point precision issues.

2. **Authentication / Authorization** is intentionally omitted — the assignment does not specify it, and adding it would complicate the local-run story unnecessarily.

3. **Soft delete / account deactivation** is not implemented. The assignment does not require it.

4. **Multi-document atomicity** requires MongoDB to be running as a replica set (even a single-node one). A standalone `mongod` instance does not support sessions. This is noted in the README.

5. **Transfer `reference_id`** — the transfer API internally stores two transaction documents with references `<reference_id>:debit` (for the source) and `<reference_id>:credit` (for the destination). This keeps reference uniqueness consistent while providing a clear audit trail.

6. **`description` field** — optional in both the transaction and transfer endpoints; defaults to an empty string if not provided.

7. **Pagination defaults** — `page=1`, `limit=10` if not specified.

8. **Maximum page size** is capped at `100` to prevent runaway queries.
