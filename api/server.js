import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json({ limit: "200kb" }));

app.use(cors({ origin: true }));


const INFERENCE_URL =  process.env.INFERENCE_URL || "http://127.0.0.1:8000/internal/improve-prompt";



const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callInferenceWithTimeout(url, body, timeoutMs = 20000) {//20s
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

app.post("/v1/improve-prompt", async (req, res) => {
  const trace_id = crypto.randomUUID();
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ trace_id, error: "prompt is required" });
  }

  let r;

  try {
   
    r = await callInferenceWithTimeout(INFERENCE_URL, { prompt }, 20000);

    // retry once again
    if (r.status === 502 || r.status === 503) {
      await sleep(300);
      r = await callInferenceWithTimeout(INFERENCE_URL, { prompt }, 20000);
    }

  } catch (e) {
    if (e.name === "AbortError") {
      return res.status(502).json({
        trace_id,
        error: "inference_timeout",
      });
    }

    return res.status(502).json({
      trace_id,
      error: "inference_service_unreachable",
    });
  }

  if (!r) {
    return res.status(502).json({
      trace_id,
      error: "inference_service_unreachable",
    });
  }

  let data;
  try {
    data = await r.json();
  } catch {
    return res.status(502).json({
      trace_id,
      error: "invalid_json_from_inference",
    });
  }

  if (!r.ok) {
    return res.status(502).json({
      trace_id,
      error: "inference_failed",
      detail: data,
    });
  }

  return res.json({ trace_id, ...data });
});


app.listen(3000, () => {
  console.log("api-gateway on :3000");
});
