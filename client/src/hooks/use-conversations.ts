import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Conversation } from "@shared/schema";

export function useConversations() {
  return useQuery({
    queryKey: [api.conversations.list.path],
    queryFn: async () => {
      const res = await fetch(api.conversations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json() as Promise<Conversation[]>;
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });
}
