"""Homi integration setup and services."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import HomiApiClient, HomiApiError
from .const import (
    CONF_HOME_ID,
    DOMAIN,
    PLATFORMS,
    SERVICE_COMPLETE_MAINTENANCE,
    SERVICE_CREATE_MAINTENANCE,
    SERVICE_DECLARE_REPAIR,
    SERVICE_OPEN_ASSET,
)
from .coordinator import HomiDataCoordinator

SERVICE_ENTRY = vol.Optional("entry_id")
SERVICES = (
    SERVICE_CREATE_MAINTENANCE,
    SERVICE_COMPLETE_MAINTENANCE,
    SERVICE_DECLARE_REPAIR,
    SERVICE_OPEN_ASSET,
)


def _client_for_call(hass: HomeAssistant, call: ServiceCall) -> HomiApiClient:
    entries = list(hass.config_entries.async_entries(DOMAIN))
    requested = call.data.get("entry_id")
    if requested:
        entry = next((item for item in entries if item.entry_id == requested), None)
    else:
        entry = entries[0] if len(entries) == 1 else None
    if entry is None:
        raise HomeAssistantError(
            "Choose a Homi config entry when more than one home is configured."
        )
    return hass.data[DOMAIN][entry.entry_id]["client"]


def _iso_value(value: date | datetime | str | None) -> str | None:
    if value is None:
        return None
    return value.isoformat() if isinstance(value, (date, datetime)) else value


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Homi from a config entry."""
    client = HomiApiClient(
        async_get_clientsession(hass),
        entry.data[CONF_URL],
        entry.data[CONF_API_KEY],
        entry.data[CONF_HOME_ID],
    )
    coordinator = HomiDataCoordinator(hass, client, entry)
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        "client": client,
        "coordinator": coordinator,
    }
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    if not hass.services.has_service(DOMAIN, SERVICE_CREATE_MAINTENANCE):
        await _register_services(hass)
    return True


async def _register_services(hass: HomeAssistant) -> None:
    async def create_maintenance(call: ServiceCall) -> dict[str, Any]:
        client = _client_for_call(hass, call)
        payload = {
            "assetId": call.data.get("asset_id"),
            "title": call.data["title"],
            "description": call.data.get("description"),
            "nextDueAt": _iso_value(call.data.get("next_due_at")),
            "priority": call.data.get("priority", "MEDIUM"),
            "frequencyType": call.data.get("frequency_type", "ONCE"),
            "frequencyInterval": call.data.get("frequency_interval", 1),
        }
        try:
            return await client.create_maintenance(
                {key: value for key, value in payload.items() if value is not None}
            )
        except HomiApiError as error:
            raise HomeAssistantError(str(error)) from error

    async def complete_maintenance(call: ServiceCall) -> dict[str, Any]:
        client = _client_for_call(hass, call)
        payload = {
            "notes": call.data.get("notes"),
            "cost": (
                str(call.data["cost"]) if call.data.get("cost") is not None else None
            ),
            "currency": call.data.get("currency", "EUR"),
            "serviceProvider": call.data.get("service_provider"),
        }
        try:
            return await client.complete_maintenance(
                call.data["task_id"],
                {key: value for key, value in payload.items() if value is not None},
            )
        except HomiApiError as error:
            raise HomeAssistantError(str(error)) from error

    async def declare_repair(call: ServiceCall) -> dict[str, Any]:
        client = _client_for_call(hass, call)
        payload = {
            "assetId": call.data["asset_id"],
            "title": call.data["title"],
            "description": call.data.get("description"),
            "issueDate": _iso_value(
                call.data.get("issue_date", date.today().isoformat())
            ),
        }
        try:
            return await client.declare_repair(
                {key: value for key, value in payload.items() if value is not None}
            )
        except HomiApiError as error:
            raise HomeAssistantError(str(error)) from error

    async def open_asset(call: ServiceCall) -> dict[str, Any]:
        client = _client_for_call(hass, call)
        try:
            payload = await client.asset(call.data["asset_id"])
            url = f"{client.base_url.rstrip('/')}{payload['asset']['url']}"
            hass.bus.async_fire(
                "homi_open_asset", {"url": url, "asset": payload["asset"]}
            )
            return {"url": url, "asset": payload["asset"]}
        except HomiApiError as error:
            raise HomeAssistantError(str(error)) from error

    hass.services.async_register(
        DOMAIN,
        SERVICE_CREATE_MAINTENANCE,
        create_maintenance,
        schema=vol.Schema(
            {
                SERVICE_ENTRY: cv.string,
                vol.Required("title"): cv.string,
                vol.Optional("asset_id"): cv.string,
                vol.Optional("description"): cv.string,
                vol.Optional("next_due_at"): cv.datetime,
                vol.Optional("priority"): vol.In(
                    ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
                ),
                vol.Optional("frequency_type"): vol.In(
                    ["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]
                ),
                vol.Optional("frequency_interval"): vol.All(
                    vol.Coerce(int), vol.Range(min=1, max=3650)
                ),
            }
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_COMPLETE_MAINTENANCE,
        complete_maintenance,
        schema=vol.Schema(
            {
                SERVICE_ENTRY: cv.string,
                vol.Required("task_id"): cv.string,
                vol.Optional("notes"): cv.string,
                vol.Optional("cost"): vol.Coerce(float),
                vol.Optional("currency", default="EUR"): cv.string,
                vol.Optional("service_provider"): cv.string,
            }
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_DECLARE_REPAIR,
        declare_repair,
        schema=vol.Schema(
            {
                SERVICE_ENTRY: cv.string,
                vol.Required("asset_id"): cv.string,
                vol.Required("title"): cv.string,
                vol.Optional("description"): cv.string,
                vol.Optional("issue_date"): cv.date,
            }
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_OPEN_ASSET,
        open_asset,
        schema=vol.Schema(
            {SERVICE_ENTRY: cv.string, vol.Required("asset_id"): cv.string}
        ),
        supports_response=SupportsResponse.ONLY,
    )


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload Homi entities and remove shared services when the last entry leaves."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            for service in SERVICES:
                hass.services.async_remove(DOMAIN, service)
    return unloaded
