#!/bin/sh
set -e

envsubst '${VITE_FOURSQUARE_CLIENT_ID} ${VITE_FOURSQUARE_CLIENT_SECRET}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
