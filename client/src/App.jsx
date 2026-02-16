import { useState } from "react";

const API_URL = "http://127.0.0.1:3000/v1/improve-prompt";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [triggers, setTriggers] = useState([]);
  const [improvedPrompt, setImprovedPrompt] = useState("");

  async function runAnalysis() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setTraceId("");
    setTriggers([]);
    setImprovedPrompt("");

    try {
      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await r.json();

      if (!r.ok) {
        throw new Error(data?.error || "Request failed");
      }

      setTraceId(data.trace_id || "");
      setTriggers(data.hallucination_triggers || []);
      setImprovedPrompt(data.improved_prompt || "");
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <header>
          <h1 className="text-2xl font-bold">Hallucination Amplifier</h1>
          <p className="text-slate-400">
            Detect why a prompt causes hallucinations and generate a safer prompt.
          </p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <label className="text-sm text-slate-300">Input prompt</label>
          <textarea
            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder='Example: "What is the latest version of React? Give details."'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="flex items-center gap-4">
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium"
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-400">{error}</div>
          )}
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="font-semibold mb-3">Hallucination Triggers</h2>

            {triggers.length === 0 ? (
              <p className="text-sm text-slate-400">No analysis yet.</p>
            ) : (
              <ul className="space-y-3 list-decimal list-inside">
                {triggers.map((t, i) => (
                  <li key={i}>
                    <p className="font-medium">{t.issue}</p>
                    <p className="text-sm text-slate-400">{t.why}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Improved Prompt</h2>
              <button
                onClick={() => navigator.clipboard.writeText(improvedPrompt)}
                disabled={!improvedPrompt}
                className="text-xs px-3 py-1 border border-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                Copy
              </button>
            </div>

            {improvedPrompt ? (
              <pre className="whitespace-pre-wrap text-sm bg-slate-950 border border-slate-800 rounded-lg p-3">
                {improvedPrompt}
              </pre>
            ) : (
              <p className="text-sm text-slate-400">No improved prompt yet.</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
