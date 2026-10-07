FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /source
COPY Directory.Build.props global.json Projects.slnx ./
COPY src/ ./src/
RUN dotnet restore src/Projects.Web/Projects.Web.csproj --locked-mode
RUN dotnet publish src/Projects.Web/Projects.Web.csproj -c Release --no-restore -o /app
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ARG SOURCE_URL
LABEL org.opencontainers.image.source=$SOURCE_URL
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/lib/projects/media /var/lib/projects/keys && chown -R app:app /var/lib/projects
COPY --from=backend /app .
COPY --from=frontend /build/frontend/dist ./wwwroot
USER app
ENV ASPNETCORE_HTTP_PORTS=8080 DOTNET_gcServer=0
EXPOSE 8080
ENTRYPOINT ["dotnet", "Projects.Web.dll"]
