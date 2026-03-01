from __future__ import annotations

from supabase import Client, create_client

from app.config import SUPABASE_KEY, SUPABASE_URL


class LazySupabaseClient:
    def __init__(self) -> None:
        self._client: Client | None = None

    def _get_client(self) -> Client:
        if self._client is None:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise RuntimeError(
                    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in server/.env."
                )

            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)

        return self._client

    def __getattr__(self, name: str):
        return getattr(self._get_client(), name)


supabase = LazySupabaseClient()
