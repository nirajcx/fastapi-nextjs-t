from fastapi import FastAPI, HTTPException, Request
import uuid

app = FastAPI()

data = [
    {
        "id":1,
        "work": "test",
        "isCompleted":False
    }
]

@app.get("/health")
def hello():
    return {"message": "Ok"}


@app.get("/gettodo")
def list_all_todo():
    return data

@app.post("/createtodo")
async def create_todo(request:Request):
    body = await request.json()
    print(body)
    new_todo = {
        "id":str(uuid.uuid4()),
        "work":body["work"],
        "isCompleted":body["isCompleted"]
    }
    data.append(new_todo)
    return new_todo

@app.delete("/deltodo/{id}")
def delete_todo(id: str):
    for index,todo in enumerate(data):
        if todo["id"] == id:
            deleted = data.pop(index)
            return {"message": "Todo deleted", "data": deleted}
    raise HTTPException(status_code=404, detail="Todo not found")

@app.patch("/updatetodo")
async def update_todo(request:Request):
    body = await request.json()
    for index,todo in enumerate(data):
        if todo["id"] == body["id"]:
            updated_todo = {**todo,"isCompleted":body["isCompleted"],"work":body["work"]}
            data[index] = updated_todo
            return {"message":"todo updated","data":updated_todo}
    raise HTTPException(status_code=404, detail="Todo not found")