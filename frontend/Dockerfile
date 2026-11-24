# Build the Angular app, then serve the static files with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The API address is baked in at build time (see scripts/generate-environment.mjs).
ARG API_URL=http://localhost:8000
ENV API_URL=$API_URL
RUN npm run build:render

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/shopkeeper-frontend/browser /usr/share/nginx/html
EXPOSE 80
