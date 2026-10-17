"""
WebSocket connection manager for real-time booking and status updates.
"""
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Map: user_id -> set of WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)
        logger.info(f"WS connected: user={user_id}, total={sum(len(s) for s in self._connections.values())}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info(f"WS disconnected: user={user_id}")

    async def send_to_user(self, user_id: str, data: dict) -> None:
        conns = self._connections.get(user_id, set())
        dead = set()
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections.get(user_id, set()).discard(ws)

    async def broadcast_to_users(self, user_ids: list[str], data: dict) -> None:
        for uid in user_ids:
            await self.send_to_user(uid, data)


# Singleton
ws_manager = ConnectionManager()
