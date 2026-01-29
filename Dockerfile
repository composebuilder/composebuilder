FROM caddy:alpine

COPY . /app

COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
