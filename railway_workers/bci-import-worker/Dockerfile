FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

ENV PORT=3250
EXPOSE 3250

CMD ["npm", "start"]

