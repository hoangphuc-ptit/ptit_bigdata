# Web app một container: React build tĩnh được Spring Boot phục vụ cùng /api.
# Build từ thư mục webapp: docker compose build webapp
FROM node:24-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

FROM maven:3.9.11-eclipse-temurin-21 AS backend
WORKDIR /src
COPY backend/pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY backend/src ./src
COPY --from=frontend /src/dist ./src/main/resources/static
# Test parity với artifact thật chạy ngoài image (cần thư mục serving); ở đây chạy unit test.
RUN mvn -B package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /src/target/revenue-webapp.jar app.jar
ENV SERVING_DIR=/serving
EXPOSE 8080
ENTRYPOINT ["java", "-Xmx512m", "-jar", "app.jar"]
