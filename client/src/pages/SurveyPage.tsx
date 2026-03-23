import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Star, CheckCircle2, AlertCircle } from "lucide-react";

interface Question {
  id: number;
  question_text: string;
  question_type: "rating" | "multiple_choice" | "free_text";
  options: string[] | null;
  order_index: number;
}

interface SurveyData {
  surveyId: number;
  title: string;
  description: string;
  questions: Question[];
}

type AnswerMap = Record<number, { rating?: number; choice?: string; text?: string }>;

export default function SurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "submitted">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch(`/api/survey/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErrorMsg(body.message || "This survey link is no longer valid.");
          setStatus("invalid");
          return;
        }
        const data = await res.json();
        setSurvey(data);
        setStatus("ready");
      })
      .catch(() => {
        setErrorMsg("Unable to load survey. Please try again later.");
        setStatus("invalid");
      });
  }, [token]);

  const setRating = (qid: number, rating: number) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], rating } }));
  const setChoice = (qid: number, choice: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], choice } }));
  const setText = (qid: number, text: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], text } }));

  const handleSubmit = async () => {
    if (!survey) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const payload = survey.questions.map((q) => {
        const a = answers[q.id] ?? {};
        return {
          question_id: q.id,
          answer_rating: q.question_type === "rating" ? (a.rating ?? null) : null,
          answer_choice: q.question_type === "multiple_choice" ? (a.choice ?? null) : null,
          answer_text: q.question_type === "free_text" ? (a.text ?? null) : null,
        };
      });
      const res = await fetch(`/api/survey/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.message || "Failed to submit. Please try again.");
        return;
      }
      setStatus("submitted");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col">
      {/* Header */}
      <header className="bg-[#0F510F] px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white text-xs font-bold">W</span>
        </div>
        <span className="text-white font-semibold text-sm">WAK Solutions</span>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8">
        {status === "loading" && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#0F510F]/20 border-t-[#0F510F] rounded-full animate-spin" />
          </div>
        )}

        {status === "invalid" && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">الرابط غير صالح</p>
            <p className="text-lg font-semibold text-gray-800 mb-4">This survey link is no longer valid.</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
          </div>
        )}

        {status === "submitted" && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <CheckCircle2 className="w-14 h-14 text-[#0F510F] mx-auto mb-5" />
            <p className="text-xl font-bold text-gray-900 mb-2">شكراً على وقتك!</p>
            <p className="text-xl font-bold text-gray-900">Thank you for your feedback!</p>
            <p className="text-sm text-gray-500 mt-4">Your response has been recorded.</p>
          </div>
        )}

        {status === "ready" && survey && (
          <div className="space-y-5">
            {/* Survey header card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h1 className="text-xl font-bold text-[#0F510F] mb-1">{survey.title}</h1>
              {survey.description && (
                <p className="text-sm text-gray-600">{survey.description}</p>
              )}
            </div>

            {/* Questions */}
            {survey.questions.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm font-semibold text-gray-800 mb-4">
                  <span className="text-[#0F510F] mr-1">{idx + 1}.</span>
                  {q.question_text}
                </p>

                {q.question_type === "rating" && (
                  <div className="flex gap-3 justify-center flex-wrap">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const selected = answers[q.id]?.rating === n;
                      return (
                        <button
                          key={n}
                          onClick={() => setRating(q.id, n)}
                          className={`w-12 h-12 rounded-xl text-lg font-bold border-2 transition-all ${
                            selected
                              ? "bg-[#0F510F] border-[#0F510F] text-white scale-105"
                              : "bg-white border-gray-200 text-gray-600 hover:border-[#0F510F] hover:text-[#0F510F]"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.question_type === "multiple_choice" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const selected = answers[q.id]?.choice === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setChoice(q.id, opt)}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                            selected
                              ? "bg-[#0F510F]/10 border-[#0F510F] text-[#0F510F]"
                              : "bg-white border-gray-200 text-gray-700 hover:border-[#0F510F]/50"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border-2 inline-block mr-3 align-middle ${selected ? "bg-[#0F510F] border-[#0F510F]" : "border-gray-300"}`} />
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.question_type === "free_text" && (
                  <textarea
                    rows={3}
                    placeholder="Your answer..."
                    value={answers[q.id]?.text ?? ""}
                    onChange={(e) => setText(q.id, e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-[#0F510F] resize-none"
                  />
                )}
              </div>
            ))}

            {/* Submit */}
            {submitError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {submitError}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-[#0F510F] text-white py-4 rounded-2xl text-base font-semibold hover:bg-[#0d4510] disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : (
                "Submit — إرسال"
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
