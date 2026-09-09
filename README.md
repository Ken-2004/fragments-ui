# Fragments UI

## Overview

Fragments UI is a browser client for the [Fragments REST API](https://github.com/Ken-2004/fragments). It provides a single workspace for creating, viewing, converting, updating, and deleting small pieces of text, JSON, and image content.

The project uses Parcel and vanilla JavaScript, with Amazon Cognito authentication through `oidc-client-ts`. It is the frontend companion to the backend service; this repository does not provision or deploy AWS infrastructure.

## Features

- Sign in through Cognito and restore an existing browser session.
- List and refresh the authenticated user's fragment collection.
- Create text, JSON, and image fragments.
- Preview original content or request a supported conversion.
- Replace fragment content while preserving its content type.
- Delete fragments with a confirmation prompt.
- Use a responsive workspace with labeled controls, keyboard focus states, live status messages, and constrained image previews.

## Tech Stack

- **Vanilla JavaScript, HTML, and CSS** for the application and interface.
- **Parcel 2** for development and production bundling.
- **oidc-client-ts** for OIDC authentication.
- **Fetch API** for authenticated REST requests.
- **Node.js 24** for the supported build environment.
- **Docker and nginx** for building and serving static production assets.

No frontend framework or CSS framework is required.

## Architecture

```text
Browser UI ---- OIDC sign-in ---- Amazon Cognito
    |
    +---- Authenticated REST ---- Fragments API
                                      |
                                      +---- Operations and conversion
                                      +---- Backend-managed storage
```

`src/auth.js` manages sign-in, callback handling, and authorization headers. `src/api.js` calls the backend. `src/app.js` connects those operations to the DOM. Parcel bundles the application and its stylesheet into static assets served by nginx in the production image.

The UI does not access S3 or DynamoDB directly. The backend owns storage, authorization, and conversion. API requests use an ID token in the Authorization header; credentials are not appended to fragment URLs.

## Authentication

The client uses the OIDC authorization-code flow through `oidc-client-ts`. Configure a Cognito application client suitable for a browser application, without a client secret, and allow the exact sign-in redirect URL used by this UI.

The current authority URL targets Cognito in **us-east-2**. Supply a pool and client from that region. The client requests `phone openid email` scopes, removes the callback authorization code from the URL after successful sign-in, and restores sessions through the OIDC manager.

The existing refresh-token revocation configuration and disabled automatic silent renewal are retained. There is currently no sign-out control in the interface.

## Environment Variables

Copy `.env.example` to an untracked `.env` and supply your own public Cognito configuration:

```dotenv
API_URL=http://localhost:8080
AWS_COGNITO_POOL_ID=
AWS_COGNITO_CLIENT_ID=
OAUTH_SIGN_IN_REDIRECT_URL=http://localhost:1234
```

| Variable                     | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `API_URL`                    | Fragments API base URL; defaults to `http://localhost:8080`. |
| `AWS_COGNITO_POOL_ID`        | Cognito user pool identifier in us-east-2.                   |
| `AWS_COGNITO_CLIENT_ID`      | Public Cognito application client identifier.                |
| `OAUTH_SIGN_IN_REDIRECT_URL` | Allowed sign-in callback URL for this UI.                    |

Parcel embeds these values **at build time**. They are public browser configuration, not a place for secrets. Changing production configuration requires rebuilding the bundle. Local environment files remain gitignored.

## Local Development

Requirements: Node.js 24, npm, a configured Cognito browser client, and a reachable Fragments API using compatible authentication settings.

```sh
npm ci
cp .env.example .env
# Fill in the public Cognito settings in .env.
npm start
```

Open `http://localhost:1234`. Start the backend separately using its [development instructions](https://github.com/Ken-2004/fragments#local-development). Use the backend's Cognito mode when signing in through this UI; Basic Auth is not implemented in this client.

On PowerShell, use `Copy-Item .env.example .env` and use `npm.cmd` if execution policy blocks `npm.ps1`.

## Production Build

```sh
npm ci
npm run build
npm audit
```

Parcel writes production assets to `dist/`. The explicit browser target keeps bundling browser dependencies while `engines.node` documents the build runtime. Build with the intended public configuration and serve that directory using a static web server. The API URL must be reachable by the user's browser, and the backend must allow the UI origin through CORS. Creation results use the API's exposed Location header.

The build can run without real cloud configuration, but functional sign-in requires valid Cognito settings.

## Docker

The multi-stage Dockerfile builds with `node:24-alpine` and copies only the generated assets into `nginx:alpine`. All four Parcel build arguments are preserved.

Export the four configuration variables in your shell before building; Docker does not automatically load this project's `.env` file:

```sh
docker build -t fragments-ui:local \
  --build-arg API_URL="$API_URL" \
  --build-arg AWS_COGNITO_POOL_ID="$AWS_COGNITO_POOL_ID" \
  --build-arg AWS_COGNITO_CLIENT_ID="$AWS_COGNITO_CLIENT_ID" \
  --build-arg OAUTH_SIGN_IN_REDIRECT_URL="$OAUTH_SIGN_IN_REDIRECT_URL" \
  .

docker run --rm -p 1234:80 fragments-ui:local
```

These examples use POSIX shell syntax. With the default local redirect URL, open `http://localhost:1234` and stop the Parcel development server before using the same port. nginx serves the production files on container port 80; runtime container environment variables do not reconfigure the compiled JavaScript.

## Supported Fragment Operations

| Operation      | Backend request                    |
| -------------- | ---------------------------------- |
| List / refresh | `GET /v1/fragments?expand=1`       |
| Create         | `POST /v1/fragments`               |
| View           | `GET /v1/fragments/:id`            |
| Convert        | `GET /v1/fragments/:id.:extension` |
| Edit           | `PUT /v1/fragments/:id`            |
| Delete         | `DELETE /v1/fragments/:id`         |

The creation form offers plain text, Markdown, HTML, CSS, CSV, JSON, PNG, JPEG, WebP, and GIF. JSON is parsed and formatted before creation or editing. Image selection checks the file's reported type against the selected or existing fragment type.

| Stored content type  | Conversion choices in the UI    |
| -------------------- | ------------------------------- |
| Plain text           | `.txt`                          |
| Markdown             | `.md`, `.html`, `.txt`          |
| HTML                 | `.html`, `.txt`                 |
| JSON                 | `.json`, `.txt`                 |
| PNG, JPEG, WebP, GIF | `.png`, `.jpg`, `.webp`, `.gif` |
| CSS, CSV             | Original content only           |

Text and converted HTML are displayed as source text, not executed or inserted as HTML. Image previews use temporary object URLs that are revoked when replaced or closed. Conversion availability is based on the fragment's stored type; the backend remains responsible for accepting requests and enforcing its limits.

## Project Structure

```text
.github/workflows/ci.yml  Node 24 dependency, build, and audit checks
src/auth.js              Cognito/OIDC session and authorization headers
src/api.js               Fragments REST API client
src/app.js               DOM rendering and fragment interactions
src/styles.css           Responsive application styles
index.html               Accessible workspace and forms
.env.example             Placeholder public configuration
Dockerfile               Parcel build and nginx production stages
package.json             Package metadata and npm commands
package-lock.json        Locked dependency versions
```

## Security Notes

- Authentication objects, tokens, API payloads, and fragment content are not logged to the console.
- Sign-in errors display a generic recovery message rather than raw OIDC exceptions.
- ID/access tokens remain managed in the browser session; this is a browser client, not a secret-holding server.
- Use HTTPS for deployed UI, API, and authentication traffic.
- Never put AWS access keys, client secrets, or other credentials into Parcel environment variables or Docker build arguments.
- The UI displays server-provided text through textContent and asks for confirmation before deletion.
- Backend authorization must enforce ownership independently of the UI.
- The CI workflow runs `npm ci`, `npm run build`, and `npm audit` on pushes and pull requests to main. It does not publish or deploy.
- This repository does not establish a live deployment, provision cloud resources, or include a live Cognito integration test.

## Related Backend

[Ken-2004/fragments](https://github.com/Ken-2004/fragments) provides the REST API, fragment conversion, authentication enforcement, and storage adapters.

## Author

Harsh Prajapati. The package remains private and marked `UNLICENSED`.
