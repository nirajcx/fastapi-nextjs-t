from fastapi import FastAPI

app = FastAPI(
    title="Todo API",
    description="Learning Todo app",
    version="0.0.1",
)

@app.get("/health")
async def health():
    return {"status": "ok"}
    
