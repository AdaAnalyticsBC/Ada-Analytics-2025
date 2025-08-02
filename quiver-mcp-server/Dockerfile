FROM denoland/deno:1.40.0

WORKDIR /app

# Copy deno configuration
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno cache main.ts

# Copy application code
COPY . .

# Expose port for HTTP transport
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno run --allow-net main.ts --health-check || exit 1

# Start the MCP server with HTTP transport
CMD ["deno", "run", "--allow-all", "main.ts", "--transport", "http", "--host", "0.0.0.0", "--port", "8000"] 