# syntax=docker/dockerfile:1.7
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM ghcr.io/yuss9/homi:latest AS homi
FROM ${BUILD_FROM}

RUN apk add --no-cache \
      nodejs \
      postgresql17 \
      postgresql17-client \
      clamav \
      clamav-daemon \
      curl \
      su-exec \
      tzdata \
    && addgroup -S -g 1001 homi \
    && adduser -S -D -H -u 1001 -G homi homi

WORKDIR /app
COPY --from=homi /app /app
COPY run.sh /run.sh
RUN chmod +x /run.sh \
    && mkdir -p /data/postgres /data/uploads /data/clamav /run/postgresql \
    && chown -R postgres:postgres /data/postgres /run/postgresql \
    && chown -R homi:homi /app /data/uploads \
    && chown -R clamav:clamav /data/clamav

EXPOSE 3000
CMD ["/run.sh"]
