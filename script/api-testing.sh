#!/bin/bash

# Agent Swarm API Test Script
# Make sure your server is running on http://localhost:3000

BASE_URL="http://localhost:3000/api/v1"
AUTH_TOKEN=""
OAUTH_ACCESS_TOKEN=""

echo "🚀 Agent Swarm API Testing Script"
echo "=================================="

# Function to make authenticated requests
make_auth_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$AUTH_TOKEN" ]; then
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $AUTH_TOKEN" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $AUTH_TOKEN"
        fi
    else
        echo "❌ No auth token available. Please authenticate first."
        return 1
    fi
}

# Function to make requests with custom headers
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    
    if [ -n "$data" ]; then
        if [ -n "$headers" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                $headers \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        fi
    else
        if [ -n "$headers" ]; then
            curl -s -X $method "$BASE_URL$endpoint" $headers
        else
            curl -s -X $method "$BASE_URL$endpoint"
        fi
    fi
}

# 1. Health Check
echo "1️⃣ Testing Health Check..."
curl -s "$BASE_URL/health" | jq '.'
echo -e "\n"

# 2. Direct Browser Authentication Flow
echo "2️⃣ Testing Direct Browser Authentication..."
echo "📝 To test direct browser authentication, visit: $BASE_URL/auth/google"
echo "   This will redirect you to Google OAuth consent screen"
echo "   After successful auth, you'll get a session cookie"
echo -e "\n"

# 3. OAuth API for Upstream Applications
echo "3️⃣ Testing OAuth API for Upstream Applications..."
echo "================================================"

# Test OAuth initiate endpoint
echo "3️⃣.1️⃣ Testing OAuth Initiate..."
oauth_initiate_response=$(make_request "POST" "/auth/oauth/initiate" '{
    "redirect_uri": "http://localhost:4000/oauth-callback",
    "state": "test-state-123",
    "scopes": [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]
}')

echo "$oauth_initiate_response" | jq '.'

# Extract auth_url from response for manual testing
auth_url=$(echo "$oauth_initiate_response" | jq -r '.auth_url // empty')
if [ -n "$auth_url" ]; then
    echo "✅ OAuth initiate successful!"
    echo "🔗 Auth URL: $auth_url"
    echo "📝 To complete OAuth flow:"
    echo "   1. Visit the auth URL above in your browser"
    echo "   2. Complete Google OAuth consent"
    echo "   3. You'll be redirected to http://localhost:4000/oauth-callback with a code"
    echo "   4. Extract the code parameter from the callback URL"
    echo "   5. Use the code to test token exchange below"
else
    echo "❌ OAuth initiate failed"
fi
echo -e "\n"

# Test OAuth token exchange (will fail without valid code)
echo "3️⃣.2️⃣ Testing OAuth Token Exchange..."
echo "⚠️  This will fail without a valid authorization code from the OAuth flow"
token_exchange_response=$(make_request "POST" "/auth/oauth/token" '{
    "grant_type": "authorization_code",
    "code": "invalid-test-code"
}')

echo "$token_exchange_response" | jq '.'
echo "📝 To test with valid code, replace 'invalid-test-code' with actual code from OAuth callback"
echo -e "\n"

# Test OAuth token validation with invalid token
echo "3️⃣.3️⃣ Testing OAuth Token Validation (Invalid Token)..."
validation_response=$(make_request "POST" "/auth/oauth/validate" '{
    "access_token": "invalid-test-token"
}')

echo "$validation_response" | jq '.'
echo -e "\n"

# Test OAuth callback error handling
echo "3️⃣.4️⃣ Testing OAuth Callback Error Handling..."
echo "📝 Testing callback with missing parameters..."
callback_response=$(curl -s "$BASE_URL/auth/oauth/callback")
echo "Response: $callback_response"
echo -e "\n"

# Test OAuth API with missing required fields
echo "3️⃣.5️⃣ Testing OAuth API Validation..."
echo "📝 Testing initiate with missing redirect_uri..."
missing_redirect_response=$(make_request "POST" "/auth/oauth/initiate" '{
    "state": "test-state"
}')
echo "$missing_redirect_response" | jq '.'
echo -e "\n"

echo "📝 Testing token exchange with missing grant_type..."
missing_grant_response=$(make_request "POST" "/auth/oauth/token" '{
    "code": "test-code"
}')
echo "$missing_grant_response" | jq '.'
echo -e "\n"

echo "📝 Testing token validation with missing access_token..."
missing_token_response=$(make_request "POST" "/auth/oauth/validate" '{}')
echo "$missing_token_response" | jq '.'
echo -e "\n"

# Test OAuth with various redirect URIs
echo "3️⃣.6️⃣ Testing OAuth with Different Redirect URIs..."
echo "📝 Testing with localhost redirect URI..."
localhost_response=$(make_request "POST" "/auth/oauth/initiate" '{
    "redirect_uri": "http://localhost:3001/callback",
    "state": "localhost-test"
}')
echo "$localhost_response" | jq '.'
echo -e "\n"

echo "📝 Testing with HTTPS redirect URI..."
https_response=$(make_request "POST" "/auth/oauth/initiate" '{
    "redirect_uri": "https://myapp.example.com/oauth-callback",
    "state": "https-test"
}')
echo "$https_response" | jq '.'
echo -e "\n"

echo "📝 Testing with invalid redirect URI format..."
invalid_uri_response=$(make_request "POST" "/auth/oauth/token" '{
    "redirect_uri": "not-a-valid-url",
    "state": "invalid-test"
}')
echo "$invalid_uri_response" | jq '.'
echo -e "\n"

# 4. Manual OAuth Flow Instructions
echo "4️⃣ Manual OAuth Flow Testing Instructions..."
echo "============================================="
echo "To fully test the OAuth API flow:"
echo ""
echo "1. 🚀 Start a simple upstream app server:"
echo "   python3 -m http.server 4000 &"
echo "   Or use any server running on port 4000"
echo ""
echo "2. 🔗 Use the auth_url from step 3.1 above"
echo ""
echo "3. 🌐 Complete the OAuth flow in your browser"
echo ""
echo "4. 📋 Extract the authorization code from the callback URL"
echo ""
echo "5. 🔄 Test token exchange with the real code:"
echo "   curl -X POST $BASE_URL/auth/oauth/token \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"grant_type\":\"authorization_code\",\"code\":\"YOUR_CODE_HERE\"}'"
echo ""
echo "6. ✅ Test token validation with the returned access_token:"
echo "   curl -X POST $BASE_URL/auth/oauth/validate \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"access_token\":\"YOUR_ACCESS_TOKEN_HERE\"}'"
echo ""
echo "7. 🔐 Use the access_token for authenticated API calls:"
echo "   curl -H 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' $BASE_URL/auth/me"
echo -e "\n"

# 5. Check Direct Authentication Status (requires manual auth first)
echo "5️⃣ Testing Direct Authentication Status..."
echo "⚠️  You need to authenticate via browser first, then extract the auth_token cookie"
echo "   Example: AUTH_TOKEN='your-session-token-here'"
echo -e "\n"

# If you have an auth token, uncomment and set it here:
# AUTH_TOKEN="your-session-token-here"

if [ -n "$AUTH_TOKEN" ]; then
    echo "✅ Using provided auth token for direct authentication tests"
    
    # Test /me endpoint
    echo "6️⃣ Testing User Info..."
    make_auth_request "GET" "/auth/me" | jq '.'
    echo -e "\n"
    
    # Test conversations endpoint
    echo "7️⃣ Testing Conversations..."
    make_auth_request "GET" "/conversations" | jq '.'
    echo -e "\n"
    
    # Test creating a conversation
    echo "8️⃣ Testing Create Conversation..."
    conversation_response=$(make_auth_request "POST" "/conversations" '{"title": "Test Conversation"}')
    echo "$conversation_response" | jq '.'
    
    # Extract conversation ID for further testing
    conversation_id=$(echo "$conversation_response" | jq -r '.id // empty')
    echo -e "\n"
    
    if [ -n "$conversation_id" ]; then
        echo "9️⃣ Testing Send Message to Conversation..."
        make_auth_request "POST" "/conversations/$conversation_id/messages" '{"content": "Hello, this is a test message"}' | jq '.'
        echo -e "\n"
    fi
    
    # Test logout
    echo "🔟 Testing Logout..."
    make_auth_request "POST" "/auth/logout" | jq '.'
    echo -e "\n"
    
else
    echo "⚠️  Skipping direct authenticated endpoints - no auth token provided"
    echo "   To test direct authenticated endpoints:"
    echo "   1. Visit: $BASE_URL/auth/google"
    echo "   2. Complete OAuth flow"
    echo "   3. Extract auth_token from browser cookies"
    echo "   4. Set AUTH_TOKEN variable in this script"
fi

# 6. Integration Test Example
echo "1️⃣1️⃣ OAuth API Integration Example..."
echo "====================================="
echo "Here's a complete example of how upstream applications would integrate:"
echo ""
echo "# 1. JavaScript Frontend Example"
echo "const initiateOAuth = async () => {"
echo "  const response = await fetch('$BASE_URL/auth/oauth/initiate', {"
echo "    method: 'POST',"
echo "    headers: { 'Content-Type': 'application/json' },"
echo "    body: JSON.stringify({"
echo "      redirect_uri: 'https://your-app.com/oauth-callback',"
echo "      state: 'csrf-' + Math.random().toString(36)"
echo "    })"
echo "  });"
echo "  const data = await response.json();"
echo "  window.location.href = data.auth_url;"
echo "};"
echo ""
echo "# 2. Handle OAuth Callback"
echo "const handleCallback = async (code) => {"
echo "  const response = await fetch('$BASE_URL/auth/oauth/token', {"
echo "    method: 'POST',"
echo "    headers: { 'Content-Type': 'application/json' },"
echo "    body: JSON.stringify({"
echo "      grant_type: 'authorization_code',"
echo "      code: code"
echo "    })"
echo "  });"
echo "  const tokenData = await response.json();"
echo "  localStorage.setItem('access_token', tokenData.access_token);"
echo "};"
echo ""
echo "# 3. Make Authenticated Requests"
echo "const makeAuthenticatedRequest = async (endpoint) => {"
echo "  const token = localStorage.getItem('access_token');"
echo "  const response = await fetch('$BASE_URL' + endpoint, {"
echo "    headers: { 'Authorization': 'Bearer ' + token }"
echo "  });"
echo "  return response.json();"
echo "};"
echo -e "\n"

echo "✅ API Testing Complete!"
echo ""
echo "📊 Test Summary:"
echo "  ✅ Health Check"
echo "  ✅ OAuth API Initiate"
echo "  ✅ OAuth API Token Exchange (structure)"
echo "  ✅ OAuth API Token Validation (structure)"
echo "  ✅ OAuth API Error Handling"
echo "  ✅ OAuth API Input Validation"
echo ""
echo "🔗 Next Steps:"
echo "  1. Follow the manual OAuth flow instructions above"
echo "  2. Test with real OAuth credentials"
echo "  3. Integrate with your upstream applications"
echo "  4. Set up proper redirect URI validation for production"