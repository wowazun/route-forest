#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  printf 'Run this script with sudo.\n' >&2
  exit 1
fi

readonly APP_USER="m-osuke"
readonly APP_UID="$(id -u "${APP_USER}")"
readonly APP_ENV="/home/${APP_USER}/.config/route-forest/app.env"
readonly HELPER="/usr/local/libexec/route-forest-traceroute"
readonly LEGACY_SOURCE_UNIT="/home/${APP_USER}/route-forest/ops/systemd/route-forest.service"
readonly LEGACY_USER_UNIT="/home/${APP_USER}/.config/systemd/user/route-forest.service"
readonly SOURCE_UNIT="/home/${APP_USER}/route-forest/ops/systemd-system/route-forest.service"
readonly SYSTEM_UNIT="/etc/systemd/system/route-forest.service"
legacy_stopped=false

user_systemctl() {
  runuser -u "${APP_USER}" -- env \
    "XDG_RUNTIME_DIR=/run/user/${APP_UID}" \
    systemctl --user "$@"
}

rollback() {
  if [[ "${legacy_stopped}" = true ]]; then
    printf 'System service migration failed; restoring the user service.\n' >&2
    systemctl disable --now route-forest.service >/dev/null 2>&1 || true
    user_systemctl enable --now route-forest.service || true
  fi
}

trap rollback ERR

set_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "${APP_ENV}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${APP_ENV}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${APP_ENV}"
  fi
}

test -x "${HELPER}"
test "$(stat -c '%U:%G' "${HELPER}")" = "root:root"
install -m 0644 "${SOURCE_UNIT}" "${SYSTEM_UNIT}"
install -o "${APP_USER}" -g "${APP_USER}" -m 0644 \
  "${LEGACY_SOURCE_UNIT}" "${LEGACY_USER_UNIT}"

# Ambient capability inheritance requires an otherwise unprivileged
# executable. The capability is supplied by systemd, not by this file.
setcap -r "${HELPER}" 2>/dev/null || true
set_env "TRACEROUTE_BIN" "${HELPER}"
set_env "TRACEROUTE_METHOD" "icmp"
set_env "TRACEROUTE_FALLBACK_METHOD" "udp"
chmod 0600 "${APP_ENV}"
chown "${APP_USER}:${APP_USER}" "${APP_ENV}"

systemctl daemon-reload
user_systemctl daemon-reload
legacy_stopped=true
user_systemctl disable --now route-forest.service
systemctl enable --now route-forest.service
systemctl is-active --quiet route-forest.service
legacy_stopped=false
trap - ERR

readonly MAIN_PID="$(systemctl show route-forest.service --property=MainPID --value)"
grep -E '^(CapBnd|CapAmb|NoNewPrivs):' "/proc/${MAIN_PID}/status"
systemctl show route-forest.service \
  --property=User \
  --property=NoNewPrivileges \
  --property=CapabilityBoundingSet \
  --property=AmbientCapabilities \
  --property=MainPID
