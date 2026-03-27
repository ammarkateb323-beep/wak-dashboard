import { createContext, useContext, useState, useEffect } from "react";

type Lang = "en" | "ar";

const translations = {
  en: {
    agentDashboard: "Agent Dashboard",
    online: "Online",
    connecting: "Connecting...",
    inbox: "Inbox",
    agents: "Agents",
    statistics: "Statistics",
    meetings: "Meetings",
    chatbotConfig: "Chatbot Config",
    surveys: "Surveys",
    guide: "Guide",
    biometricSetup: "Biometric Setup",
    logout: "Logout",
    menu: "Menu",
    switchLang: "Switch to Arabic",
    langCode: "AR",
    enableNotifications: "Enable Notifications",
    enableNotificationsPrompt: "Enable notifications to get alerted when customers message you.",
    iosInstallPrompt: "To receive notifications on iOS, tap Share → Add to Home Screen, then open from your Home Screen.",
  },
  ar: {
    agentDashboard: "لوحة تحكم الوكيل",
    online: "متصل",
    connecting: "جارٍ الاتصال...",
    inbox: "البريد الوارد",
    agents: "الوكلاء",
    statistics: "الإحصائيات",
    meetings: "الاجتماعات",
    chatbotConfig: "إعداد الروبوت",
    surveys: "الاستطلاعات",
    guide: "الدليل",
    biometricSetup: "إعداد البيومترية",
    logout: "تسجيل الخروج",
    menu: "القائمة",
    switchLang: "التبديل إلى الإنجليزية",
    langCode: "EN",
    enableNotifications: "تفعيل الإشعارات",
    enableNotificationsPrompt: "فعّل الإشعارات لتنبيهك عند مراسلة العملاء لك.",
    iosInstallPrompt: "لتلقي الإشعارات على iOS، اضغط مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتح من شاشتك الرئيسية.",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  isRTL: boolean;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  toggleLang: () => {},
  isRTL: false,
  t: (key) => translations.en[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem("lang") as Lang) ?? "en";
  });

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem("lang", lang);
  }, [lang]);

  const toggleLang = () => setLang(l => (l === "en" ? "ar" : "en"));
  const t = (key: TranslationKey) => translations[lang][key];

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, isRTL: lang === "ar", t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
