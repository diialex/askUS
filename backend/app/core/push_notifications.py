"""
Expo Push Notifications helper.
Sends notifications through the Expo Push API (no FCM/APNs credentials needed).
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notifications(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> None:
    valid = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid:
        return

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high",
        }
        for token in valid
    ]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                logger.error("[Push] Expo API error %s: %s", resp.status_code, resp.text)
            else:
                logger.info("[Push] Enviadas %d notificaciones.", len(valid))
    except Exception as exc:
        logger.error("[Push] Error enviando notificaciones: %s", exc)
