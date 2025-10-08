FROM node:20-slim

# Install dependencies for canvas and pdf.js
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

CMD ["npm", "start"]
