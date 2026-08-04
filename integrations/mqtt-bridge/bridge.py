"""Bridge MQTT measurements and alerts to scoped Homi maintenance APIs."""

from __future__ import annotations

import json
import logging
import os
import signal
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
import requests

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
LOGGER = logging.getLogger("homi-mqtt-bridge")
STATE_PATH = Path(os.getenv("HOMI_MQTT_STATE_PATH", "/data/state.json"))


@dataclass(frozen=True)
class Rule:
    topic: str
    title: str
    asset_id: str | None = None
    home_id: str | None = None
    description: str | None = None
    mode: str = "alert"
    threshold: float | None = None
    equals: str | None = None
    cooldown_seconds: int = 86400
    priority: str = "MEDIUM"

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "Rule":
        return cls(
            topic=str(value["topic"]),
            title=str(value["title"]),
            asset_id=value.get("assetId"),
            home_id=value.get("homeId"),
            description=value.get("description"),
            mode=str(value.get("mode", "alert")),
            threshold=float(value["threshold"]) if value.get("threshold") is not None else None,
            equals=str(value["equals"]) if value.get("equals") is not None else None,
            cooldown_seconds=max(60, int(value.get("cooldownSeconds", 86400))),
            priority=str(value.get("priority", "MEDIUM")).upper(),
        )


class Bridge:
    def __init__(self) -> None:
        self.homi_url = os.environ["HOMI_URL"].rstrip("/")
        self.api_key = os.environ["HOMI_API_KEY"]
        self.default_home_id = os.environ.get("HOMI_HOME_ID")
        self.rules = [
            Rule.from_dict(item)
            for item in json.loads(os.getenv("HOMI_MQTT_RULES", "[]"))
        ]
        if not self.rules:
            raise RuntimeError("HOMI_MQTT_RULES must contain at least one rule")
        self.state = self._load_state()
        self.stop_event = threading.Event()
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        if os.getenv("MQTT_USERNAME"):
            self.client.username_pw_set(
                os.environ["MQTT_USERNAME"], os.getenv("MQTT_PASSWORD")
            )
        self.client.tls_set() if os.getenv("MQTT_TLS", "false").lower() == "true" else None
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

    def _load_state(self) -> dict[str, float]:
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_state(self) -> None:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary = STATE_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state), encoding="utf-8")
        temporary.replace(STATE_PATH)

    def on_connect(self, client: mqtt.Client, userdata: Any, flags: Any, reason_code: Any, properties: Any) -> None:
        if reason_code != 0:
            LOGGER.error("MQTT connection failed: %s", reason_code)
            return
        LOGGER.info("Connected to MQTT broker")
        for topic in sorted({rule.topic for rule in self.rules}):
            client.subscribe(topic, qos=1)
            LOGGER.info("Subscribed to %s", topic)

    def on_disconnect(self, client: mqtt.Client, userdata: Any, flags: Any, reason_code: Any, properties: Any) -> None:
        if not self.stop_event.is_set():
            LOGGER.warning("MQTT disconnected: %s", reason_code)

    def matches(self, rule: Rule, payload: str) -> bool:
        if rule.mode in {"counter", "usage"}:
            try:
                value = float(payload)
            except ValueError:
                LOGGER.warning("Ignoring non-numeric payload for %s", rule.topic)
                return False
            return rule.threshold is not None and value >= rule.threshold
        if rule.mode == "state":
            return rule.equals is not None and payload.lower() == rule.equals.lower()
        if rule.equals is not None:
            return payload.lower() == rule.equals.lower()
        return payload.lower() not in {"", "0", "false", "off", "ok", "clear"}

    def on_message(self, client: mqtt.Client, userdata: Any, message: mqtt.MQTTMessage) -> None:
        payload = message.payload.decode("utf-8", errors="replace").strip()
        for index, rule in enumerate(self.rules):
            if not mqtt.topic_matches_sub(rule.topic, message.topic):
                continue
            if not self.matches(rule, payload):
                continue
            state_key = f"{index}:{message.topic}"
            last_sent = self.state.get(state_key, 0)
            if time.time() - last_sent < rule.cooldown_seconds:
                LOGGER.debug("Cooldown active for %s", state_key)
                continue
            try:
                self.create_maintenance(rule, payload, message.topic)
            except Exception:
                LOGGER.exception("Could not create Homi maintenance for %s", message.topic)
                continue
            self.state[state_key] = time.time()
            self._save_state()

    def create_maintenance(self, rule: Rule, payload: str, topic: str) -> None:
        home_id = rule.home_id or self.default_home_id
        if not home_id:
            raise RuntimeError("A rule or HOMI_HOME_ID must define the target home")
        body = {
            "homeId": home_id,
            "assetId": rule.asset_id,
            "title": rule.title,
            "description": rule.description
            or f"Created by MQTT rule from {topic}. Last payload: {payload}",
            "frequencyType": "ONCE",
            "frequencyInterval": 1,
            "nextDueAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "priority": rule.priority,
        }
        response = requests.post(
            f"{self.homi_url}/api/v1/maintenance",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={key: value for key, value in body.items() if value is not None},
            timeout=20,
        )
        response.raise_for_status()
        task = response.json()["task"]
        LOGGER.info("Created Homi maintenance %s from %s", task["id"], topic)

    def run(self) -> None:
        host = os.getenv("MQTT_HOST", "mqtt")
        port = int(os.getenv("MQTT_PORT", "8883" if os.getenv("MQTT_TLS") == "true" else "1883"))
        self.client.connect(host, port, keepalive=60)
        self.client.loop_start()
        self.stop_event.wait()
        self.client.disconnect()
        self.client.loop_stop()

    def stop(self, *_: Any) -> None:
        self.stop_event.set()


if __name__ == "__main__":
    bridge = Bridge()
    signal.signal(signal.SIGTERM, bridge.stop)
    signal.signal(signal.SIGINT, bridge.stop)
    bridge.run()
