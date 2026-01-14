import faiss
import numpy as np
import os
import logging
import traceback

from datetime import datetime
from src.modules.sql_generator.dto import SqlGeneratorRequestDto, SqlGeneratorResponseDto
from src.modules.gemini import service as gemini_service
from sentence_transformers import SentenceTransformer
from src.modules.omop import service as omop_service

from src.modules.log.dto import SqlGeneratorLogRequestModel
from src.modules.log.service import save_sql_generator_log, get_query_and_log
from fastapi import HTTPException


def generate(sqlGeneratorRequestDto: SqlGeneratorRequestDto) -> SqlGeneratorResponseDto:
    try:
        model_service = gemini_service
        prompt = omop_service.get_prompt()
        
        #RAG를 사용한 Example 을 반영하는 코드
        example =  _add_relevant_query(sqlGeneratorRequestDto.text)
        
        # Example 이 존재할 때만 예시 추가
        if example:
            prompt += "\n <EXAMPLE> \n"
            prompt += "\n".join(example)
            prompt += "\n </EXAMPLE> \n"
            prompt += "\n Please use the above example for reference only and do not include it in your answer."

        
        llm_request_timestamp = datetime.now()
        result = model_service.generate_response(prompt, sqlGeneratorRequestDto)
        llm_response_timestamp = datetime.now()
        
        content = result.content
        
        sqlGeneratorResponseDto = SqlGeneratorResponseDto(
            sql=content.get("sql"),
            error=content.get("error")
        )
        
        save_sql_generator_log(SqlGeneratorLogRequestModel(
            user_input_text = sqlGeneratorRequestDto.text,
            input_received_timestamp = sqlGeneratorRequestDto.input_received_timestamp,
            
            pre_llm_filter_status = sqlGeneratorRequestDto.pre_llm_filter_status,
            pre_llm_filter_reason = sqlGeneratorRequestDto.pre_llm_filter_reason,
            pre_llm_filter_complete_timestamp = sqlGeneratorRequestDto.pre_llm_filter_complete_timestamp,
            
            generated_sql = sqlGeneratorResponseDto.sql,
            
            llm_request_timestamp = llm_request_timestamp,
            llm_response_timestamp = llm_response_timestamp,
            
            llm_validation_reason = sqlGeneratorResponseDto.error,
            
            llm_model_used = "GEMINI"
        ))

        if sqlGeneratorResponseDto.sql:
            _add_query_to_vector(sqlGeneratorRequestDto.text, sqlGeneratorResponseDto.sql)
        
        
        return sqlGeneratorResponseDto

    except Exception as e:
        print(f"Unexpected Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An unexpected server error occurred.")


""" RAG(Retrieval-Augmented Generation) """ 

def _rag_init() -> tuple[SentenceTransformer, list[str], list[str], faiss.IndexFlatL2]:
    # 임베딩 모델 로드, 영어 지원
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # file_names
    file_path = "src/modules/sql_generator/"
    query_file = "query_example.md"
    sql_file = "sql_example.md"
    index_file = "query_index.faiss"    
    
    # Vector DB 불러오기 없을 시 새로 생성
    index_path = file_path + index_file
    
    # 기존에 Vector DB 가 존재하는 경우
    # if os.path.exists(index_path):
    #     query_index = faiss.read_index(index_path)
        
    #     query_list = []
    
    #     with open(file_path + query_file, 'r', encoding='utf-8') as file:
    #         for line in file:
    #             query_list.append(line.strip())
        
    #     sql_list = [] 
    #     with open(file_path + sql_file, 'r', encoding='utf-8') as file:
    #         for line in file:
    #             query_list.append(line.strip())
        
    # Vector DB(_query_index) 를 새로 생성해야 하는 경우
    # (추후 함수화 필요)
    # else :
    
    # 현재는 서버 시작할 때마다 생성하게 함 추후 변경 가능
    # query, sql list 를 저장함
    query_list, sql_list = get_query_and_log()
        
    try:
        with open(file_path + query_file, 'w', encoding='utf-8') as f:
            for item in query_list:
                f.write(str(item) + '\n')
            
        with open(file_path + sql_file, 'w', encoding='utf-8') as f:
            for item in sql_list:
                f.write(str(item) + '\n')
            
            
    except IOError as e:
        print("Error occur during make query, sql list file")
        
        
    query_index = faiss.IndexFlatL2(embedding_model.get_sentence_embedding_dimension())

    # _query_list 를 vector 화 시켜서  vector DB 에 추가
    query_index.add(np.array(embedding_model.encode(query_list)))
    faiss.write_index(query_index, index_path)
    
    
    return embedding_model, query_list, sql_list, query_index

_embedding_model, _query_list, _sql_list, _query_index = _rag_init()

# Query 와 유사했던 이전의 Query 와 그에 대한 SQL을 Example 로 보내는 함수, top_k개의 example 선정
# sql_generator 의 service.py 에서만 실행하므로 private 함수로 설정
def _add_relevant_query(query: str, top_k: int = 1, max_distance_threshold : float = 1.0) -> list[str]:
    
    if not _query_list or not _sql_list:
        return []
    
    # 사용자의 Query 를 Vector 화 후 Vector DB 에서 비슷하다고 판단되는 Query의 index 를 찾고 반환
    query_vector = _embedding_model.encode([query])
    distances, indices = _query_index.search(query_vector, top_k)
    
    # max_distance_threshold 보다 낮은 경우에만 result 에 반영함
    result = []
    for dist, idx in zip(distances[0], indices[0]):
        if dist <= max_distance_threshold:
            result.append(f"query : {_query_list[idx]}, sql : {_sql_list[idx]}")
            
    return result

# vector db 에 query 추가 및 (query, sql) 쌍 추가
# 순서 유지 필수
def _add_query_to_vector(query: str, sql: str):
    query_vector = _embedding_model.encode([query])
    _query_index.add(query_vector)
    
    _query_list.append(query)
    _sql_list.append(sql)
    