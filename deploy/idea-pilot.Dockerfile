FROM node:22-alpine AS builder

WORKDIR /app

COPY APortfolioOfWorks/想法明确工具/package.json APortfolioOfWorks/想法明确工具/package-lock.json ./
RUN npm ci

COPY APortfolioOfWorks/想法明确工具/ ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/dist/standalone ./

EXPOSE 3000

CMD ["node", "server.js"]
