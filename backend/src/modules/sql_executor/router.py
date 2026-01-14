from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.modules.sql_executor import service as sql_executor_service
from src.modules.sql_executor.dto import SqlExecutorRequestDto, SqlExecutorResponseDto


router = APIRouter(prefix="/sql-executor", tags=["Text to SQL"])


@router.post("/")
async def sql_executor(
    sqlExecutorRequestDto: SqlExecutorRequestDto,
    db: Session = Depends(get_db)
) -> SqlExecutorResponseDto:
    return await sql_executor_service.execute(sqlExecutorRequestDto, db)