import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Video, ExternalLink, CheckCircle2, Clock, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type MeetingStatus = "pending" | "completed";
type Filter = "all" | "upcoming" | "completed";

interface Meeting {
  id: number;
  customer_phone: string;
  agent: string | null;
  meeting_link: string;
  agreed_time: string | null;
  status: MeetingStatus;
  created_at: string;
}

export default function Meetings() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [filter, setFilter] = useState<Filter>("all");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) setLocation("/login");
  }, [isAuthLoading, isAuthenticated, setLocation]);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings?filter=${filter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load meetings");
      setMeetings(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (isAuthenticated) fetchMeetings();
  }, [isAuthenticated, fetchMeetings]);

  const markComplete = async (id: number) => {
    setCompleting(id);
    try {
      const res = await fetch(`/api/meetings/${id}/complete`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update meeting");
      setMeetings((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "completed" } : m))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCompleting(null);
    }
  };

  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header — matches dashboard exactly */}
      <header className="h-14 bg-[#0F510F] text-white flex items-center justify-between px-5 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="WAK Solutions" className="h-[36px] shrink-0" />
          <div className="hidden sm:block">
            <span className="font-semibold text-sm text-white/90">WAK Solutions</span>
            <span className="text-white/40 mx-2">—</span>
            <span className="text-sm text-white/70">Meetings</span>
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

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-[#0F510F]" />
          <h1 className="text-xl font-bold text-foreground">Meetings</h1>
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? "bg-[#0F510F] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-4 border-[#0F510F]/20 border-t-[#0F510F] rounded-full animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Video className="w-10 h-10 opacity-30" />
              <p className="text-sm">No meetings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Customer
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Meeting Link
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Agreed Time
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Agent
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Created
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {meetings.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {m.customer_phone}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={m.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[#0F510F] hover:underline font-mono text-xs"
                        >
                          {m.meeting_link.replace("https://meet.jit.si/", "jit.si/")}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {m.agreed_time ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {m.agreed_time}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Awaiting reply</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.agent ?? <span className="italic text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.status === "completed"
                              ? "bg-[#0F510F]/10 text-[#0F510F]"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {m.status === "completed" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {m.status === "completed" ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.status === "pending" && (
                          <button
                            onClick={() => markComplete(m.id)}
                            disabled={completing === m.id}
                            className="flex items-center gap-1 text-xs font-medium text-[#0F510F] border border-[#0F510F]/30 px-3 py-1 rounded-lg hover:bg-[#0F510F]/5 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {completing === m.id ? (
                              <div className="w-3 h-3 border-2 border-[#0F510F]/30 border-t-[#0F510F] rounded-full animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Mark Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
