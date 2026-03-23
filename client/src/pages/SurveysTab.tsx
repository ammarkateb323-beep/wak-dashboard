import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  BarChart2, Edit2, CheckCircle2, XCircle, ClipboardList,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "rating" | "multiple_choice" | "free_text";

interface Survey {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
  question_count: number;
  response_count: number;
  submitted_count: number;
}

interface Question {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  order_index: number;
}

interface QuestionDraft {
  _key: string; // local key for react
  id?: number;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  order_index: number;
}

interface SurveyDraft {
  id?: number;
  title: string;
  description: string;
  questions: QuestionDraft[];
}

interface ResultData {
  survey: Survey;
  totalSent: number;
  totalSubmitted: number;
  responseRate: number;
  questions: any[];
  agentBreakdown: { agent: string; chatsHandled: number; avgRating: number | null }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _keyCounter = 0;
function newKey() { return `q_${++_keyCounter}`; }

function blankQuestion(order_index: number): QuestionDraft {
  return { _key: newKey(), question_text: "", question_type: "rating", options: [], order_index };
}

function questionFromServer(q: Question): QuestionDraft {
  return { _key: newKey(), id: q.id, question_text: q.question_text, question_type: q.question_type, options: q.options ?? [], order_index: q.order_index };
}

// ── Component ─────────────────────────────────────────────────────────────────

type View = "list" | "editor" | "results";

export default function SurveysTab() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [view, setView] = useState<View>("list");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [deletedQIds, setDeletedQIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Results state
  const [results, setResults] = useState<ResultData | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) setLocation("/login");
  }, [isAuthLoading, isAuthenticated, setLocation]);

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/surveys", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load surveys");
      setSurveys(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchSurveys();
  }, [isAuthenticated, fetchSurveys]);

  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const openNew = () => {
    setDraft({ title: "", description: "", questions: [] });
    setDeletedQIds([]);
    setSaveError("");
    setView("editor");
  };

  const openEdit = async (id: number) => {
    setSaveError("");
    setDeletedQIds([]);
    try {
      const res = await fetch(`/api/surveys/${id}`, { credentials: "include" });
      const data = await res.json();
      setDraft({
        id: data.id,
        title: data.title,
        description: data.description ?? "",
        questions: (data.questions as Question[]).map(questionFromServer),
      });
      setView("editor");
    } catch {
      setError("Failed to load survey for editing.");
    }
  };

  const openResults = async (id: number) => {
    setResultsLoading(true);
    setResults(null);
    setView("results");
    try {
      const res = await fetch(`/api/surveys/${id}/results`, { credentials: "include" });
      setResults(await res.json());
    } catch {
      setError("Failed to load results.");
    } finally {
      setResultsLoading(false);
    }
  };

  const activate = async (id: number) => {
    await fetch(`/api/surveys/${id}/activate`, { method: "POST", credentials: "include" });
    fetchSurveys();
  };

  const deactivate = async (id: number) => {
    await fetch(`/api/surveys/${id}/deactivate`, { method: "POST", credentials: "include" });
    fetchSurveys();
  };

  const deleteSurvey = async (id: number, title: string) => {
    if (!confirm(`Delete survey "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/surveys/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.message || "Failed to delete survey.");
      return;
    }
    fetchSurveys();
  };

  // ── Editor helpers ───────────────────────────────────────────────────────────

  const addQuestion = () => {
    if (!draft) return;
    setDraft({ ...draft, questions: [...draft.questions, blankQuestion(draft.questions.length)] });
  };

  const updateQuestion = (key: string, changes: Partial<QuestionDraft>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: draft.questions.map((q) => q._key === key ? { ...q, ...changes } : q),
    });
  };

  const removeQuestion = (key: string) => {
    if (!draft) return;
    const q = draft.questions.find((q) => q._key === key);
    if (q?.id) setDeletedQIds((prev) => [...prev, q.id!]);
    setDraft({ ...draft, questions: draft.questions.filter((q) => q._key !== key).map((q, i) => ({ ...q, order_index: i })) });
  };

  const moveQuestion = (key: string, dir: -1 | 1) => {
    if (!draft) return;
    const idx = draft.questions.findIndex((q) => q._key === key);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= draft.questions.length) return;
    const qs = [...draft.questions];
    [qs[idx], qs[newIdx]] = [qs[newIdx], qs[idx]];
    setDraft({ ...draft, questions: qs.map((q, i) => ({ ...q, order_index: i })) });
  };

  const addOption = (key: string) => {
    const q = draft?.questions.find((q) => q._key === key);
    if (!q) return;
    updateQuestion(key, { options: [...q.options, ""] });
  };

  const updateOption = (key: string, optIdx: number, value: string) => {
    const q = draft?.questions.find((q) => q._key === key);
    if (!q) return;
    const opts = [...q.options];
    opts[optIdx] = value;
    updateQuestion(key, { options: opts });
  };

  const removeOption = (key: string, optIdx: number) => {
    const q = draft?.questions.find((q) => q._key === key);
    if (!q) return;
    updateQuestion(key, { options: q.options.filter((_, i) => i !== optIdx) });
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaveError("");
    setSaving(true);
    try {
      let surveyId = draft.id;

      // 1. Create or update survey
      if (!surveyId) {
        const res = await fetch("/api/surveys", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: draft.title, description: draft.description }),
        });
        if (!res.ok) throw new Error((await res.json()).message);
        surveyId = (await res.json()).id;
      } else {
        const res = await fetch(`/api/surveys/${surveyId}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: draft.title, description: draft.description }),
        });
        if (!res.ok) throw new Error((await res.json()).message);
      }

      // 2. Delete removed questions
      for (const qid of deletedQIds) {
        await fetch(`/api/surveys/${surveyId}/questions/${qid}`, { method: "DELETE", credentials: "include" });
      }

      // 3. Save questions (create new, update existing)
      const savedIds: { _key: string; id: number }[] = [];
      for (const q of draft.questions) {
        const body = {
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.question_type === "multiple_choice" ? q.options.filter(Boolean) : null,
          order_index: q.order_index,
        };
        if (!q.id) {
          const res = await fetch(`/api/surveys/${surveyId}/questions`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error((await res.json()).message);
          const saved = await res.json();
          savedIds.push({ _key: q._key, id: saved.id });
        } else {
          await fetch(`/api/surveys/${surveyId}/questions/${q.id}`, {
            method: "PUT", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      }

      setView("list");
      fetchSurveys();
    } catch (e: any) {
      setSaveError(e.message || "Failed to save survey.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render: List ─────────────────────────────────────────────────────────────

  const renderList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Surveys</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-[#0F510F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d4510] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Survey
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-4 border-[#0F510F]/20 border-t-[#0F510F] rounded-full animate-spin" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No surveys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Title</th>
                <th className="text-center px-3 py-3 text-muted-foreground font-medium">Qs</th>
                <th className="text-center px-3 py-3 text-muted-foreground font-medium">Sent</th>
                <th className="text-center px-3 py-3 text-muted-foreground font-medium">Rate</th>
                <th className="text-center px-3 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {surveys.map((s) => {
                const rate = s.response_count > 0 ? Math.round((s.submitted_count / s.response_count) * 100) : 0;
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.title}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{s.question_count}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{s.response_count}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{s.response_count > 0 ? `${rate}%` : "—"}</td>
                    <td className="px-3 py-3 text-center">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(s.id)} title="Edit" className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openResults(s.id)} title="Results" className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <BarChart2 className="w-3.5 h-3.5" />
                        </button>
                        {s.is_active ? (
                          <button onClick={() => deactivate(s.id)} title="Deactivate" className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => activate(s.id)} title="Activate" className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => deleteSurvey(s.id, s.title)} title="Delete" className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Render: Editor ───────────────────────────────────────────────────────────

  const renderEditor = () => {
    if (!draft) return null;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{draft.id ? "Edit Survey" : "New Survey"}</h1>
        </div>

        {/* Survey details */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Survey Title *</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Customer Satisfaction Survey"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description (optional)</label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Brief description shown to customers"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F] resize-none"
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Questions ({draft.questions.length})</h2>
          </div>

          {draft.questions.length === 0 && (
            <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
              No questions yet. Click "Add Question" below.
            </div>
          )}

          {draft.questions.map((q, idx) => (
            <div key={q._key} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-xs font-mono text-muted-foreground mt-2 w-5 flex-shrink-0">{idx + 1}.</span>
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={q.question_text}
                    onChange={(e) => updateQuestion(q._key, { question_text: e.target.value })}
                    placeholder="Question text"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F]"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-muted-foreground">Type:</label>
                    {(["rating", "multiple_choice", "free_text"] as QuestionType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateQuestion(q._key, { question_type: t })}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          q.question_type === t
                            ? "bg-[#0F510F] text-white border-[#0F510F]"
                            : "border-border text-muted-foreground hover:border-[#0F510F]"
                        }`}
                      >
                        {t === "rating" ? "Rating (1–5)" : t === "multiple_choice" ? "Multiple Choice" : "Free Text"}
                      </button>
                    ))}
                  </div>

                  {q.question_type === "multiple_choice" && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q._key, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F]"
                          />
                          <button onClick={() => removeOption(q._key, oi)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(q._key)}
                        className="text-xs text-[#0F510F] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add option
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveQuestion(q._key, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveQuestion(q._key, 1)} disabled={idx === draft.questions.length - 1} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeQuestion(q._key)} className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#0F510F]/30 text-[#0F510F] rounded-xl py-3 text-sm font-medium hover:border-[#0F510F]/60 hover:bg-[#0F510F]/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}

        <div className="flex gap-3 pb-8">
          <button
            onClick={() => setView("list")}
            className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveDraft}
            disabled={saving || !draft.title.trim()}
            className="flex-1 bg-[#0F510F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d4510] disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save Survey"}
          </button>
        </div>
      </div>
    );
  };

  // ── Render: Results ──────────────────────────────────────────────────────────

  const renderResults = () => (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => setView("list")} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {results ? `Results: ${results.survey.title}` : "Results"}
        </h1>
      </div>

      {resultsLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-4 border-[#0F510F]/20 border-t-[#0F510F] rounded-full animate-spin" />
        </div>
      )}

      {results && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sent", value: results.totalSent },
              { label: "Submitted", value: results.totalSubmitted },
              { label: "Response Rate", value: `${results.responseRate}%` },
            ].map((c) => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Per-question breakdown */}
          {results.questions.map((q: any, idx: number) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">
                <span className="text-[#0F510F] mr-1">{idx + 1}.</span>
                {q.question_text}
              </p>

              {q.question_type === "rating" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Average: <span className="text-foreground font-semibold text-base">{q.avgRating ?? "—"}</span> / 5
                  </p>
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count = q.distribution?.[String(n)] ?? 0;
                    const total = Object.values(q.distribution ?? {}).reduce((a: any, b: any) => a + b, 0) as number;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={n} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-right text-muted-foreground">{n}</span>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[#0F510F] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.question_type === "multiple_choice" && (
                <div className="space-y-2">
                  {Object.entries(q.optionCounts ?? {}).map(([opt, cnt]: [string, any]) => {
                    const total = Object.values(q.optionCounts ?? {}).reduce((a: any, b: any) => a + b, 0) as number;
                    const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                    return (
                      <div key={opt} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{opt}</span>
                          <span>{cnt} ({pct}%)</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[#0F510F]/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.question_type === "free_text" && (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {(q.answers ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No responses yet.</p>
                  ) : (
                    (q.answers as string[]).map((a, i) => (
                      <p key={i} className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2">"{a}"</p>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Per-agent breakdown */}
          {results.agentBreakdown.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40">
                <h3 className="text-sm font-semibold text-foreground">Agent Satisfaction Breakdown</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Agent</th>
                    <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Chats</th>
                    <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.agentBreakdown.map((row) => (
                    <tr key={row.agent}>
                      <td className="px-5 py-3 text-foreground">{row.agent}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{row.chatsHandled}</td>
                      <td className="px-4 py-3 text-center font-semibold text-foreground">{row.avgRating ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="h-14 bg-[#0F510F] text-white flex items-center justify-between px-5 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="WAK Solutions" className="h-[36px] shrink-0" />
          <div className="hidden sm:block">
            <span className="font-semibold text-sm text-white/90">WAK Solutions</span>
            <span className="text-white/40 mx-2">—</span>
            <span className="text-sm text-white/70">Surveys</span>
          </div>
        </div>
        <Link href="/">
          <a className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/10">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Inbox</span>
            <span className="sm:hidden">Back</span>
          </a>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {view === "list" && renderList()}
        {view === "editor" && renderEditor()}
        {view === "results" && renderResults()}
      </main>
    </div>
  );
}
