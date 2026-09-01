import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import it from "./it.json";
import en from "./en.json";

const savedLang = localStorage.getItem("gexylab_lang") || "it";

i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: "it",
  interpolation: { escapeValue: false },
});

export default i18n;
