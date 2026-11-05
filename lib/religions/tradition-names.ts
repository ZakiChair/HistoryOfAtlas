import type { LocalizedName } from '@/lib/types';

// Interface taxonomy only: keep these exact source labels separate from historical prose.
const arabicNames = new Map<string, string>([
  ['African traditional religions', 'الأديان الأفريقية التقليدية'],
  [
    'Ancient Celtic, Germanic, Baltic and Slavic traditions',
    'التقاليد الكلتية والجرمانية والبلطيقية والسلافية القديمة',
  ],
  ['Ancient Egyptian traditions', 'التقاليد المصرية القديمة'],
  ['Ancient local traditions (unclassified)', 'تقاليد محلية قديمة (غير مصنفة)'],
  ['Ancient Near Eastern traditions', 'تقاليد الشرق الأدنى القديم'],
  ['Andean and Inca traditions', 'تقاليد الأنديز والإنكا'],
  ['Bahá’í Faith', 'الديانة البهائية'],
  ['Buddhist syncretic traditions', 'التقاليد التوفيقية البوذية'],
  ['Buddhist traditions', 'التقاليد البوذية'],
  [
    'Chinese popular religion and ancient Chinese cults',
    'الديانة الشعبية الصينية والعبادات الصينية القديمة',
  ],
  ['Christian syncretic traditions', 'التقاليد التوفيقية المسيحية'],
  ['Christian traditions', 'التقاليد المسيحية'],
  ['Confucian traditions', 'التقاليد الكونفوشية'],
  ['Daoist traditions', 'التقاليد الطاوية'],
  ['East Asian traditions (aggregate)', 'تقاليد شرق آسيا (فئة مجمعة)'],
  ['Greek and Roman traditions', 'التقاليد اليونانية والرومانية'],
  ['Indigenous traditions (aggregate)', 'تقاليد الشعوب الأصلية (فئة مجمعة)'],
  ['Indigenous traditions of Asia and Oceania', 'تقاليد الشعوب الأصلية في آسيا وأوقيانوسيا'],
  ['Indigenous traditions of the Americas', 'تقاليد الشعوب الأصلية في الأمريكتين'],
  ['Islam', 'الإسلام'],
  ['Jainism', 'الجاينية'],
  ['Judaism', 'اليهودية'],
  ['Kami worship and Shinto', 'عبادة الكامي والشنتو'],
  ['Mandaeism', 'المندائية'],
  ['Manichaeism', 'المانوية'],
  ['Mesoamerican traditions', 'تقاليد ميسوأمريكا'],
  ['Mesopotamian traditions', 'تقاليد بلاد الرافدين'],
  ['New religious movements (aggregate)', 'حركات دينية جديدة (فئة مجمعة)'],
  ['New religious movements (RCS aggregate)', 'حركات دينية جديدة (فئة مجمعة في RCS)'],
  ['Old Norse traditions', 'التقاليد النوردية القديمة'],
  ['Other unclassified religions', 'أديان أخرى غير مصنفة'],
  ['Religiously unaffiliated', 'غير المنتمين دينيًا'],
  ['Religiously unaffiliated or secular state', 'غير المنتمين دينيًا أو دولة علمانية'],
  ['Sikhism', 'السيخية'],
  ['Tengrism and steppe shamanism', 'التنغرية وشامانية السهوب'],
  ['Traditional Ethiopian religions', 'الأديان الإثيوبية التقليدية'],
  ['Traditions classified as Muslim syncretic by RCS', 'تقاليد يصنفها RCS بوصفها توفيقية إسلامية'],
  ['Vedic and Hindu traditions', 'التقاليد الفيدية والهندوسية'],
  ['Yoruba / Òrìṣà traditions and diasporas', 'تقاليد اليوروبا / الأوريشا وجالياتها في الشتات'],
  ['Zoroastrianism', 'الزرادشتية'],
  ['Zoroastrianism and ancient Iranian religions', 'الزرادشتية والديانات الإيرانية القديمة'],
]);

/** Adds a known interface category translation without changing source-provided names. */
export function religionTraditionNames(names: LocalizedName): LocalizedName {
  if (names.ar !== undefined) return names;
  const ar = arabicNames.get(names.en);
  return ar === undefined ? names : { ...names, ar };
}
