import { createContext, useContext, useState, useEffect } from "react";

type Lang = "en" | "ar";

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  toggleLang: () => {},
  isRTL: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem("lang") as Lang) ?? "en";
  });

  useEffect(() => {
    const isRTL = lang === "ar";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    localStorage.setItem("lang", lang);
  }, [lang]);

  const toggleLang = () => setLang(l => (l === "en" ? "ar" : "en"));

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, isRTL: lang === "ar" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
