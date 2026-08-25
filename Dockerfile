FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_ADMIN_URL=https://fmlab.vip/login
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_ADMIN_URL=${VITE_ADMIN_URL}

RUN npm run build

FROM node:20-alpine AS portfolio-builder

WORKDIR /portfolio

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

COPY APortfolioOfWorks/app-cqgrtt79uyo1/package.json APortfolioOfWorks/app-cqgrtt79uyo1/pnpm-lock.yaml ./
RUN pnpm --ignore-workspace install --frozen-lockfile

COPY APortfolioOfWorks/app-cqgrtt79uyo1/ ./
RUN pnpm --ignore-workspace exec vite build --base=./ --outDir /portfolio-dist/planet-party

FROM nginx:1.27-alpine

ENV BACKEND_URL=http://host.docker.internal:8080
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=portfolio-builder /portfolio-dist/planet-party /usr/share/nginx/html/works/planet-party
COPY APortfolioOfWorks/echart/index.html APortfolioOfWorks/echart/中华人民共和国.geojson /usr/share/nginx/html/works/scenic-map/
COPY APortfolioOfWorks/echart/css /usr/share/nginx/html/works/scenic-map/css
COPY APortfolioOfWorks/echart/db /usr/share/nginx/html/works/scenic-map/db
COPY APortfolioOfWorks/echart/font /usr/share/nginx/html/works/scenic-map/font
COPY APortfolioOfWorks/echart/images /usr/share/nginx/html/works/scenic-map/images
COPY APortfolioOfWorks/echart/js /usr/share/nginx/html/works/scenic-map/js
COPY "APortfolioOfWorks/云游东方明珠-漫游版/云游·东方明珠.html" /usr/share/nginx/html/works/oriental-pearl/index.html
COPY --from=builder /app/node_modules/three/build/three.module.js /usr/share/nginx/html/works/oriental-pearl/vendor/three.module.js
COPY --from=builder /app/node_modules/three/examples/jsm /usr/share/nginx/html/works/oriental-pearl/vendor/addons
RUN sed -i \
    -e 's#https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js#./vendor/three.module.js#' \
    -e 's#https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/#./vendor/addons/#' \
    /usr/share/nginx/html/works/oriental-pearl/index.html

EXPOSE 80
