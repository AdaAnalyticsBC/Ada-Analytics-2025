# 🤖 Ada Analytics Trading Agent - Railway Deployment
FROM denoland/deno:alpine-1.42.0

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Cache dependencies
RUN deno cache main_new.ts

# Switch to deno user (already exists in the image)
USER deno

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno eval --allow-net 'try { const r = await fetch(`http://localhost:${Deno.env.get("PORT") || "8080"}/api/health`); if (!r.ok) Deno.exit(1); } catch { Deno.exit(1); }'

# Expose port
EXPOSE 8080

# Start the application
CMD ["deno", "run", "--allow-all", "--no-check", "main_new.ts"]