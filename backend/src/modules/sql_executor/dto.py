from typing import Optional, Union
from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

from src.validator.sql_validator.basic_sql_validator import BasicSQLValidator   # 기본 검증
from src.validator.sql_validator.syntax_sql_validator import SQLSyntaxStructureValidator # 문법 및 구조 검사


class SqlExecutorRequestDto(BaseModel):
    sql: str = Field(..., title="SQL to execute on OMOP DB", description="The SQL to execute on OMOP DB")
    
    @field_validator("sql")
    def validate_text(cls, value):
        try:
            # 쿼리 기본 검증
            BasicSQLValidator(value).validate()
            # 쿼리 문법 및 구조 검사
            SQLSyntaxStructureValidator(value).validate()
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        return value
    
class SqlExecutorResponseDto(BaseModel):
    data: Optional[Union[list, dict]] = Field(None, title="Data", description="The data returned from the OMOP DB")
    error: Optional[str] = Field(None, title="Error", description="The error message if an error occurred")