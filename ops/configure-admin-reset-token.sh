#!/bin/sh
set -eu

config_directory="${1:-/home/m-osuke/.config/route-forest}"
environment_file="${config_directory}/app.env"
token_file="${config_directory}/admin-reset-token"

if [ ! -f "${environment_file}" ]; then
  printf 'Environment file not found: %s\n' "${environment_file}" >&2
  exit 1
fi

umask 077
token="$(
  sed -n 's/^ADMIN_RESET_TOKEN=//p' "${environment_file}" |
    tail -n 1
)"

if [ "${#token}" -lt 32 ]; then
  token="$(
    openssl rand -base64 32 |
      tr '+/' '-_' |
      tr -d '='
  )"
  if grep -q '^ADMIN_RESET_TOKEN=' "${environment_file}"; then
    sed -i \
      "s/^ADMIN_RESET_TOKEN=.*/ADMIN_RESET_TOKEN=${token}/" \
      "${environment_file}"
  else
    printf '\nADMIN_RESET_TOKEN=%s\n' "${token}" >> "${environment_file}"
  fi
fi

printf '%s\n' "${token}" > "${token_file}"
chmod 600 "${environment_file}" "${token_file}"
printf 'Admin reset token configured (%s characters).\n' "${#token}"
