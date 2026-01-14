from fastapi import FastAPI
from src.modules.sql_generator.router import router as sql_generator_router
from src.modules.sql_executor.router import router as sql_executor_router
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings

app = FastAPI()

app.include_router(sql_generator_router)
app.include_router(sql_executor_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_model=dict, tags=["Health Check"])
def health_check():
    return {"status": "ok"}