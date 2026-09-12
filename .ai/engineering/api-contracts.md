# API / INTERFACE CONTRACTS

Status: draft
Owner: Principal Architect
Updated: <date> by <agent> - <reason>

> The contract is the source of truth. If the code diverges, either the code is a bug or
> this doc is stale - resolve it, do not tolerate it. Record breaking changes as ADRs.

## Conventions
- Base URL / namespace: <>
- Versioning: <>
- Auth: <>
- Error envelope: <shape>
- Pagination: <>
- Idempotency: <>

## Endpoints

### `<METHOD> /path`
- **Purpose:** <>
- **Auth:** <role / scope>
- **Request:**
```json
{}
```
- **Response 2xx:**
```json
{}
```
- **Errors:** `400 <when>` · `403 <when>` · `404 <when>` · `409 <when>` · `422 <when>`
- **Idempotent:** yes/no
- **Rate limit:** <>
- **Implemented in:** `path:line`
- **Tests:** `path`

## Events / messages

| Event | Producer | Consumers | Payload | Delivery guarantee |
|---|---|---|---|---|

## Breaking change log

| Date | Change | Migration path | ADR |
|---|---|---|---|
