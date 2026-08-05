"""WebSocket live updates."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()


def create_ws_router(get_engine) -> APIRouter:
    ws_router = APIRouter()

    @ws_router.websocket("/ws/live")
    async def live(websocket: WebSocket) -> None:
        await websocket.accept()
        engine = get_engine()
        queue = engine.subscribe()
        try:
            # Immediate snapshot
            await websocket.send_json(
                {
                    "type": "status",
                    "data": engine.get_status().model_dump(mode="json"),
                }
            )
            weather = engine.current_weather()
            if weather:
                await websocket.send_json({"type": "weather", "data": weather})
            await websocket.send_json(
                {
                    "type": "mappings",
                    "data": [m.model_dump() for m in engine.store.mappings],
                }
            )

            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    await websocket.send_json(message)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            logger.debug("WebSocket disconnected")
        except Exception:
            logger.exception("WebSocket error")
        finally:
            engine.unsubscribe(queue)

    return ws_router
