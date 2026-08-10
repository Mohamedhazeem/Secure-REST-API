# Data Model: API Console

**Feature**: API Console  
**Date**: 2026-08-10

## Overview

The API Console is a presentation-layer feature with no persistent data model. It consists of static assets served by Express and runtime state held in the browser. All business data remains in the existing MongoDB + Redis stores.

## Entities

### Console Asset (static file)

| Attribute | Type | Description |
|-----------|------|-------------|
| `path` | string | `/console` (HTML page), `/console/openapi.json` (resolved contract) |
| `content` | HTML/JSON | Static HTML page loading Scalar; JSON derived from OpenAPI YAML |
| `served_by` | Express static/route | Handled by existing Express app, no new server |

**Lifecycle**: Immutable until redeployed. No CRUD operations.

### Browser Console State (ephemeral)

| Attribute | Type | Description |
|-----------|------|-------------|
| `cookies` | HTTP-only cookies | `access_token` and `refresh_token` issued by TrustFeed backend; stored by browser, inaccessible to JS |
| `selected_endpoint` | string | Currently expanded endpoint in the console UI |
| `request_history` | array | Previous requests/responses shown in the console session |

**Lifecycle**: Lives only in the reviewer's browser session. No persistence, no server-side state.

### OpenAPI Contract (derived)

| Attribute | Type | Description |
|-----------|------|-------------|
| `source` | multi-file YAML | `specs/002-trustfeed-social-api/contracts/` |
| `derived` | JSON | `/console/openapi.json` served at runtime |
| `sync` | npm script | `npm run contract:sync` keeps published copy in sync |

**Lifecycle**: Derived from canonical contract; regenerated when contract changes.

## Relationships

- Console HTML → reads OpenAPI JSON → renders interactive explorer
- Console → makes API requests → TrustFeed backend (same origin)
- TrustFeed backend → returns responses → console displays them

## Validation Rules

- Console HTML must not contain secrets, credentials, or hardcoded tokens
- Console must not duplicate or override OpenAPI definitions
- Console must not store or log sensitive request/response data beyond what is visible in the UI
