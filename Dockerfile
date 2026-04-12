# STAGE 1: Build C++ Engines
FROM ubuntu:22.04 AS builder-cpp
RUN apt-get update && apt-get install -y \
    g++ cmake libpq-dev libpqxx-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY engines ./engines
WORKDIR /app/engines
RUN mkdir -p build && cd build && cmake .. && make

# STAGE 2: Build Node.js App (Installs devDependencies for tsc)
FROM node:20-slim AS builder-node
WORKDIR /app/backend
COPY backend/package*.json ./
# Install ALL dependencies (including typescript)
RUN npm install 
COPY backend/src ./src
COPY backend/tsconfig.json ./
# Now tsc will be found
RUN npm run build 

# STAGE 3: Final Production Runner
FROM node:20-slim
RUN apt-get update && apt-get install -y \
    libpq5 libpqxx-6.4 libssl3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy C++ binaries from Stage 1
COPY --from=builder-cpp /app/engines/build /app/engines/build
# Copy compiled JS and production modules from Stage 2
COPY --from=builder-node /app/backend/dist ./backend/dist
COPY backend/package*.json ./backend/
WORKDIR /app/backend
# Final production-only install
RUN npm install --production

EXPOSE 3001
CMD ["npm", "start"]