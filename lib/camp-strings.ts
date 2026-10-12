"use client"
import { useTranslate } from "@/lib/language-context"

type Dict = Record<string, string>
const en: Dict = {
  liveNow: "Live now", dayOf: "Day {a} of {b}", startsIn: "Starts in {n} days", startsTomorrow: "Starts tomorrow", finished: "Finished",
  openCamp: "Open camp", search: "Search a camp or place", season: "Season", allYears: "All years",
  reportsOf: "{a} of {b} reports in", reportsN: "{a} report(s)", noReport: "No report yet", noSquad: "No squad yet", sessionsN: "{n} sessions",
  nextCamp: "Next camp", lastCamp: "Latest camp",
  attendance: "Attendance", tapDot: "Tap a dot to mark present or absent", addSessions: "Add sessions and called-up players to take attendance",
  player: "Player", rate: "Rate", reportsInShort: "Reports in", print: "Print", reports: "Reports", calledUp: "Called-up squad",
  noReportYet: "No report yet", campReport: "Camp report", open: "Open", remove: "Remove", reportBy: "Report by",
  campReportNoName: "Camp report (no name)", dropPdf: "Drop a PDF report here or click to choose", uploading: "Uploading…",
  tipStaff: "Tip: add the camp's staff first to attribute each report to a staff member.", waiting: "waiting for report", upload: "Upload",
  reportAdded: "Report added", pdfOnly: "Please choose a PDF file", photosFailed: "{n} photo(s) could not be uploaded",
  importBtn: "Drop the call-up PDF here or click to choose", reading: "Reading PDF…", readFail: "Could not read the PDF",
  importOk: "Read {l} lines. Added {p} players and {s} staff. Press Save to keep them.",
  importNone: "Read {l} lines from the PDF but no name matched a member card. Names in the PDF must match the names on the cards.",
  firstLines: "First lines read:", notFound: "Not found in your members ({n}):",
}
const fr: Dict = {
  liveNow: "En cours", dayOf: "Jour {a} sur {b}", startsIn: "Commence dans {n} jours", startsTomorrow: "Commence demain", finished: "Terminé",
  openCamp: "Ouvrir le dossier", search: "Rechercher un rassemblement ou un lieu", season: "Saison", allYears: "Toutes les années",
  reportsOf: "{a} rapport(s) sur {b}", reportsN: "{a} rapport(s)", noReport: "Aucun rapport", noSquad: "Pas encore de convocation", sessionsN: "{n} séances",
  nextCamp: "Prochain rassemblement", lastCamp: "Dernier rassemblement",
  attendance: "Présence", tapDot: "Touchez un point pour marquer présent ou absent", addSessions: "Ajoutez des séances et des joueuses convoquées pour faire l'appel",
  player: "Joueuse", rate: "Taux", reportsInShort: "Rapports reçus", print: "Imprimer", reports: "Rapports", calledUp: "Joueuses convoquées",
  noReportYet: "Aucun rapport", campReport: "Rapport du rassemblement", open: "Ouvrir", remove: "Retirer", reportBy: "Rapport de",
  campReportNoName: "Rapport du rassemblement (sans nom)", dropPdf: "Déposez un rapport PDF ici ou cliquez pour choisir", uploading: "Envoi…",
  tipStaff: "Astuce : ajoutez d'abord le staff du rassemblement pour attribuer chaque rapport à un membre.", waiting: "rapport en attente", upload: "Envoyer",
  reportAdded: "Rapport ajouté", pdfOnly: "Choisissez un fichier PDF", photosFailed: "{n} photo(s) n'ont pas pu être envoyées",
  importBtn: "Déposez le PDF des convocations ici ou cliquez pour choisir", reading: "Lecture du PDF…", readFail: "Impossible de lire le PDF",
  importOk: "{l} lignes lues. {p} joueuses et {s} staff ajoutés. Appuyez sur Enregistrer pour les garder.",
  importNone: "{l} lignes lues mais aucun nom ne correspond à une fiche. Les noms du PDF doivent correspondre à ceux des fiches.",
  firstLines: "Premières lignes lues :", notFound: "Introuvables parmi vos membres ({n}) :",
}
const ar: Dict = {
  liveNow: "جارٍ الآن", dayOf: "اليوم {a} من {b}", startsIn: "يبدأ خلال {n} يوم", startsTomorrow: "يبدأ غدًا", finished: "منتهٍ",
  openCamp: "فتح الملف", search: "ابحث عن معسكر أو مكان", season: "الموسم", allYears: "كل السنوات",
  reportsOf: "{a} من {b} تقارير", reportsN: "{a} تقرير", noReport: "لا يوجد تقرير", noSquad: "لا توجد قائمة بعد", sessionsN: "{n} حصص",
  nextCamp: "المعسكر القادم", lastCamp: "آخر معسكر",
  attendance: "الحضور", tapDot: "اضغطي على النقطة لتسجيل الحضور أو الغياب", addSessions: "أضيفي حصصًا ولاعبات مستدعاة لتسجيل الحضور",
  player: "اللاعبة", rate: "النسبة", reportsInShort: "التقارير", print: "طباعة", reports: "التقارير", calledUp: "اللاعبات المستدعاة",
  noReportYet: "لا يوجد تقرير", campReport: "تقرير المعسكر", open: "فتح", remove: "حذف", reportBy: "تقرير من",
  campReportNoName: "تقرير المعسكر (بدون اسم)", dropPdf: "أسقطي تقرير PDF هنا أو اضغطي للاختيار", uploading: "جارٍ الرفع…",
  tipStaff: "نصيحة: أضيفي طاقم المعسكر أولًا لنسب كل تقرير إلى عضو.", waiting: "في انتظار التقرير", upload: "رفع",
  reportAdded: "تمت إضافة التقرير", pdfOnly: "اختاري ملف PDF", photosFailed: "تعذر رفع {n} صورة",
  importBtn: "أسقطي ملف PDF للاستدعاءات هنا أو اضغطي للاختيار", reading: "جارٍ قراءة الملف…", readFail: "تعذرت قراءة الملف",
  importOk: "تمت قراءة {l} سطرًا. أضيفت {p} لاعبات و{s} من الطاقم. اضغطي حفظ للاحتفاظ بهم.",
  importNone: "تمت قراءة {l} سطرًا لكن لا يوجد اسم مطابق لبطاقة. يجب أن تطابق الأسماء بطاقات الأعضاء.",
  firstLines: "أول الأسطر:", notFound: "غير موجودين بين أعضائك ({n}):",
}
const all: Record<string, Dict> = { en, fr, ar }

export function useCS() {
  const { lang } = useTranslate()
  const d = all[lang] || en
  return (key: string, vars?: Record<string, string | number>) => {
    let s = d[key] ?? en[key] ?? key
    if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]))
    return s
  }
}
