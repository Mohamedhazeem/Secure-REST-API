# Research: API Console

**Feature**: API Console  
**Date**: 2026-08-10

## R1: Interactive OpenAPI Renderer Selection

**Decision**: Use Scalar (https://scalar.com/) as the interactive API documentation renderer.

**Rationale**:
- Modern, polished UI suitable for portfolio screenshots
- Supports OpenAPI 3.0 natively
- Zero-dependency standalone mode (single HTML/JS bundle or CDN)
- Supports custom branding (logo, introduction, theme colors)
- Supports cookie-based authentication configuration
- No build step required; can serve a single static HTML file
- Actively maintained and visually superior to older alternatives like Swagger UI

**Alternatives considered**:
- Swagger UI: Older UI, heavier, less polished for demos
- Redoc: Read-only documentation, no request execution
- Custom implementation: Explicitly excluded by the spec ("Do not create a custom API playground implementation")

## R2: Serving the Multi-File OpenAPI Contract as JSON

**Decision**: Add a lightweight Express route at `/console/openapi.json` that resolves the multi-file YAML contract to a single JSON document at request time (or cache it at startup).

**Rationale**:
- The existing contract is split across multiple YAML files for maintainability
- Scalar requires a single JSON spec URL
- Resolving at request time adds negligible overhead for a dev/demo tool
- Keeps the canonical YAML source untouched; JSON is a derived artifact
- Alternative: Pre-generate JSON during `contract:sync`, but that adds build complexity without benefit for a dev console

**Alternatives considered**:
- Pre-generate JSON at build time: More complex, requires updating sync scripts
- Serve YAML directly: Scalar does not natively consume multi-file YAML
- Embed JSON in HTML: Requires rebuild on contract changes

## R3: Scalar Authentication Configuration

**Decision**: Configure Scalar to use the TrustFeed cookie-based authentication model. The console will send requests with `credentials: 'include'` so the browser automatically includes HTTP-only `access_token` and `refresh_token` cookies.

**Rationale**:
- TrustFeed uses HTTP-only cookies for access and refresh tokens
- Tokens are intentionally not exposed to JavaScript
- Scalar supports cookie-based auth natively via its `authentication` config
- The console should not implement a separate auth flow; it delegates to the real backend endpoints

**Alternatives considered**:
- Bearer token input field: Would require exposing tokens to JS, violating the security model
- OAuth2 flow: Not applicable; TrustFeed uses cookie-based session auth
- Header-based auth: Possible but less natural for cookie-based APIs

## R4: CORS and Console Origin

**Decision**: Add `http://localhost:1430` (and configurable dev origins) to the CORS allowlist, or rely on same-origin serving. The console is served from the same Express origin, so same-origin requests require no CORS headers.

**Rationale**:
- The console HTML is served by Express at `/console`
- API requests from the console to `/api/v1/*` are same-origin
- CORS middleware only adds headers when an `Origin` header is present
- Same-origin requests carry cookies automatically
- For portfolio demos where the console might be accessed from a different port, adding the console origin to `ALLOWED_ORIGINS` is a safe fallback

**Alternatives considered**:
- Proxy all API requests through Express: Unnecessary complexity
- Disable CORS for console origin: Security risk; explicit allowlist is safer

## R5: OpenAPI Contract Enhancements for Console Experience

**Decision**: Enhance the existing OpenAPI contract with realistic examples and clearer descriptions where currently missing, so the console renders useful request/response examples.

**Rationale**:
- The current contract has structural definitions but lacks `example` values in many schemas
- Interactive API consoles derive much of their usability from examples
- Adding examples does not change API behavior; it only improves documentation
- Examples must be consistent with actual backend behavior

**Planned enhancements**:
- Add `example` values to request schemas (`RegisterRequest`, `LoginRequest`, `PostCreateRequest`, etc.)
- Add `example` values to response schemas (`Post`, `Comment`, `Notification`, etc.)
- Add `description` fields to endpoint summaries for better discoverability
- Document `Idempotency-Key` and `If-Match` headers in the contract where applicable
- Ensure all error responses have realistic examples (`401`, `403`, `409`, `429`, `503`)
- Document rate-limit `Retry-After` header behavior

**Alternatives considered**:
- Leave contract as-is: Console would be functional but less informative
- Create separate documentation: Violates "OpenAPI contract must remain the single source of truth"
