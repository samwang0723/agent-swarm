#!/bin/bash

# OAuth Flow Demo Script
# This script demonstrates the complete OAuth flow for upstream applications

BASE_URL="http://localhost:8900/api/v1"
UPSTREAM_PORT="4000"
UPSTREAM_HOST="http://localhost:$UPSTREAM_PORT"

echo "🚀 OAuth Flow Demo for Upstream Applications"
echo "============================================"
echo "Agent Swarm API: $BASE_URL"
echo "Upstream App: $UPSTREAM_HOST"
echo ""

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

# Function to start a simple HTTP server for testing
start_test_server() {
    local port=$1
    echo "🌐 Starting test server on port $port..."
    
    # Create a simple HTML file for the callback
    cat > /tmp/oauth-demo.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>OAuth Demo - Callback Handler</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
        .code { background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; word-break: break-all; }
        .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px 10px 0; }
    </style>
</head>
<body>
    <h1>OAuth Demo - Callback Handler</h1>
    
    <div id="status">
        <p>Processing OAuth callback...</p>
    </div>
    
    <div id="results" style="display: none;">
        <h2>OAuth Flow Results</h2>
        <div id="auth-info"></div>
        <div id="token-info"></div>
        <div id="user-info"></div>
        <div id="validation-info"></div>
    </div>
    
    <div id="instructions">
        <h2>Testing Instructions</h2>
        <ol>
            <li>The authorization code should be extracted from the URL automatically</li>
            <li>The script will exchange it for an access token</li>
            <li>The access token will be validated</li>
            <li>You can then use the token for authenticated API calls</li>
        </ol>
    </div>

    <script>
        const API_BASE = 'http://localhost:8900/api/v1';
        
        // Extract parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        const statusDiv = document.getElementById('status');
        const resultsDiv = document.getElementById('results');
        const authInfo = document.getElementById('auth-info');
        const tokenInfo = document.getElementById('token-info');
        const userInfo = document.getElementById('user-info');
        const validationInfo = document.getElementById('validation-info');
        
        if (error) {
            statusDiv.innerHTML = `<div class="error"><h3>OAuth Error</h3><p>Error: ${error}</p></div>`;
        } else if (code) {
            statusDiv.innerHTML = '<div class="success"><h3>Authorization Code Received</h3></div>';
            authInfo.innerHTML = `
                <h3>Authorization Details</h3>
                <div class="code">
                    <strong>Code:</strong> ${code}<br>
                    <strong>State:</strong> ${state || 'Not provided'}
                </div>
            `;
            
            // Exchange code for token
            exchangeCodeForToken(code);
        } else {
            statusDiv.innerHTML = '<div class="error"><h3>No Authorization Code</h3><p>No authorization code found in URL parameters.</p></div>';
        }
        
        async function exchangeCodeForToken(authCode) {
            try {
                statusDiv.innerHTML += '<p>Exchanging authorization code for access token...</p>';
                
                const response = await fetch(`${API_BASE}/auth/oauth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        grant_type: 'authorization_code',
                        code: authCode
                    })
                });
                
                const tokenData = await response.json();
                
                if (response.ok) {
                    statusDiv.innerHTML += '<div class="success">Token exchange successful!</div>';
                    
                    tokenInfo.innerHTML = `
                        <h3>Token Information</h3>
                        <div class="code">
                            <strong>Access Token:</strong> ${tokenData.access_token.substring(0, 20)}...<br>
                            <strong>Token Type:</strong> ${tokenData.token_type}<br>
                            <strong>Expires In:</strong> ${tokenData.expires_in} seconds<br>
                            <strong>User ID:</strong> ${tokenData.user_id}
                        </div>
                    `;
                    
                    userInfo.innerHTML = `
                        <h3>User Information</h3>
                        <div class="code">
                            <strong>Email:</strong> ${tokenData.user_info.email}<br>
                            <strong>Name:</strong> ${tokenData.user_info.name || 'Not provided'}<br>
                            <strong>Picture:</strong> ${tokenData.user_info.picture ? 'Available' : 'Not provided'}
                        </div>
                    `;
                    
                    // Validate the token
                    validateToken(tokenData.access_token);
                    
                    resultsDiv.style.display = 'block';
                } else {
                    statusDiv.innerHTML += `<div class="error">Token exchange failed: ${tokenData.message || JSON.stringify(tokenData)}</div>`;
                }
            } catch (error) {
                statusDiv.innerHTML += `<div class="error">Error during token exchange: ${error.message}</div>`;
            }
        }
        
        async function validateToken(accessToken) {
            try {
                statusDiv.innerHTML += '<p>Validating access token...</p>';
                
                const response = await fetch(`${API_BASE}/auth/oauth/validate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: accessToken
                    })
                });
                
                const validation = await response.json();
                
                if (validation.valid) {
                    statusDiv.innerHTML += '<div class="success">Token validation successful!</div>';
                    
                    validationInfo.innerHTML = `
                        <h3>Token Validation Results</h3>
                        <div class="code">
                            <strong>Valid:</strong> ${validation.valid}<br>
                            <strong>User ID:</strong> ${validation.user_id}<br>
                            <strong>Expires At:</strong> ${validation.expires_at || 'Not specified'}
                        </div>
                        <p><strong>OAuth Flow Complete!</strong> You can now use this access token for authenticated API calls:</p>
                        <div class="code">
                            curl -H "Authorization: Bearer ${accessToken}" ${API_BASE}/auth/me
                        </div>
                    `;
                } else {
                    statusDiv.innerHTML += `<div class="error">Token validation failed: ${validation.reason || 'Unknown reason'}</div>`;
                }
            } catch (error) {
                statusDiv.innerHTML += `<div class="error">Error during token validation: ${error.message}</div>`;
            }
        }
    </script>
</body>
</html>
EOF

    # Start a simple Python HTTP server
    cd /tmp
    python3 -m http.server $port --bind 127.0.0.1 >/dev/null 2>&1 &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 2
    
    echo "✅ Test server started (PID: $SERVER_PID)"
    echo "📋 Callback URL: $UPSTREAM_HOST/oauth-demo.html"
    
    return $SERVER_PID
}

# Function to stop the test server
stop_test_server() {
    local pid=$1
    if [ -n "$pid" ]; then
        echo "🛑 Stopping test server (PID: $pid)..."
        kill $pid 2>/dev/null
        rm -f /tmp/oauth-demo.html
    fi
}

# Function to initiate OAuth flow
initiate_oauth() {
    local redirect_uri="$UPSTREAM_HOST/oauth-demo.html"
    local state="demo-$(date +%s)-$(( RANDOM % 1000 ))"
    
    echo "🔄 Initiating OAuth flow..."
    echo "Redirect URI: $redirect_uri"
    echo "State: $state"
    echo "Agent Swarm API: $BASE_URL"
    
    # Call the OAuth initiate endpoint
    echo "📡 Calling: POST $BASE_URL/auth/oauth/initiate"
    response=$(curl -s -X POST "$BASE_URL/auth/oauth/initiate" \
        -H "Content-Type: application/json" \
        -d "{
            \"redirect_uri\": \"$redirect_uri\",
            \"state\": \"$state\",
            \"scopes\": [
                \"https://www.googleapis.com/auth/userinfo.email\",
                \"https://www.googleapis.com/auth/userinfo.profile\",
                \"https://www.googleapis.com/auth/gmail.readonly\"
            ]
        }")
    
    echo "📋 Raw response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    
    # Check if request was successful
    auth_url=$(echo "$response" | jq -r '.auth_url // empty')
    
    if [ -n "$auth_url" ] && [ "$auth_url" != "null" ]; then
        echo "✅ OAuth initiation successful!"
        echo ""
        echo "🔗 Authorization URL:"
        echo "$auth_url"
        echo ""
        echo "🎯 Expected Flow:"
        echo "1. Browser opens Google OAuth consent screen"
        echo "2. User completes Google OAuth consent"
        echo "3. Google redirects to: $BASE_URL/api/v1/auth/google/callback (existing callback)"
        echo "4. Agent Swarm detects upstream OAuth flow (state starts with 'oauth_state_')"
        echo "5. Agent Swarm processes OAuth and redirects to: $redirect_uri with auth code"
        echo "6. Your upstream app receives the authorization code"
        echo ""
        echo "📋 Next steps:"
        echo "1. Open the authorization URL above in your browser"
        echo "2. Complete the Google OAuth consent process"
        echo "3. You'll be redirected to the test server callback page"
        echo "4. The callback page will automatically complete the token exchange"
        echo ""
        echo "🌐 Opening authorization URL in your default browser..."
        
        # Try to open the URL in the default browser
        if command -v open >/dev/null 2>&1; then
            # macOS
            open "$auth_url"
        elif command -v xdg-open >/dev/null 2>&1; then
            # Linux
            xdg-open "$auth_url"
        elif command -v start >/dev/null 2>&1; then
            # Windows
            start "$auth_url"
        else
            echo "⚠️  Could not automatically open browser. Please copy and paste the URL above."
        fi
        
        return 0
    else
        echo "❌ OAuth initiation failed!"
        echo "🔍 Debugging info:"
        echo "  - Check if Agent Swarm server is running"
        echo "  - Check if OAuth API endpoints are properly implemented"
        echo "  - Verify Google OAuth credentials are configured"
        echo "Full response: $response"
        return 1
    fi
}

# Main execution
main() {
    # Check if Agent Swarm server is running
    echo "🔍 Checking if Agent Swarm server is running..."
    if ! curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        echo "❌ Agent Swarm server is not running at $BASE_URL"
        echo "   Please start your server first with: npm run dev"
        exit 1
    fi
    echo "✅ Agent Swarm server is running"
    echo ""
    
    # Check environment variables
    echo "🔧 Checking environment configuration..."
    echo "Agent Swarm API: $BASE_URL"
    echo "Upstream Test Server: $UPSTREAM_HOST"
    echo ""
    echo "📝 Make sure your Agent Swarm server has these environment variables:"
    echo "   GOOGLE_CLIENT_ID=your_google_client_id"
    echo "   GOOGLE_CLIENT_SECRET=your_google_client_secret"
    echo "   GOOGLE_REDIRECT_URI=$BASE_URL/auth/google/callback"
    echo ""
    
    # Check if upstream port is available
    if ! check_port $UPSTREAM_PORT; then
        echo "❌ Port $UPSTREAM_PORT is already in use"
        echo "   Please stop any service using port $UPSTREAM_PORT or change UPSTREAM_PORT variable"
        exit 1
    fi
    
    # Start the test server
    start_test_server $UPSTREAM_PORT
    test_server_pid=$!
    
    # Set up cleanup trap
    trap "stop_test_server $test_server_pid" EXIT INT TERM
    
    echo ""
    echo "🚀 Starting OAuth flow demo..."
    echo ""
    
    # Initiate OAuth flow
    if initiate_oauth; then
        echo ""
        echo "⏳ Waiting for OAuth flow completion..."
        echo "   The test server is running and waiting for the OAuth callback"
        echo "   Press Ctrl+C to stop the demo when you're done testing"
        echo ""
        
        # Keep the script running so the server stays up
        while true; do
            sleep 5
            if ! kill -0 $test_server_pid 2>/dev/null; then
                echo "❌ Test server stopped unexpectedly"
                break
            fi
        done
    else
        echo "❌ Failed to initiate OAuth flow"
        exit 1
    fi
}

# Help text
show_help() {
    echo "OAuth Flow Demo Script"
    echo "====================="
    echo ""
    echo "This script demonstrates the complete OAuth flow for upstream applications."
    echo "It starts a local test server and walks through the entire OAuth process."
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -p, --port     Set upstream server port (default: 4000)"
    echo "  -u, --url      Set Agent Swarm API base URL (default: $BASE_URL)"
    echo ""
    echo "Environment Variables:"
    echo "  UPSTREAM_PORT  Upstream server port (default: 4000)"
    echo "  BASE_URL       Agent Swarm API base URL"
    echo ""
    echo "Prerequisites:"
    echo "  - Agent Swarm server running"
    echo "  - Python 3 installed (for test server)"
    echo "  - curl and jq installed"
    echo "  - Google OAuth credentials configured"
    echo ""
    echo "Example:"
    echo "  $0                           # Use default settings"
    echo "  $0 -p 5000                   # Use port 5000 for upstream server"
    echo "  $0 -u http://api.example.com/v1  # Use different API base URL"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -p|--port)
            UPSTREAM_PORT="$2"
            UPSTREAM_HOST="http://localhost:$UPSTREAM_PORT"
            shift 2
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check dependencies
check_dependencies() {
    local missing_deps=""
    
    if ! command -v curl >/dev/null 2>&1; then
        missing_deps="$missing_deps curl"
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing_deps="$missing_deps jq"
    fi
    
    if ! command -v python3 >/dev/null 2>&1; then
        missing_deps="$missing_deps python3"
    fi
    
    if [ -n "$missing_deps" ]; then
        echo "❌ Missing required dependencies:$missing_deps"
        echo "   Please install them and try again"
        exit 1
    fi
}

# Run dependency check and main function
check_dependencies
main 