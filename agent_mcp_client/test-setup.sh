#!/bin/bash

# Test setup script for Ada Analytics Trading Agent
echo "🔍 Testing Ada Analytics Trading Agent setup..."

# Check if Deno is installed
echo "1. Checking Deno installation..."
if command -v deno &> /dev/null; then
    DENO_VERSION=$(deno --version | head -n1)
    echo "   ✅ $DENO_VERSION"
else
    echo "   ❌ Deno not found. Install from: https://deno.land/install.sh"
    exit 1
fi

# Check if .env file exists
echo "2. Checking environment configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file found"
    
    # Check for required variables
    REQUIRED_VARS=("ANTHROPIC_API_KEY" "RESEND_API_KEY" "ALPACA_API_KEY" "ALPACA_SECRET_KEY")
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^$var=" .env || grep -q "^$var=your_.*_here" .env; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        echo "   ✅ All required API keys appear to be configured"
    else
        echo "   ⚠️  Missing or unconfigured API keys: ${MISSING_VARS[*]}"
        echo "      Please update your .env file with actual API keys"
    fi
else
    echo "   ⚠️  .env file not found"
    echo "      Please create .env file with your API keys"
    echo "      See DEPLOYMENT.md for instructions"
fi

# Test dependency caching
echo "3. Testing dependency caching..."
if deno cache main.ts &>/dev/null; then
    echo "   ✅ Dependencies cached successfully"
else
    echo "   ❌ Failed to cache dependencies"
    echo "      Check your internet connection and try again"
    exit 1
fi

# Test basic syntax
echo "4. Testing TypeScript compilation..."
if deno check main.ts &>/dev/null; then
    echo "   ✅ TypeScript compilation successful"
else
    echo "   ⚠️  TypeScript compilation warnings (this is usually OK)"
fi

# Test file permissions
echo "5. Checking file permissions..."
for script in *.sh; do
    if [ -x "$script" ]; then
        echo "   ✅ $script is executable"
    else
        echo "   ⚠️  $script is not executable, fixing..."
        chmod +x "$script"
    fi
done

# Test environment loading
echo "6. Testing environment variable loading..."
if [ -f ".env" ]; then
    # Quick test to see if environment loading would work
    TEST_OUTPUT=$(deno run --allow-all --allow-env --allow-read -e "
    import { load } from 'https://deno.land/std@0.208.0/dotenv/mod.ts';
    try {
        await load({ export: true });
        console.log('ENV_LOAD_SUCCESS');
    } catch (e) {
        console.log('ENV_LOAD_ERROR:', e.message);
    }
    " 2>&1)
    
    if echo "$TEST_OUTPUT" | grep -q "ENV_LOAD_SUCCESS"; then
        echo "   ✅ Environment loading test passed"
    else
        echo "   ⚠️  Environment loading test failed: $TEST_OUTPUT"
    fi
fi

echo ""
echo "🎉 Setup test complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env with your actual API keys"
echo "   2. Run './dev.sh' for development"
echo "   3. Or run './deploy-railway.sh' to deploy to Railway"
echo ""
echo "📚 See DEPLOYMENT.md for detailed deployment instructions"