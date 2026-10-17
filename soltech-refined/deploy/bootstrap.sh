#!/bin/bash
set -eu
# This bootstrap contains no credentials or application data.
dnf install -y nodejs24 nginx tar
id solventir >/dev/null 2>&1 || useradd --system --home-dir /var/lib/solventir --create-home --shell /sbin/nologin solventir
install -d -m 0755 /opt/solventir
install -d -m 0750 -o solventir -g solventir /var/lib/solventir/scanner
install -d -m 0750 -o root -g solventir /etc/solventir
cat > /etc/nginx/conf.d/solventir.conf <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 16k;
  server_tokens off;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 70s;
  }
}
NGINX
# Use only the explicit API proxy above; remove the distribution's default web page.
cat > /etc/nginx/nginx.conf <<'NGINX'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  sendfile on;
  keepalive_timeout 65;
  include /etc/nginx/conf.d/*.conf;
}
NGINX
nginx -t
systemctl enable --now nginx
