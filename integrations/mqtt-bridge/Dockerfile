FROM python:3.13-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN addgroup -S homi && adduser -S -G homi homi
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY bridge.py ./
RUN mkdir -p /data && chown -R homi:homi /app /data
USER homi
ENTRYPOINT ["python", "/app/bridge.py"]
