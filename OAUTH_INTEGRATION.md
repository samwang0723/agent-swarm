## Architecture

The OAuth flow works as follows:

1. **Upstream App** calls your API to initiate OAuth
2. **Agent Swarm API** generates Google OAuth URL (redirects to existing `/auth/google/callback`)
3. **User** authenticates with Google
4. **Google** redirects back to Agent Swarm's existing callback endpoint
5. **Agent Swarm** detects upstream OAuth flow and redirects to upstream app with auth code
6. **Upstream App** exchanges auth code for access token
7. **Upstream App** uses access token for subsequent API calls
