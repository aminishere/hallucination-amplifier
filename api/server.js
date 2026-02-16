import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "200kb" }));

const INFERENCE_URL =
  process.env.INFERENCE_URL || "http://127.0.0.1:8000/internal/improve-prompt";


app.get("/healthz", (req, res) => res.json({ ok: true }));

app.post("/v1/improve-prompt", async (req, res) => {
  const trace_id = crypto.randomUUID();
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ trace_id, error: "prompt is required" });
  }

  let r;
  try {
    r = await fetch(INFERENCE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": trace_id
      },
      body: JSON.stringify({ prompt })
    });
  } catch (e) {
    return res.status(502).json({ trace_id, error: "inference_service_unreachable" });
  }

  let data;
  try {
    data = await r.json();
  } catch {
    return res.status(502).json({ trace_id, error: "invalid_json_from_inference" });
  }

  if (!r.ok) {
    return res.status(502).json({ trace_id, error: "inference_failed", detail: data });
  }

  return res.json({ trace_id, ...data });
});

app.listen(3000, () => console.log("api-gateway on :3000"));
