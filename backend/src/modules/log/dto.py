from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.database import Base
# sqlAlchemy Model 정의


class SqlGeneratorLogRequestModel(Base):
    
    __tablename__ = "sql_generator_log"
    
    log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    # session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    input_received_timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    user_input_text: Mapped[str] = mapped_column(Text, nullable=True)
    
    pre_llm_filter_status: Mapped[str] = mapped_column(String(50), nullable=True)
    pre_llm_filter_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    pre_llm_filter_complete_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    generated_sql: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    llm_request_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    llm_response_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    llm_validation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    llm_model_used: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

class SqlExecutorLogRequestModel(Base):
    
    __tablename__ = "sql_executor_log"
    
    log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    sql: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    sql_validation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    pre_llm_filter_complete_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    post_llm_filter_complete_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    sql_execution_status: Mapped[str] = mapped_column(String(50), nullable=True)
    sql_error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    result_row_count : Mapped[int] = mapped_column(Integer, nullable=True)
    result_preview : Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    sql_execution_start_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    sql_execution_end_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)