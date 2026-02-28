from fastapi import FastAPI

from .api import router


app = FastAPI(title="RememberMe Placeholder API", version="0.1.0")
app.include_router(router)
