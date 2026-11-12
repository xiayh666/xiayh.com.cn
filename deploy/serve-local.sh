#!/usr/bin/env bash
# Start/stop the API and the in-place Nginx site from this repository.
# Usage: deploy/serve-local.sh [start|stop|restart|status]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONF="$ROOT/deploy/nginx.local.conf"
NGINX_PID_FILE="/tmp/xiayh-personal-site-nginx.pid"
RUN_DIR="${XDG_RUNTIME_DIR:-/tmp}/xiayh-personal-site"
API_PID_FILE="$RUN_DIR/api.pid"
API_LOG="$RUN_DIR/api.log"
API_URL="http://127.0.0.1:8080"
WEB_URL="http://127.0.0.1:8081"

mkdir -p "$RUN_DIR"

is_alive() {
  [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null
}

api_pid() {
  [[ -f "$API_PID_FILE" ]] && cat "$API_PID_FILE" || true
}

nginx_pid() {
  [[ -f "$NGINX_PID_FILE" ]] && cat "$NGINX_PID_FILE" || true
}

api_responding() {
  curl -fsS --max-time 1 "$API_URL/api/session" >/dev/null 2>&1
}

wait_for_api_pid() {
  for _ in {1..50}; do
    [[ -s "$API_PID_FILE" ]] && return 0
    sleep 0.05
  done
  return 1
}

wait_for_api() {
  for _ in {1..80}; do
    if api_responding; then return 0; fi
    sleep 0.25
  done
  return 1
}

start_api() {
  local pid
  pid="$(api_pid)"
  if is_alive "$pid"; then
    echo "API 已在运行 (pid $pid)"
    return
  fi
  rm -f "$API_PID_FILE"

  if api_responding; then
    echo "警告：$API_URL 已有服务响应，跳过 API 启动（该进程不归本脚本管理）" >&2
    return
  fi

  echo "启动 API…"
  # Start a detached process group so stop can terminate pnpm, node --watch and tsx together.
  setsid bash -c 'echo "$$" >"$0"; exec pnpm run dev:api' "$API_PID_FILE" \
    >"$API_LOG" 2>&1 </dev/null &

  if ! wait_for_api_pid; then
    echo "API 启动失败：没有生成 PID 文件（$API_PID_FILE）" >&2
    return 1
  fi
  pid="$(api_pid)"

  if wait_for_api; then
    echo "API 已就绪 (pid $pid)"
  else
    echo "API 启动失败，最近日志（$API_LOG）：" >&2
    tail -n 20 "$API_LOG" >&2 || true
    return 1
  fi
}

stop_api() {
  local pid
  pid="$(api_pid)"
  if ! is_alive "$pid"; then
    echo "API 未运行"
    rm -f "$API_PID_FILE"
    return
  fi

  echo "停止 API (pid $pid)…"
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  for _ in {1..25}; do
    is_alive "$pid" || break
    sleep 0.2
  done
  if is_alive "$pid"; then
    kill -9 -- "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$API_PID_FILE"
  echo "API 已停止"
}

require_nginx() {
  if command -v nginx >/dev/null 2>&1; then
    return
  fi
  cat >&2 <<'EOF'
未找到 nginx，无法启动站点。

请先安装（任选其一）：
  Debian/Ubuntu: sudo apt update && sudo apt install -y nginx
  Fedora/RHEL:   sudo dnf install -y nginx
  Arch:          sudo pacman -S nginx

安装后重新执行 pnpm serve。
EOF
  exit 1
}

start_nginx() {
  local pid
  require_nginx
  pid="$(nginx_pid)"
  if is_alive "$pid"; then
    echo "Nginx 已在运行 (pid $pid)"
    return
  fi

  nginx -t -c "$NGINX_CONF" -p "$ROOT" >/dev/null
  echo "启动 Nginx…"
  nginx -c "$NGINX_CONF" -p "$ROOT"
  echo "Nginx 已启动 (pid $(nginx_pid))"
}

stop_nginx() {
  local pid
  pid="$(nginx_pid)"
  if ! is_alive "$pid"; then
    echo "Nginx 未运行"
    return
  fi

  echo "停止 Nginx (pid $pid)…"
  nginx -c "$NGINX_CONF" -p "$ROOT" -s stop 2>/dev/null || true
  for _ in {1..25}; do
    is_alive "$pid" || break
    sleep 0.2
  done
  if is_alive "$pid"; then
    kill "$pid" 2>/dev/null || true
  fi
  echo "Nginx 已停止"
}

start_all() {
  require_nginx
  start_api
  start_nginx
  echo
  echo "API: $API_URL"
  echo "Web: $WEB_URL"
  echo "API 日志: $API_LOG"
}

stop_all() {
  stop_nginx
  stop_api
}

status() {
  local pid
  pid="$(api_pid)"
  if is_alive "$pid"; then
    echo "API:   运行中 (pid $pid) $API_URL"
  elif api_responding; then
    echo "API:   端口有响应，但不是本脚本启动的进程"
  else
    echo "API:   未运行"
  fi

  pid="$(nginx_pid)"
  if is_alive "$pid"; then
    echo "Nginx: 运行中 (pid $pid) $WEB_URL"
  else
    echo "Nginx: 未运行"
  fi
}

case "${1:-start}" in
  start) start_all ;;
  stop) stop_all ;;
  restart)
    stop_all
    start_all
    ;;
  status) status ;;
  *)
    echo "用法: $0 [start|stop|restart|status]" >&2
    exit 2
    ;;
esac
