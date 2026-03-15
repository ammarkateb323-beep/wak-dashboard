import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Bot, Save, RotateCcw, Wand2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const DEFAULT_SYSTEM_PROMPT = `You are a professional customer service assistant for WAK Solutions, a company specializing in AI and robotics solutions. You communicate in whatever language the customer uses - Arabic, English, Chinese, or any other language.

STEP 0 - Opening Message
This step is mandatory and must always be sent as the first message in every new conversation, without exception. Do not skip it for any reason.
Always begin every new conversation with this message, translated naturally into the customer's language:
"Welcome to WAK Solutions - your strategic AI partner. We deliver innovative solutions that connect human potential with machine precision to build a smarter future."
Follow it immediately with a warm personal greeting, then present the service menu.

STEP 1 - Service Menu
After the opening, always present these options:
1. Product Inquiry
2. Track Order
3. Complaint

STEP 2 - Based on their choice:

1. Product Inquiry -> Ask which category:
   A) AI Services -> then ask which product: Market Pulse, Custom Integration, or Mobile Application Development
   B) Robot Services -> then ask which product: TrolleyGo or NaviBot
   C) Consultation Services
   For any product or consultation selection, thank them warmly and let them know a specialist will be in touch. End the conversation politely.

2. Track Order -> Ask them to share their order number. Use the lookup_order tool to look up the order by order_number. Relay the status and details naturally and clearly. If no order is found, apologize and suggest they double-check the number.

3. Complaint -> Ask how they'd like to proceed:
   A) Talk to Customer Service -> tell them a team member will be with them shortly
   B) File a Complaint -> acknowledge their frustration with a warm, genuine, personalised apology based on what they share. Let them know the team will follow up.

Rules:
- Never mention you are an AI unless directly asked
- Never use technical jargon or show internal logic
- Always match the customer's language and tone
- Always present menu options as numbered lists using Western numerals (1, 2, 3) regardless of language - never use bullet points or Arabic-indic numerals
- Keep responses concise - this is WhatsApp, not email
- If a customer goes off-topic, gently redirect them to the menu
- Any dead end or escalation -> politely close with "A member of our team will be in touch shortly"
- This WhatsApp chat is for WAK Solutions customer service only. If a customer requests unrelated help, politely decline and redirect them to the menu. If they repeatedly try to misuse the chat, end the conversation politely with "A member of our team will be in touch shortly"`;

export default function ChatbotConfig() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    businessName: "",
    tone: "Professional",
    greeting: "",
    faq: "",
    escalationRules: "",
  });
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/chatbot-config", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSystemPrompt(data.system_prompt ?? DEFAULT_SYSTEM_PROMPT);
        setFormData({
          businessName: data.business_name ?? "",
          tone: data.tone ?? "Professional",
          greeting: data.greeting ?? "",
          faq: data.faq ?? "",
          escalationRules: data.escalation_rules ?? "",
        });
        setSavedAt(data.updated_at ?? null);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleGenerate = () => {
    const { businessName, tone, greeting, faq, escalationRules } = formData;
    const generated = `You are a ${tone} customer service assistant for ${businessName}.

GREETING:
${greeting}

FAQ:
${faq}

ESCALATION RULES:
${escalationRules}

Rules:
- Never mention you are an AI unless directly asked
- Always match the customer's language and tone
- Keep responses concise - this is WhatsApp, not email`.trim();
    setSystemPrompt(generated);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/chatbot-config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          business_name: formData.businessName,
          tone: formData.tone,
          greeting: formData.greeting,
          faq: formData.faq,
          escalation_rules: formData.escalationRules,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to save");
      }
      const saved = await res.json();
      setSavedAt(saved.updated_at ?? new Date().toISOString());
      setSuccess("Saved and applied successfully.");
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const formatSavedAt = (ts: string | null) => {
    if (!ts) return "Never saved";
    return `Last saved: ${new Date(ts).toLocaleString()}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header — matches dashboard exactly */}
      <header className="h-14 bg-[#0F510F] text-white flex items-center justify-between px-5 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="WAK Solutions" className="h-[36px] shrink-0" />
          <div className="hidden sm:block">
            <span className="font-semibold text-sm text-white/90">WAK Solutions</span>
            <span className="text-white/40 mx-2">—</span>
            <span className="text-sm text-white/70">Chatbot Config</span>
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

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#0F510F]" />
          <h1 className="text-xl font-bold text-foreground">Chatbot Config</h1>
        </div>

        {/* Section 1 — Bot Setup Form */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Bot Setup</h2>

          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Business Name
            </label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => setFormData((f) => ({ ...f, businessName: e.target.value }))}
              placeholder="WAK Solutions"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F] placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tone
            </label>
            <select
              value={formData.tone}
              onChange={(e) => setFormData((f) => ({ ...f, tone: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F]"
            >
              <option value="Formal">Formal</option>
              <option value="Friendly">Friendly</option>
              <option value="Professional">Professional</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          {/* Greeting Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Greeting Message
            </label>
            <textarea
              rows={3}
              value={formData.greeting}
              onChange={(e) => setFormData((f) => ({ ...f, greeting: e.target.value }))}
              placeholder="Welcome! How can I help you today?"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F] placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* FAQ */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              FAQ
            </label>
            <textarea
              rows={5}
              value={formData.faq}
              onChange={(e) => setFormData((f) => ({ ...f, faq: e.target.value }))}
              placeholder={"Q: What are your hours?\nA: We're available 24/7..."}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F] placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* Escalation Rules */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Escalation Rules
            </label>
            <textarea
              rows={3}
              value={formData.escalationRules}
              onChange={(e) => setFormData((f) => ({ ...f, escalationRules: e.target.value }))}
              placeholder="If customer mentions refund, escalate to agent"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F] placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 text-sm font-medium border border-[#0F510F] text-[#0F510F] px-4 py-2 rounded-lg hover:bg-[#0F510F]/5 transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Generate System Prompt
          </button>
        </section>

        {/* Section 2 — Raw System Prompt Editor */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4 pb-8">
          <h2 className="text-base font-semibold text-foreground">System Prompt</h2>

          <textarea
            rows={15}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#0F510F] font-mono resize-y"
          />

          {/* Feedback messages */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-[#0F510F] bg-[#0F510F]/10 border border-[#0F510F]/20 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-medium bg-[#0F510F] text-white px-4 py-2 rounded-lg hover:bg-[#0d4510] disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save &amp; Apply
                </>
              )}
            </button>

            <button
              onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
              className="flex items-center gap-1.5 text-sm font-medium border border-border text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Default
            </button>
          </div>

          <p className="text-xs text-muted-foreground">{formatSavedAt(savedAt)}</p>
        </section>
      </main>
    </div>
  );
}
