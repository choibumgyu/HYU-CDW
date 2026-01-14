import json
from fastapi import HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from src.config import settings
from src.modules.sql_generator.dto import SqlGeneratorRequestDto
from langchain_core.messages.ai import AIMessage


def generate_response(prompt: str, sqlGeneratorRequest: SqlGeneratorRequestDto) -> AIMessage:
    try:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0,
            max_output_tokens=200,
            google_api_key=settings.gemini_api_key
        )
        chain = PromptTemplate.from_template(prompt) | _llm
        
        input_dict = sqlGeneratorRequest.model_dump()
        ai_message = chain.invoke(input_dict)
        
        if ai_message.content and type(ai_message.content) == str:
            key, value = ai_message.content.split(":")
            ai_message.content = {key.strip() : value.strip()}
        else:
            print(ai_message.content)
            raise HTTPException(status_code=500, detail="Invalid response from AI")
            
        return ai_message
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))