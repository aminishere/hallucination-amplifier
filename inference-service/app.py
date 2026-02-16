# app.py
import os, json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from huggingface_hub import InferenceClient

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN not set")

MODEL_ID = os.getenv("MODEL_ID", "meta-llama/Llama-3.1-8B-Instruct:novita")
client = InferenceClient(api_key=HF_TOKEN)

app = FastAPI()

class ImproveReq(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)

class Trigger(BaseModel):
    issue: str
    why: str

class ImproveResp(BaseModel):
    hallucination_triggers: list[Trigger]
    improved_prompt: str

SYSTEM_PROMPT = """
You are a prompt auditor. Your job is to diagnose why a prompt will cause hallucination,
and rewrite it into a safer prompt that minimizes hallucination.

Return STRICT JSON ONLY in exactly this shape:
{
  "hallucination_triggers": [
    {"issue":"...", "why":"..."}
  ],
  "improved_prompt": "..."
}

Rules:
- hallucination_triggers: 3 to 7 items
- Issues must be concrete (e.g., missing date/source, ambiguous entity, undefined scope, asks for latest/current, requires external data, invites guessing).
- improved_prompt must be a rewritten version of the user's prompt:
  - asks for needed missing info (as questions) OR requires the user to provide sources/context
  - forbids guessing
  - demands citations or says "only use provided context" if context is supplied
- No markdown. No extra keys. No commentary outside JSON.
""".strip()

@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_ID}

@app.post("/internal/improve-prompt", response_model=ImproveResp)
def improve_prompt(req: ImproveReq):
    user_prompt = req.prompt.strip()

    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"USER_PROMPT:\n{user_prompt}"}
            ],
            temperature=0.2,
        )
        raw = completion.choices[0].message["content"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        obj = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=502, detail={"error": "Model did not return valid JSON", "raw": raw})

    # minimal structural checks (no hardcoding content)
    if "hallucination_triggers" not in obj or "improved_prompt" not in obj:
        raise HTTPException(status_code=502, detail={"error": "Missing required keys", "raw": obj})

    return obj
