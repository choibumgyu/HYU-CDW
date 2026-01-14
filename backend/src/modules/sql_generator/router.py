from fastapi import APIRouter

from src.modules.sql_generator.dto import SqlGeneratorRequestDto, SqlGeneratorResponseDto
from src.modules.sql_generator import service as sql_generator_service

router = APIRouter(prefix="/sql-generator", tags=["Text to SQL"])

@router.post("/")
async def text_to_sql(body: SqlGeneratorRequestDto) -> SqlGeneratorResponseDto:
    return sql_generator_service.generate(body)
