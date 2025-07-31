# Use the official Deno image
FROM denoland/deno:1.40.2

# Set the working directory
WORKDIR /app

# Copy the application files
COPY . .

# Cache dependencies
RUN deno cache main.ts

# Create a non-root user
RUN useradd --create-home --shell /bin/bash deno_user
RUN chown -R deno_user:deno_user /app
USER deno_user

# Expose the port that the app runs on
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["deno", "run", "--allow-all", "main.ts"]