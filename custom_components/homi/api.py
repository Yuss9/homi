"""Async Homi API client used by Home Assistant."""

from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from aiohttp import ClientError, ClientSession


class HomiApiError(Exception):
    """Raised when Homi returns an invalid or unsuccessful response."""


class HomiApiClient:
    """Small authenticated client for Homi's scoped API."""

    def __init__(self, session: ClientSession, base_url: str, api_key: str, home_id: str) -> None:
        self._session = session
        self.base_url = base_url.rstrip("/") + "/"
        self.api_key = api_key
        self.home_id = home_id

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            async with self._session.request(
                method,
                urljoin(self.base_url, path.lstrip("/")),
                headers=self.headers,
                params=params,
                json=json,
                timeout=20,
            ) as response:
                payload = await response.json(content_type=None)
                if response.status >= 400:
                    message = payload.get("error", {}).get("message", "Homi request failed")
                    raise HomiApiError(f"HTTP {response.status}: {message}")
                return payload
        except (ClientError, TimeoutError, ValueError) as error:
            raise HomiApiError(str(error)) from error

    async def summary(self) -> dict[str, Any]:
        payload = await self._request(
            "GET",
            "/api/v1/home/summary",
            params={"homeId": self.home_id},
        )
        return payload["summary"]

    async def create_maintenance(self, data: dict[str, Any]) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/api/v1/maintenance",
            json={"homeId": self.home_id, **data},
        )

    async def complete_maintenance(self, task_id: str, data: dict[str, Any]) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/api/v1/maintenance/{task_id}/complete",
            json=data,
        )

    async def declare_repair(self, data: dict[str, Any]) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/api/v1/repairs",
            json={"homeId": self.home_id, **data},
        )

    async def asset(self, asset_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/api/v1/assets/{asset_id}")
