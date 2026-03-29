from fastapi import FastAPI
from mangum import Mangum
from app.main_api.routers import recipe_router
from app.main_api.routers import user_router
from app.main_api.routers import auth_router
from app.main_api.routers import ai_router
from app.main_api.routers import system_router

app = FastAPI(title="Recipick API")

app.include_router(recipe_router.router)
app.include_router(user_router.router)
app.include_router(auth_router.router)
app.include_router(ai_router.router)
app.include_router(system_router.router)

handler = Mangum(app)
