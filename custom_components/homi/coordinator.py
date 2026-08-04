"""Data coordinator for the Homi integration."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import HomiApiClient, HomiApiError
from .const import DEFAULT_SCAN_INTERVAL_SECONDS, DOMAIN


class HomiDataCoordinator(DataUpdateCoordinator[dict]):
    """Poll a Homi home summary and distribute it to entities."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, client: HomiApiClient, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            logger=__import__("logging").getLogger(__name__),
            name=f"{DOMAIN}_{entry.entry_id}",
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL_SECONDS),
        )
        self.client = client
        self.config_entry = entry

    async def _async_update_data(self) -> dict:
        try:
            return await self.client.summary()
        except HomiApiError as error:
            raise UpdateFailed(str(error)) from error
