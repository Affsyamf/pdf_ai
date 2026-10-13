from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.chat import chat_router
from routers.document import document_router

app = FastAPI(title="Afif AI API")

origins = [
    "http://localhost:5173",  
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router.router)
app.include_router(document_router.router)
@app.get("/")
def read_root():
    return {"message": "Welcome to Afif AI Backend!"}