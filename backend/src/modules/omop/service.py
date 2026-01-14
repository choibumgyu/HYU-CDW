from functools import lru_cache
import json
from typing import Dict, Set
from langchain_community.document_loaders import UnstructuredMarkdownLoader

@lru_cache(maxsize=1)
def get_allowed_schema() -> Dict[str, Set[str]]:
    """
    Returns a dictionary representing the allowed schema for OMOP tables.
    The keys are table names and the values are sets of allowed column names.
    This schema is loaded from a JSON file located at 'src/modules/omop/allowed_schema.json'.
    The JSON file should contain a dictionary where each key is a table name
    and each value is a list of allowed column names.
    The function caches the result to avoid reloading the schema on subsequent calls.
    The schema is loaded only once, and subsequent calls will return the cached result.
    """
    
    with open('src/modules/omop/allowed_schema.json', 'r') as f:
        schema = json.load(f)
        
    for table, columns in schema.items():
        if type(columns) == list:
            schema[table] = set(columns) 
    
    return schema


@lru_cache()
def get_prompt() -> str:
    """
    Returns the prompt for SQL generation from a markdown file.
    The markdown file is located at 'src/modules/omop/prompt.md'.
    The function loads the content of the markdown file using the UnstructuredMarkdownLoader
    and returns the page content of the first document.
    The function caches the result to avoid reloading the prompt on subsequent calls.
    """
    
    
    loader = UnstructuredMarkdownLoader("src/modules/omop/prompt.md")
    data = loader.load()
    
    return data[0].page_content