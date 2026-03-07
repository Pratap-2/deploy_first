from pydantic import BaseModel


class CodeUpdatePayload(BaseModel):

    session_id: str
    problem_statement: str
    current_code: str
    compiler_output: str


class RunCodePayload(BaseModel):
    code: str
    input: str = ""


class AIRequestPayload(BaseModel):
    code: str
    problemId: int
    session_id: str = None

class ChatRequestPayload(BaseModel):
    message: str
    session_id: str
    code: str
    problemId: int
