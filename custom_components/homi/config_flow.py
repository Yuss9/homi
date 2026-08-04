"""Config flow for Homi."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import HomiApiClient, HomiApiError
from .const import CONF_HOME_ID, DOMAIN


async def validate_input(hass: HomeAssistant, data: dict) -> dict:
    """Validate credentials and resolve the connected home name."""
    client = HomiApiClient(
        async_get_clientsession(hass),
        data[CONF_URL],
        data[CONF_API_KEY],
        data[CONF_HOME_ID],
    )
    summary = await client.summary()
    return {
        "title": summary["home"]["name"],
        "home_id": summary["home"]["id"],
    }


class HomiConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the Homi setup wizard."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                info = await validate_input(self.hass, user_input)
            except HomiApiError as error:
                message = str(error).lower()
                errors["base"] = (
                    "invalid_auth"
                    if "401" in message or "403" in message
                    else "cannot_connect"
                )
            else:
                await self.async_set_unique_id(str(info["home_id"]))
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=info["title"], data=user_input)

        schema = vol.Schema(
            {
                vol.Required(CONF_URL, default="http://homeassistant.local:3000"): str,
                vol.Required(CONF_API_KEY): str,
                vol.Required(CONF_HOME_ID): str,
            }
        )
        return self.async_show_form(
            step_id="user", data_schema=schema, errors=errors
        )
