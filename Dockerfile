FROM caddy:alpine

COPY . /app

COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

RUN caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
