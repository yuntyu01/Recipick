from fastapi import FastAPI
from mangum import Mangum
from app.main_api.routers import recipe_router

app = FastAPI(title="Recipick API")

app.include_router(recipe_router.router)

handler = Mangum(app)
