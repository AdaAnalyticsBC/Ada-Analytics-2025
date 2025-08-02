FROM denoland/deno:1.42.0

WORKDIR /app

# Copy application code first
COPY . .

# Cache dependencies (without lockfile)
RUN deno cache --reload main.ts

# Expose port for HTTP transport
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno run --allow-net main.ts --health-check || exit 1

# Start the MCP server
CMD ["deno", "run", "--allow-all", "main.ts"] 