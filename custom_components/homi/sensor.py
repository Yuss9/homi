"""Sensor entities for Homi."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfCurrency
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import HomiDataCoordinator


@dataclass(frozen=True, kw_only=True)
class HomiSensorDescription(SensorEntityDescription):
    value_fn: Callable[[dict[str, Any]], Any]
    attributes_fn: Callable[[dict[str, Any]], dict[str, Any]] | None = None


SENSORS = (
    HomiSensorDescription(
        key="home_health",
        translation_key="home_health",
        icon="mdi:home-heart",
        native_unit_of_measurement="%",
        value_fn=lambda data: data["health"]["score"],
        attributes_fn=lambda data: {
            "level": data["health"]["level"],
            "label": data["health"]["label"],
            "summary": data["health"]["summary"],
        },
    ),
    HomiSensorDescription(
        key="overdue_maintenance",
        translation_key="overdue_maintenance",
        icon="mdi:wrench-clock",
        value_fn=lambda data: data["metrics"]["overdueMaintenance"],
    ),
    HomiSensorDescription(
        key="open_repairs",
        translation_key="open_repairs",
        icon="mdi:hammer-wrench",
        value_fn=lambda data: data["metrics"]["openRepairs"],
        attributes_fn=lambda data: {"items": data.get("openRepairItems", [])},
    ),
    HomiSensorDescription(
        key="expiring_warranties",
        translation_key="expiring_warranties",
        icon="mdi:shield-clock",
        value_fn=lambda data: data["metrics"]["warrantiesExpiringSoon"],
    ),
    HomiSensorDescription(
        key="expiring_documents",
        translation_key="expiring_documents",
        icon="mdi:file-clock",
        value_fn=lambda data: data["metrics"]["documentsExpiringSoon"],
    ),
    HomiSensorDescription(
        key="monthly_costs",
        translation_key="monthly_costs",
        icon="mdi:cash-multiple",
        native_unit_of_measurement=UnitOfCurrency.EURO,
        value_fn=lambda data: data["metrics"]["monthlyCosts"],
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Create Homi sensors from one config entry."""
    coordinator: HomiDataCoordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    async_add_entities(HomiSensor(coordinator, entry, description) for description in SENSORS)


class HomiSensor(CoordinatorEntity[HomiDataCoordinator], SensorEntity):
    """One home-scoped Homi metric."""

    entity_description: HomiSensorDescription
    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: HomiDataCoordinator,
        entry: ConfigEntry,
        description: HomiSensorDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.unique_id}_{description.key}"
        home = coordinator.data["home"]
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, str(home["id"]))},
            name=home["name"],
            manufacturer="Homi",
            model="Private home journal",
            configuration_url=coordinator.client.base_url,
        )

    @property
    def native_value(self) -> Any:
        return self.entity_description.value_fn(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self.entity_description.attributes_fn is None:
            return None
        return self.entity_description.attributes_fn(self.coordinator.data)
