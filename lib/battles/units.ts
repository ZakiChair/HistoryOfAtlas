/**
 * Render assets and eligibility, not orders of battle.
 * Battle-specific assignments live in data/curated/battle-profiles.json.
 * Neither a continent nor a modern nation's identity establishes historical equipment.
 */
export type BattleMedium = 'land' | 'naval' | 'air';
export type UnitRole =
  'infantry' | 'ranged' | 'cavalry' | 'chariot' | 'artillery' | 'tank' | 'ship' | 'aircraft';
export type UnitProfile = {
  id: string;
  label: string;
  role: UnitRole;
  medium: BattleMedium;
  modelUrl: string;
  heightMeters: number;
  spanMeters: number;
  forwardAxis: 'z';
  animations: { march: 'March'; engage: 'Engage' };
  dateRange: readonly [number, number];
  polityIds?: readonly string[];
  /** Seasonal, campaign or ship-family variants require a reviewed event assignment. */
  explicitOnly?: boolean;
  sources: readonly { label: string; url: string }[];
};

const SOURCE = {
  prussian1870Helmet: {
    label:
      'Musée Bonaparte, Auxonne / POP · Leather and brass infantry helmet 2010.0.72, captured from the 34th Pomeranian Fusiliers in November 1870',
    url: 'https://pop.culture.gouv.fr/notice/joconde/01320016844',
  },
  prussian1870Dreyse: {
    label:
      'Musée de la Bataille du 6 août 1870, Woerth · Dreyse M1862 BATW.1987.1.1: 1.355 m needle rifle, three bands and straight bolt handle',
    url: 'https://www.museesgrandest.org/les-collections/fusil-dreyse-modele-1862/',
  },
  prussian1870Dress: {
    label:
      'Paris Musées / Carnavalet · G. Richard campaign-uniform print, Guerre 1870–1871 series: blue-coated line soldier, grey trousers and light leather equipment; dress varies within the same print',
    url: 'https://parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/tenue-de-campagne-des-armees-prusiennes-badoise-bavaroise',
  },
  french1870Dress: {
    label:
      'Musée Guerre et Paix en Ardennes · Sequence 2: French infantry dress in 1870, blue-grey capote, garance trousers and kepi',
    url: 'https://www.guerreetpaix.fr/sequence-2',
  },
  french1870Kepi: {
    label:
      'Musée de l’Armée · Second Empire uniform panel: surviving 28th Infantry kepi and trousers; NCO rank details excluded',
    url: 'https://www.musee-armee.fr/fileadmin/user_upload/Documents/Support-panneaux-jeune/NAPIII_PanneauxJeunes-uniforme_BAT.pdf',
  },
  french1870Chassepot: {
    label:
      'Musée de l’Armée · Chassepot M1866, M2765: single-shot action and sabre bayonet, service in 1870–1871',
    url: 'https://www.musee-armee.fr/fileadmin/user_upload/Documents/Support-Visite-Fiches-Objets/Fiches-1815-1870/MA_fiche-chassepot.pdf',
  },
  french1870CampaignPrint: {
    label:
      'Paris Musées / Carnavalet · Draner, Line infantry, marching regiment (1871): campaign silhouette corroboration, not an 1870 object date',
    url: 'https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/les-soldats-de-la-republique-3-infanterie-de-ligne-regiment-de-marche',
  },
  mexicanWarDress: {
    label:
      'National Park Service · A Thunder of Cannon, chapter 4: Mexican dress variation and India Pattern musket',
    url: 'https://npshistory.com/series/archeology/scrc/52/chap4.htm',
  },
  mexicanShakoPeriod: {
    label:
      'National Park Service · A Thunder of Cannon, appendix C: cylindrical shako after 1839 and mixed clothing issues',
    url: 'https://npshistory.com/series/archeology/scrc/52/appc.htm',
  },
  mexicanBrownBess: {
    label:
      'National Park Service · Lock, Stock, and Barrel: Mexican Brown Bess flintlock and photographed action',
    url: 'https://www.nps.gov/paal/learn/historyculture/lock-stock-barrel.htm',
  },
  mexicanDressBoundary: {
    label:
      'Secretaría de Marina · Historia de la Infantería de Marina, chapter 3, p.151: 7 January 1848 dress order',
    url: 'https://www.semar.gob.mx/unhicun/publicaciones_historicas/serie_unhicun/historia_infanteria/historia_infanteria5.pdf',
  },
  cornwallRefit: {
    label: 'Royal Museums Greenwich · Cornwall as-fitted profile NPA9348, 31 December 1937 refit',
    url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-53306',
  },
  cornwallPhotograph: {
    label:
      'Royal Museums Greenwich · Cornwall broadside photograph N8274, 1938; post-refit family analogy',
    url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-1018357',
  },
  cornwallAction: {
    label: 'Australian War Memorial · 128072, Cornwall sank Pinguin on 8 May 1941',
    url: 'https://www.awm.gov.au/collection/C48238',
  },
  carrierCoralSea: {
    label:
      'US Naval Historical Center / NARA · Lexington 80-G-16569 and Shokaku 80-G-17031, 8 May 1942',
    url: 'https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/events/wwii-pac/coralsea/coralsea.htm',
  },
  carrierYorktown: {
    label: 'NHHC / NARA · Yorktown CV-5, 80-G-21627, 4 June 1942; straight flight deck and island',
    url: 'https://www.history.navy.mil/our-collections/photography/wars-and-events/world-war-ii/midway/80-G-21627.html',
  },
  russianWinterDress: {
    label:
      'US War Department · Military Observers in Manchuria, Part II (1906), pp.18–19: greatcoat, papakha and winter boots',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/DTIC_ADA438108._Reports_of_Military_Observers_Attached_to_the_Armies_in_Manchuria_during_the_Russo-Japanese_War._Part_2.pdf',
  },
  russianWinterPhotograph: {
    label:
      'J. H. Hare (ed.), photographic record (1905), p.238: Russian greatcoats and fur caps after Port Arthur',
    url: 'https://www.gutenberg.org/files/76109/76109-h/76109-h.htm#Page_238',
  },
  russianMosin1891: {
    label:
      'Royal Armouries · Model 1891 Mosin-Nagant, about 1900, object 34129; full-length infantry rifle',
    url: 'https://royalarmouries.org/objects-and-stories/stories/arms-of-the-first-world-war',
  },
  russianMosinBayonet: {
    label:
      'Tula State Museum of Weapons · Model 1891 and four-sided socket bayonet; Russo-Japanese War manufacture',
    url: 'https://heroes-arms.ru/en/mosin.html',
  },
  russianMosinContext: {
    label: 'National Army Museum · Mosin-Nagant M1891 used extensively in the Russo-Japanese War',
    url: 'https://collection.nam.ac.uk/detail.php?acc=1992-08-177-1',
  },
  japaneseWarCap: {
    label: 'Hokkaido Museum · military cap 014751, worn during the Russo-Japanese War',
    url: 'https://jmapps.ne.jp/hmcollection1/det.html?data_id=898',
  },
  japaneseWinterDress: {
    label:
      'US War Department · Military Observers in Manchuria, Part II (1906), pp.19, 201: winter dress and knife bayonet',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/DTIC_ADA438108._Reports_of_Military_Observers_Attached_to_the_Armies_in_Manchuria_during_the_Russo-Japanese_War._Part_2.pdf',
  },
  japaneseType30: {
    label: 'Smithsonian NMAH · Japanese Type 30 bolt-action rifle, AF.30000, 128.27 cm',
    url: 'https://americanhistory.si.edu/collections/object/nmah_414508',
  },
  japaneseRifleImage: {
    label: 'Armémuseum · Type 30 rifle INV 32458 (museum photograph reproduction)',
    url: 'https://commons.wikimedia.org/wiki/File:30_rifle.png',
  },
  japaneseRifleContext: {
    label: 'Nagoya Sword Museum · Type 30 as the principal rifle in the Russo-Japanese War',
    url: 'https://www.meihaku.jp/arquebus-basic/',
  },
  japaneseBayonet: {
    label: 'War Memorial of Korea · Type 30 bayonet, 1897 design, 400 mm knife blade',
    url: 'https://artsandculture.google.com/asset/type-30-japanese-military-bayonet/mAGTGex6f6hFMg?hl=en',
  },
  japaneseWinterPhotograph: {
    label:
      'Syracuse University Art Museum · Japanese infantry in winter trenches, c.1905, 2001.0073',
    url: 'https://onlinecollections.syr.edu/objects/36761/jap-soldiers-in-the-trenches-on-the-shahomidwinter-fight',
  },
  japaneseBayonetPhotograph: {
    label:
      'Takashima Nobuyoshi · Japanese Army and Navy photographic album (July 1903), bayonet drill',
    url: 'https://commons.wikimedia.org/wiki/File:Type30bayonetcombat.jpg',
  },
  japaneseWarPhotograph: {
    label:
      'Library of Congress · J. H. Hare, Japanese infantry leaving Tokyo, 1904, LCCN 2005679338',
    url: 'https://www.loc.gov/pictures/item/2005679338/',
  },
  austrianUniform: {
    label: 'HGM · Albertina manuscript (1762), contemporary imperial army uniforms',
    url: 'https://www.hgm.at/fileadmin/hgm/2024_2025/HGM/pdf/2025/HGM_Presseaussendung_J%C3%A4nner_2025_21012025.pdf',
  },
  austrianLignePortrait: {
    label: 'HGM · Ligne infantry, Albertina manuscript 1762 (public-domain reproduction)',
    url: 'https://commons.wikimedia.org/wiki/File:Kaiserliches_Infanterieregiment_No._38_Albertina-Handschrift_1762.jpg',
  },
  austrianWhiteCoat: {
    label: 'UNamur · Walloon regiments in Austrian service during the Seven Years War',
    url: 'https://neptun.unamur.be/s/expo-wallons/page/regiment',
  },
  austrianHeadwearChange: {
    label: 'UNamur · 1767 Kaskett and shorter coat replace the tricorne and earlier coat',
    url: 'https://neptun.unamur.be/s/expo-wallons/page/uniforme',
  },
  austrianFlintlock: {
    label:
      'Austrian Ministry of Defence · Hessenspiegel 2/2019, p.22, M1754 flintlock and socket bayonet',
    url: 'https://www.bundesheer.at/sk/lask/brigaden/pzgrenbrig4/baon/pdf/hessenspiegel_0219.pdf',
  },
  austrianMusketObject: {
    label: 'VHÚ Praha · Vzhuru ku Praze (2024), p.6, surviving Austrian M1722/30 flintlock',
    url: 'https://www.vhu.cz/wp-content/uploads/2024/07/Vzhuru-ku-Praze-BROZURA.pdf',
  },
  byzantineInfantry: {
    label: 'Procopius · Wars VIII.29, spear-and-shield infantry (UChicago text)',
    url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Procopius/Wars/8I%2A.html',
  },
  byzantineHelmet: {
    label:
      'The Met · Spangenhelm 42.50.1, sixth–seventh century; attribution Byzantine or Germanic',
    url: 'https://www.metmuseum.org/art/collection/search/24685',
  },
  byzantineEquipment: {
    label:
      'M. Caprioli · Eastern Roman military equipment (2025), archaeology and Strategikon XII.B.4–5',
    url: 'https://www.nam-sism.org/Articoli/Articoli%202025/NAM%20N.%2021.%202.%20CAPRIOLI%20Eastern%20Roman%20military%20equipment.pdf',
  },
  tercio: {
    label:
      'Spanish Army Historical Military Library · Los Tercios Españoles, equipment and 1633 engraving',
    url: 'https://ejercito.defensa.gob.es/unidades/Madrid/ihycm/Bibliotecas/biblioteca-ceuta-fotos/expovirtual-tercios.pdf',
  },
  civilWarPike: {
    label:
      'National Army Museum · Pikeman armour, c.1640, pot helmet, cuirass, tassets and five-metre pike',
    url: 'https://collection.nam.ac.uk/detail.php?acc=1996-07-279-3',
  },
  civilWarSword: {
    label: 'National Army Museum · Pikeman sword, c.1640, produced for both Civil War sides',
    url: 'https://collection.nam.ac.uk/detail.php?acc=1964-08-34-5',
  },
  britishCivilWars: {
    label: 'National Army Museum · British Civil Wars, 1642–1651',
    url: 'https://www.nam.ac.uk/explore/british-civil-wars',
  },
  greek: {
    label: 'The Met · Warfare in Ancient Greece',
    url: 'https://www.metmuseum.org/essays/warfare-in-ancient-greece',
  },
  roman: {
    label: 'British Museum · Legion collection guide',
    url: 'https://www.britishmuseum.org/exhibitions/legion-life-roman-army/large-print-guide',
  },
  han: {
    label: 'Henan Museum · Han crossbow mechanism',
    url: 'https://english.chnmus.net/en/collection/details.html?id=418119599454061502',
  },
  medieval: {
    label: 'English Heritage · Weaponry of 1066',
    url: 'https://www.english-heritage.org.uk/learn/histories/1066-and-the-norman-conquest/the-weaponry-of-1066/',
  },
  lamellar: {
    label: 'The Met · Lamellar shoulder defences',
    url: 'https://www.metmuseum.org/art/collection/search/788894',
  },
  japan: {
    label: 'The Met · Matchlock of Horio Yoshiharu',
    url: 'https://www.metmuseum.org/art/collection/search/22492',
  },
  waterloo: {
    label: 'National Army Museum · Waterloo',
    url: 'https://www.nam.ac.uk/explore/battle-waterloo',
  },
  frenchVolunteers: {
    label:
      'Musée Carnavalet · Lesueur, Joyeux départ des volontaires aux armées, 1792–1793, D.9065',
    url: 'https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/joyeux-depart-des-volontaires-aux-armees',
  },
  frenchFlintlock: {
    label: 'Musée de l’Armée · Fusil modèle 1777, M 459; Revolutionary and Imperial service',
    url: 'https://www.musee-armee.fr/fileadmin/user_upload/Documents/Support-Visite-Fiches-Objets/Fiches-Louis-XIV-Napo-Bonaparte/MA_fusil-1777.pdf',
  },
  frenchShako: {
    label: 'Musée de l’Armée · French infantry equipment and shako adoption from 1806',
    url: 'https://actualites.musee-armee.fr/evenements/le-campement-de-la-grande-armee-episode-1-sequiper/',
  },
  martiniHenry: {
    label: 'National Army Museum · Martini-Henry Mk II .45-inch rifle, 1876',
    url: 'https://collection.nam.ac.uk/detail.php?acc=1979-07-61-1',
  },
  jenkinsStudy: {
    label:
      'National Army Museum · Lady Butler’s 1879 study of Rorke’s Drift survivor David Jenkins',
    url: 'https://collection.nam.ac.uk/detail.php?acc=1988-10-74-11',
  },
  rorkesDrift: {
    label: 'National Army Museum · Defence of Rorke’s Drift, 1879',
    url: 'https://www.nam.ac.uk/explore/defence-rorkes-drift',
  },
  firearms: {
    label: 'National Park Service · Civil War weapons',
    url: 'https://www.nps.gov/gett/learn/education/classrooms/upload/Pickett-s_Charge_Guide-508.pdf',
  },
  tank: {
    label: 'The Tank Museum · First tanks',
    url: 'https://tankmuseum.org/article/the-first-tanks/',
  },
  industrial: {
    label: 'Imperial War Museums · First World War collection guide',
    url: 'https://www.iwm.org.uk/sites/default/files/files/2023-10/first_world_war_large_print_guide.pdf',
  },
  sail: {
    label: 'Royal Museums Greenwich · Victory, 1765',
    url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-66475',
  },
  steam: {
    label: 'Royal Museums Greenwich · Dreadnought, 1906',
    url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-67323',
  },
  chariot: {
    label: 'British Museum · Neo-Assyrian chariot relief',
    url: 'https://www.britishmuseum.org/collection/object/W_1847-0623-9',
  },
  biplane: {
    label: 'RAF Museum · The RFC, August 1914',
    url: 'https://www.rafmuseum.org.uk/blog/a-few-of-the-first-the-rfc-august-1914/',
  },
  aircraft: {
    label: 'RAF Museum · Spitfire service and development',
    url: 'https://www.rafmuseum.org.uk/blog/the-first-flight-of-the-spitfire/',
  },
  ottoman: {
    label: 'British Museum · Azeb with musket, 1618',
    url: 'https://www.britishmuseum.org/collection/object/W_1974-0617-0-13-24',
  },
  ottomanMauser: {
    label: 'Australian War Memorial · Turkish Mauser Model 1893, WWI service and Gallipoli capture',
    url: 'https://www.awm.gov.au/collection/C2089020',
  },
  ottomanClothCap: {
    label:
      'Australian War Memorial · Soldier’s cloth cap REL/01813, c.1914–1918, collected in Palestine',
    url: 'https://www.awm.gov.au/collection/C104719',
  },
  ottomanInfantryPhotograph: {
    label: 'Australian War Memorial · 125th Infantry Regiment in trenches, c.1915, A02598',
    url: 'https://www.awm.gov.au/collection/A02598',
  },
  ottomanDressVariation: {
    label:
      'Australian War Memorial · Gallipoli prisoners, August 1915, C00636; varied caps and puttees',
    url: 'https://www.awm.gov.au/collection/C00636',
  },
  mughal: {
    label: 'The Met · Islamic Arms and Armor, catalogue entry 116',
    url: 'https://resources.metmuseum.org/resources/metpublications/pdf/Islamic_Arms_and_Armor_in_The_Metropolitan_Museum_of_Art.pdf',
  },
  zulu: {
    label: 'National Army Museum · Zulu War, 1879',
    url: 'https://www.nam.ac.uk/explore/zulu-war',
  },
  jet: {
    label: 'RAF Museum · Me 262',
    url: 'https://www.rafmuseum.org.uk/research/collections/messerschmitt-me-262a-2a-schwalbe-swallow/',
  },
  hundredYears: {
    label: 'Royal Armouries · The Hundred Years’ War, arms and armour',
    url: 'https://royalarmouries.org/objects-and-stories/stories/the-hundred-years-war-1337-1453',
  },
  peninsular: {
    label: 'National Army Museum · Peninsular War, 1808–1814',
    url: 'https://www.nam.ac.uk/explore/peninsular-war',
  },
  sevenYears: {
    label: 'National Army Museum · Seven Years War',
    url: 'https://www.nam.ac.uk/explore/seven-years-war',
  },
  flintlock: {
    label: 'Royal Armouries · Land Pattern flintlock musket',
    url: 'https://royalarmouries.org/objects-and-stories/stories/gendering-the-armouries',
  },
  revolution: {
    label: 'National Park Service · Guilford Courthouse, Continental soldier equipment',
    url: 'https://www.nps.gov/common/uploads/teachers/lessonplans/Accessible%20Section%20508%20format%20American%20Soldiers%20of%20the%20Battle%20of%20Guilford%20Courthouse%20Travel%20Trunk%20Lesson.pdf',
  },
  civilWar: {
    label: 'National Park Service · Civil War weapons in the Shenandoah Valley',
    url: 'https://home.nps.gov/articles/000/civil-war-weapons-in-the-shenandoah-valley.htm',
  },
  westernFront: {
    label: 'National Army Museum · Weapons of the Western Front',
    url: 'https://www.nam.ac.uk/explore/weapons-western-front',
  },
  brodie: {
    label: 'National Army Museum · The Brodie helmet',
    url: 'https://ww1.nam.ac.uk/1904/news/brodie-helmet/',
  },
  plassey: {
    label: 'National Army Museum · Battle of Plassey',
    url: 'https://www.nam.ac.uk/explore/battle-plassey',
  },
  persian: {
    label: 'Herodotus · Histories 7.61, University of Chicago edition',
    url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Herodotus/7b%2A.html#61',
  },
  republican: {
    label: 'Polybius · Histories 6.23, Republican Roman equipment',
    url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/6%2A.html#23',
  },
  carthaginian: {
    label: 'Polybius · Histories 3.114, African infantry in captured Roman arms',
    url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/3%2A.html#114',
  },
  medinetHabu: {
    label: 'UChicago ISAC · Medinet Habu I, naval battle relief, plates 37–39',
    url: 'https://isac.uchicago.edu/publications/medinet-habu-volume-i-earlier-historical-records',
  },
  lakeCanoes: {
    label: 'H. M. Stanley · Through the Dark Continent I, chapter XIII (1875 eyewitness account)',
    url: 'https://www.gutenberg.org/cache/epub/75926/pg75926-images.html#CHAPTER_XIII',
  },
  screwSloop: {
    label: 'US Naval History and Heritage Command · Hartford, screw sloop of war (1859)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/h/hartford.html',
  },
  broadsideIronclad: {
    label: 'Royal Museums Greenwich · contemporary model of Warrior (1860)',
    url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-66046',
  },
  casemate: {
    label: 'US National Park Service · preserved USS Cairo, City-class ironclad (1862)',
    url: 'https://www.nps.gov/places/u-s-s-cairo.htm',
  },
  monitor: {
    label: 'NOAA · USS Monitor, preserved rotating-turret warship (1862)',
    url: 'https://monitor.noaa.gov/shipwrecks/uss_monitor.html',
  },
  paddle: {
    label: 'US Naval History and Heritage Command · Tyler, converted sidewheel steamer (1861)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/t/tyler.html',
  },
  cruiser: {
    label: 'US Naval History and Heritage Command · Baltimore, cruiser (1890)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/b/baltimore-iv.html',
  },
  mikasa: {
    label: 'Mikasa Preservation Society · preserved pre-dreadnought and original statistics (1902)',
    url: 'https://www.kinenkan-mikasa.or.jp/en/mikasa/index.html',
  },
  oregon: {
    label: 'US Naval History and Heritage Command · Oregon, battleship (1896)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/o/oregon-ii.html',
  },
  coastalPaddle: {
    label: 'US Naval History and Heritage Command · Hatteras, sidewheel gunboat (1861–1863)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/h/hatteras-i.html',
  },
  armouredCruiser: {
    label:
      'US Naval History and Heritage Command · Santiago, armoured cruisers and main gun turrets (1898)',
    url: 'https://www.history.navy.mil/about-us/leadership/director/directors-corner/h-grams/h-gram-020/h-020-6-victory-at-santiago-.html',
  },
  russoJapaneseCruisers: {
    label:
      'US Naval Institute · contemporary analysis of Russian and Japanese armoured cruisers (1912)',
    url: 'https://www.usni.org/magazines/proceedings/1912/september-0/control-sea-its-relation-russo-japanese-war',
  },
  boardingCanoe: {
    label:
      'Brazilian Navy · Paraguayan boarding canoes, 1868, Revista Marítima Brasileira pp. 101–104',
    url: 'https://portaldeperiodicos.marinha.mil.br/index.php/revistamaritima/article/download/7510/7048/26360',
  },
  torpedoBoat: {
    label: 'US Naval History and Heritage Command · Foote, torpedo boat (1898)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/f/foote-i.html',
  },
  sparTorpedo: {
    label:
      'Romanian National Naval Museum · surviving spar-torpedo head and Rândunica at Măcin (1877)',
    url: 'https://muzeulmarinei.ro/colectiile-m-n-m-r/',
  },
  auxiliaryCruiser: {
    label: 'US Naval History and Heritage Command · Saint Paul, armed auxiliary cruiser (1898)',
    url: 'https://www.history.navy.mil/research/publications/documentary-histories/united-states-navy-s/blockade-of-puerto-r.html',
  },
  steamTransport: {
    label:
      'Royal Museums Greenwich · contemporary Japanese transport drawing, including Hitachi Maru (1904)',
    url: 'https://www.rmg.co.uk/collections/objects/rmgc-object-101095',
  },
  steamMinelayer: {
    label:
      'US Naval Institute · War at Sea (1908), Russian purpose-built minelayers Amur and Yenisei in 1904',
    url: 'https://www.usni.org/magazines/proceedings/1908/june/war-sea',
  },
  smallGunboat: {
    label: 'US Naval History and Heritage Command · Scorpion, armed two-masted steam yacht (1898)',
    url: 'https://www.history.navy.mil/research/histories/ship-histories/danfs/s/scorpion-iv.html',
  },
  lakeGunboat: {
    label:
      'Italian Navy · Frassineto-class screw gunboats, built 1859 and in action on Lake Garda in 1866',
    url: 'https://www.marina.difesa.it/noi-siamo-la-marina/pilastro-operativo/mezzi/mezzi-storici/Pagine/cannoniere/classe_frassineto.aspx',
  },
  kaiten: {
    label: 'Historical Kaiten illustration reproduced in Captain Koga Gengo’s biography (1933)',
    url: 'https://commons.wikimedia.org/wiki/File:Kaiten_maru.jpg',
  },
} as const;

function asset(
  id: string,
  label: string,
  role: UnitRole,
  dates: readonly [number, number],
  source: keyof typeof SOURCE,
  options: {
    medium?: BattleMedium;
    height?: number;
    span?: number;
    polityIds?: readonly string[];
  } = {},
): UnitProfile {
  return {
    id,
    label,
    role,
    dateRange: dates,
    medium: options.medium ?? 'land',
    modelUrl: `/models/battles/${id}.glb`,
    heightMeters: options.height ?? 1.8,
    spanMeters: options.span ?? 0.8,
    forwardAxis: 'z',
    animations: { march: 'March', engage: 'Engage' },
    ...(options.polityIds ? { polityIds: options.polityIds } : {}),
    sources: [SOURCE[source]],
  };
}

export const UNIT_PROFILES = {
  'byzantine-spearman': {
    ...asset(
      'byzantine-spearman',
      'Early Byzantine spear, large shield and segmented helmet analogy',
      'infantry',
      [530, 650],
      'byzantineInfantry',
    ),
    sources: [SOURCE.byzantineInfantry, SOURCE.byzantineHelmet, SOURCE.byzantineEquipment],
  },
  'tercio-pikeman': asset(
    'tercio-pikeman',
    'Spanish tercio armoured pike component with morion',
    'infantry',
    [1567, 1643],
    'tercio',
    { height: 5.1 },
  ),
  'civil-war-pikeman': {
    ...asset(
      'civil-war-pikeman',
      'British Civil War armoured pike component with pot helmet',
      'infantry',
      [1642, 1651],
      'civilWarPike',
      { height: 5.1 },
    ),
    sources: [SOURCE.civilWarPike, SOURCE.civilWarSword],
  },
  'republican-infantry': asset(
    'republican-infantry',
    'Republican Roman infantry with bronze pectoral',
    'infantry',
    [-220, -150],
    'republican',
  ),
  'carthaginian-african-infantry': {
    ...asset(
      'carthaginian-african-infantry',
      'African infantry in captured Roman equipment at Cannae',
      'infantry',
      [-217, -215],
      'carthaginian',
    ),
    modelUrl: '/models/battles/republican-infantry.glb',
  },
  'persian-spearman': asset(
    'persian-spearman',
    'Achaemenid Persian spear and wicker-shield equipment',
    'infantry',
    [-500, -450],
    'persian',
  ),
  'longbow-archer': asset(
    'longbow-archer',
    'English longbow equipment',
    'ranged',
    [1337, 1453],
    'hundredYears',
  ),
  'medieval-man-at-arms': asset(
    'medieval-man-at-arms',
    'Early fifteenth-century mail and plate equipment',
    'infantry',
    [1400, 1453],
    'hundredYears',
  ),
  'flintlock-infantry': asset(
    'flintlock-infantry',
    'Eighteenth-century flintlock infantry with cocked hat',
    'infantry',
    [1740, 1783],
    'flintlock',
  ),
  'bengal-matchlock': asset(
    'bengal-matchlock',
    'Representative eighteenth-century Indian matchlock equipment',
    'ranged',
    [1700, 1765],
    'mughal',
  ),
  'bengal-sepoy': asset(
    'bengal-sepoy',
    'Representative Company sepoy with flintlock musket',
    'ranged',
    [1757, 1757],
    'plassey',
  ),
  'british-rifle': asset(
    'british-rifle',
    'British rifle infantry with Brodie helmet',
    'infantry',
    [1916, 1918],
    'brodie',
  ),
  'german-rifle': asset(
    'german-rifle',
    'German rifle infantry with steel helmet',
    'infantry',
    [1916, 1918],
    'industrial',
  ),
  'french-rifle': asset(
    'french-rifle',
    'French rifle infantry with Adrian helmet',
    'infantry',
    [1916, 1918],
    'industrial',
  ),
  'unclassified-unit': {
    ...asset(
      'unclassified-unit',
      'Unclassified equipment · plain scale figure',
      'infantry',
      [-10000, 10000],
      'greek',
    ),
    sources: [],
  },
  'ottoman-musketeer': asset(
    'ottoman-musketeer',
    'Representative Ottoman musket equipment, c. 1618',
    'ranged',
    [1600, 1650],
    'ottoman',
    { polityIds: ['Q12560'] },
  ),
  'ottoman-ww1-infantry': {
    ...asset(
      'ottoman-ww1-infantry',
      'Representative Ottoman cloth-cap and Mauser infantry, 1915–1918',
      'infantry',
      [1915, 1918],
      'ottomanMauser',
      { height: 1.9, polityIds: ['Q12560'] },
    ),
    sources: [
      SOURCE.ottomanMauser,
      SOURCE.ottomanClothCap,
      SOURCE.ottomanInfantryPhotograph,
      SOURCE.ottomanDressVariation,
    ],
  },
  'mughal-matchlock': asset(
    'mughal-matchlock',
    'Representative Mughal matchlock equipment',
    'ranged',
    [1600, 1750],
    'mughal',
    { polityIds: ['Q33296'] },
  ),
  'zulu-spearman': asset(
    'zulu-spearman',
    'Representative Zulu shield and spear equipment, 1879',
    'infantry',
    [1879, 1879],
    'zulu',
    { polityIds: ['Q729768'] },
  ),
  'representative-infantry': asset(
    'representative-infantry',
    'Representative spear infantry',
    'infantry',
    [-3500, 1900],
    'greek',
  ),
  'greek-hoplite': asset(
    'greek-hoplite',
    'Greek hoplite equipment',
    'infantry',
    [-700, -300],
    'greek',
    { polityIds: ['Q5690', 'Q1524', 'Q844930', 'Q1418190', 'Q742538'] },
  ),
  'roman-infantry': asset(
    'roman-infantry',
    'Imperial Roman infantry equipment',
    'infantry',
    [1, 300],
    'roman',
    { polityIds: ['Q2277', 'Q1747689'] },
  ),
  'han-crossbow': asset(
    'han-crossbow',
    'Representative Han crossbow equipment',
    'ranged',
    [-206, 220],
    'han',
    { polityIds: ['Q7209'] },
  ),
  'medieval-infantry': asset(
    'medieval-infantry',
    'Mail-clad medieval infantry',
    'infantry',
    [1000, 1400],
    'medieval',
  ),
  'steppe-archer': asset(
    'steppe-archer',
    'Representative mounted archer with lamellar armour',
    'cavalry',
    [1206, 1368],
    'lamellar',
    { height: 2.6, span: 2.2, polityIds: ['Q12557'] },
  ),
  'japanese-matchlock': asset(
    'japanese-matchlock',
    'Japanese matchlock equipment',
    'ranged',
    [1575, 1868],
    'japan',
  ),
  'prussian-line-infantry-1870': {
    ...asset(
      'prussian-line-infantry-1870',
      'Representative Prussian line infantry component with leather spiked helmet and Dreyse',
      'infantry',
      [1870, 1870],
      'prussian1870Dress',
      { height: 1.94, polityIds: ['Q27306'] },
    ),
    explicitOnly: true,
    sources: [SOURCE.prussian1870Helmet, SOURCE.prussian1870Dreyse, SOURCE.prussian1870Dress],
  },
  'french-line-infantry-1870': {
    ...asset(
      'french-line-infantry-1870',
      'Representative French line infantry component with kepi and Chassepot',
      'infantry',
      [1870, 1870],
      'french1870Dress',
      { height: 1.81, polityIds: ['Q71092', 'Q70802'] },
    ),
    explicitOnly: true,
    sources: [
      SOURCE.french1870Dress,
      SOURCE.french1870Kepi,
      SOURCE.french1870Chassepot,
      SOURCE.french1870CampaignPrint,
    ],
  },
  'mexican-war-infantry': {
    ...asset(
      'mexican-war-infantry',
      'Representative Mexican shako and Brown Bess infantry component',
      'infantry',
      [1846, 1847],
      'mexicanWarDress',
      { height: 2.04, polityIds: ['Q96'] },
    ),
    explicitOnly: true,
    sources: [
      SOURCE.mexicanWarDress,
      SOURCE.mexicanShakoPeriod,
      SOURCE.mexicanBrownBess,
      SOURCE.mexicanDressBoundary,
    ],
  },
  'russian-russo-war-winter-infantry': {
    ...asset(
      'russian-russo-war-winter-infantry',
      'Representative Russian Mosin 1891 infantry in winter dress',
      'infantry',
      [1904, 1905],
      'russianMosin1891',
      { height: 1.95, polityIds: ['Q34266'] },
    ),
    explicitOnly: true,
    sources: [
      SOURCE.russianWinterDress,
      SOURCE.russianWinterPhotograph,
      SOURCE.russianMosin1891,
      SOURCE.russianMosinBayonet,
      SOURCE.russianMosinContext,
    ],
  },
  'japanese-russo-war-winter-infantry': {
    ...asset(
      'japanese-russo-war-winter-infantry',
      'Representative Japanese Type 30 infantry in winter dress',
      'infantry',
      [1904, 1905],
      'japaneseType30',
      { height: 1.9, polityIds: ['Q188712'] },
    ),
    explicitOnly: true,
    sources: [
      SOURCE.japaneseWarCap,
      SOURCE.japaneseWinterDress,
      SOURCE.japaneseType30,
      SOURCE.japaneseRifleImage,
      SOURCE.japaneseRifleContext,
      SOURCE.japaneseBayonet,
      SOURCE.japaneseWarPhotograph,
      SOURCE.japaneseWinterPhotograph,
      SOURCE.japaneseBayonetPhotograph,
    ],
  },
  'austrian-seven-years-infantry': {
    ...asset(
      'austrian-seven-years-infantry',
      'Representative Habsburg white-coat and tricorne infantry',
      'infantry',
      [1756, 1763],
      'austrianFlintlock',
      { height: 1.9, polityIds: ['Q153136'] },
    ),
    sources: [
      SOURCE.austrianUniform,
      SOURCE.austrianLignePortrait,
      SOURCE.austrianWhiteCoat,
      SOURCE.austrianHeadwearChange,
      SOURCE.austrianFlintlock,
      SOURCE.austrianMusketObject,
    ],
  },
  'french-revolution-infantry': {
    ...asset(
      'french-revolution-infantry',
      'Representative French cocked-hat and flintlock infantry',
      'infantry',
      [1792, 1803],
      'frenchFlintlock',
      { height: 1.9, polityIds: ['Q58296'] },
    ),
    sources: [SOURCE.frenchVolunteers, SOURCE.frenchFlintlock, SOURCE.frenchShako],
  },
  'french-imperial-cocked-hat': {
    ...asset(
      'french-imperial-cocked-hat',
      'Representative early Imperial French cocked-hat infantry',
      'infantry',
      [1804, 1805],
      'frenchFlintlock',
      { height: 1.9, polityIds: ['Q71084'] },
    ),
    modelUrl: '/models/battles/french-revolution-infantry.glb',
    sources: [SOURCE.frenchFlintlock, SOURCE.frenchShako],
  },
  'napoleonic-infantry': {
    ...asset(
      'napoleonic-infantry',
      'Representative Napoleonic shako-and-musket infantry',
      'infantry',
      [1806, 1820],
      'waterloo',
    ),
    sources: [SOURCE.waterloo, SOURCE.frenchShako],
  },
  // A campaign-specific British component, never a date-only or global polity fallback.
  'british-martini-infantry': {
    ...asset(
      'british-martini-infantry',
      'Representative British infantry in the 1879 Zulu War',
      'infantry',
      [1879, 1879],
      'martiniHenry',
      { height: 1.9 },
    ),
    sources: [SOURCE.martiniHenry, SOURCE.jenkinsStudy, SOURCE.rorkesDrift],
  },
  'musket-infantry': asset(
    'musket-infantry',
    'Representative nineteenth-century long-arm infantry',
    'infantry',
    [1830, 1900],
    'firearms',
  ),
  'modern-rifle': asset(
    'modern-rifle',
    'Representative industrial-era rifle infantry',
    'infantry',
    [1900, 2100],
    'industrial',
  ),
  'cavalry-lancer': asset(
    'cavalry-lancer',
    'Representative armoured lancer',
    'cavalry',
    [1000, 1450],
    'medieval',
    { height: 2.7, span: 2.2 },
  ),
  'field-cannon': asset(
    'field-cannon',
    'Representative muzzle-loading field cannon',
    'artillery',
    [1650, 1870],
    'waterloo',
    { height: 1.3, span: 2.2 },
  ),
  'early-tank': asset('early-tank', 'Early rhomboid tank', 'tank', [1916, 1930], 'tank', {
    height: 1.65,
    span: 3.7,
  }),
  'modern-tank': asset(
    'modern-tank',
    'Representative turreted tank',
    'tank',
    [1930, 2100],
    'industrial',
    { height: 1.8, span: 3.5 },
  ),
  'oared-galley': asset(
    'oared-galley',
    'Representative oared warship',
    'ship',
    [-700, 1700],
    'greek',
    { medium: 'naval', height: 2.9, span: 7.2 },
  ),
  'sailing-warship': asset(
    'sailing-warship',
    'Representative sailing warship',
    'ship',
    [1600, 1860],
    'sail',
    { medium: 'naval', height: 4.4, span: 7.6 },
  ),
  'steam-warship': asset(
    'steam-warship',
    'Representative industrial warship',
    'ship',
    [1906, 2100],
    'steam',
    { medium: 'naval', height: 2.7, span: 7.2 },
  ),
  // These families require sourced assignments; they never enter the date-only fallback.
  'county-kent-heavy-cruiser': {
    ...asset(
      'county-kent-heavy-cruiser',
      'County/Kent heavy cruiser · Cornwall post-refit analogy',
      'ship',
      [1941, 1941],
      'cornwallRefit',
      { medium: 'naval', height: 2.6, span: 8.0, polityIds: ['Q145'] },
    ),
    explicitOnly: true,
    sources: [SOURCE.cornwallRefit, SOURCE.cornwallPhotograph, SOURCE.cornwallAction],
  },
  'ww2-straight-deck-carrier': {
    ...asset(
      'ww2-straight-deck-carrier',
      'Straight-deck aircraft carrier · 1942 family analogy',
      'ship',
      [1942, 1942],
      'carrierCoralSea',
      { medium: 'naval', height: 2.2, span: 8.4, polityIds: ['Q30', 'Q188712'] },
    ),
    explicitOnly: true,
    sources: [SOURCE.carrierCoralSea, SOURCE.carrierYorktown],
  },
  'new-kingdom-oared-ship': asset(
    'new-kingdom-oared-ship',
    'New Kingdom oared vessel with furled sail · Medinet Habu analogy',
    'ship',
    [-1185, -1170],
    'medinetHabu',
    { medium: 'naval', height: 2.5, span: 6.5 },
  ),
  'lake-war-canoe': asset(
    'lake-war-canoe',
    'Paddled Lake Victoria war canoe · 1875 account',
    'ship',
    [1875, 1875],
    'lakeCanoes',
    { medium: 'naval', height: 0.8, span: 6.1 },
  ),
  'steam-corvette': asset(
    'steam-corvette',
    'Nineteenth-century screw sloop or corvette · sail and steam',
    'ship',
    [1859, 1905],
    'screwSloop',
    { medium: 'naval', height: 3.4, span: 6.8 },
  ),
  'ironclad-warship': asset(
    'ironclad-warship',
    'Rigged broadside ironclad · nineteenth-century equipment analogy',
    'ship',
    [1860, 1884],
    'broadsideIronclad',
    { medium: 'naval', height: 3.4, span: 6.8 },
  ),
  'casemate-ironclad': asset(
    'casemate-ironclad',
    'Sloped-casemate river ironclad · City-class analogy',
    'ship',
    [1862, 1865],
    'casemate',
    { medium: 'naval', height: 2.0, span: 6.1 },
  ),
  'monitor-warship': asset(
    'monitor-warship',
    'Low-freeboard monitor with revolving turret',
    'ship',
    [1862, 1905],
    'monitor',
    { medium: 'naval', height: 1.5, span: 6.1 },
  ),
  'paddle-steamer': asset(
    'paddle-steamer',
    'Nineteenth-century sidewheel river steamer',
    'ship',
    [1861, 1868],
    'paddle',
    { medium: 'naval', height: 2.1, span: 6.1 },
  ),
  'protected-cruiser': asset(
    'protected-cruiser',
    'Late nineteenth-century cruiser with shielded deck guns',
    'ship',
    [1890, 1905],
    'cruiser',
    { medium: 'naval', height: 2.8, span: 6.1 },
  ),
  'pre-dreadnought': {
    ...asset(
      'pre-dreadnought',
      'Pre-dreadnought battleship · twin main turrets fore and aft',
      'ship',
      [1896, 1905],
      'mikasa',
      { medium: 'naval', height: 2.7, span: 7.2 },
    ),
    modelUrl: '/models/battles/steam-warship.glb',
    sources: [SOURCE.mikasa, SOURCE.oregon],
  },
  'coastal-paddle-gunboat': asset(
    'coastal-paddle-gunboat',
    'Rigged coastal sidewheel gunboat · Hatteras equipment analogy',
    'ship',
    [1861, 1863],
    'coastalPaddle',
    { medium: 'naval', height: 2.9, span: 6.1 },
  ),
  'armoured-cruiser': {
    ...asset(
      'armoured-cruiser',
      'Armoured cruiser · representative family, not an exact class or gun arrangement',
      'ship',
      [1898, 1904],
      'armouredCruiser',
      { medium: 'naval', height: 2.8, span: 6.1 },
    ),
    sources: [SOURCE.armouredCruiser, SOURCE.russoJapaneseCruisers],
  },
  'river-boarding-canoe': {
    ...asset(
      'river-boarding-canoe',
      'Paddled river boarding canoe · simple hull analogy',
      'ship',
      [1868, 1868],
      'boardingCanoe',
      { medium: 'naval', height: 1, span: 6.1 },
    ),
    modelUrl: '/models/battles/lake-war-canoe.glb',
  },
  'paddle-corvette': {
    ...asset(
      'paddle-corvette',
      'Rigged paddle corvette · propulsion analogy for Kaiten',
      'ship',
      [1869, 1869],
      'kaiten',
      { medium: 'naval', height: 2.9, span: 6.1 },
    ),
    modelUrl: '/models/battles/coastal-paddle-gunboat.glb',
  },
  'torpedo-boat': asset(
    'torpedo-boat',
    'Low steam torpedo boat with deck-mounted tubes',
    'ship',
    [1898, 1898],
    'torpedoBoat',
    { medium: 'naval', height: 1.35, span: 6.1 },
  ),
  'spar-torpedo-launch': asset(
    'spar-torpedo-launch',
    'Steam launch with a forward spar torpedo',
    'ship',
    [1877, 1877],
    'sparTorpedo',
    { medium: 'naval', height: 1.3, span: 7.6 },
  ),
  'auxiliary-cruiser': asset(
    'auxiliary-cruiser',
    'Armed merchant steamer · auxiliary cruiser',
    'ship',
    [1898, 1898],
    'auxiliaryCruiser',
    { medium: 'naval', height: 2.5, span: 6.1 },
  ),
  'steam-transport': asset(
    'steam-transport',
    'Unarmed steam troop transport · merchant hull family',
    'ship',
    [1904, 1904],
    'steamTransport',
    { medium: 'naval', height: 2.5, span: 6.1 },
  ),
  'steam-minelayer': asset(
    'steam-minelayer',
    'Steam minelayer with stern working deck and mine rails',
    'ship',
    [1904, 1904],
    'steamMinelayer',
    { medium: 'naval', height: 2.2, span: 6.1 },
  ),
  'small-steam-gunboat': {
    ...asset(
      'small-steam-gunboat',
      'Small screw gunboat or armed steam yacht · equipment family',
      'ship',
      [1859, 1898],
      'smallGunboat',
      { medium: 'naval', height: 2.2, span: 5.3 },
    ),
    sources: [SOURCE.smallGunboat, SOURCE.lakeGunboat],
  },
  'biplane-aircraft': asset(
    'biplane-aircraft',
    'Representative early fabric biplane',
    'aircraft',
    [1914, 1930],
    'biplane',
    { medium: 'air', height: 1.45, span: 4.6 },
  ),
  'propeller-aircraft': asset(
    'propeller-aircraft',
    'Representative propeller fighter',
    'aircraft',
    [1938, 1960],
    'aircraft',
    { medium: 'air', height: 0.9, span: 4.5 },
  ),
  'jet-aircraft': asset(
    'jet-aircraft',
    'Representative early jet aircraft',
    'aircraft',
    [1944, 2100],
    'jet',
    { medium: 'air', height: 1.0, span: 4.3 },
  ),
  chariot: asset('chariot', 'Representative chariot team', 'chariot', [-900, -600], 'chariot', {
    height: 2.3,
    span: 4.8,
  }),
} as const satisfies Record<string, UnitProfile>;
export type UnitProfileId = keyof typeof UNIT_PROFILES;

/**
 * Sourced visual analogies scoped to identified armies and campaigns. Keeping
 * these windows separate from asset eligibility avoids equipping a polity for
 * its entire lifetime merely because it used the weapon in one period.
 */
export const UNIT_ANALOGIES: readonly {
  profileId: UnitProfileId;
  participantIds: readonly string[];
  dateRange: readonly [number, number];
  sources: readonly { label: string; url: string }[];
}[] = [
  {
    profileId: 'austrian-seven-years-infantry',
    participantIds: ['Q153136'],
    dateRange: [1756, 1763],
    sources: [
      SOURCE.austrianUniform,
      SOURCE.austrianWhiteCoat,
      SOURCE.austrianFlintlock,
      SOURCE.austrianHeadwearChange,
    ],
  },
  {
    profileId: 'french-revolution-infantry',
    participantIds: ['Q58296'],
    dateRange: [1792, 1803],
    sources: [SOURCE.frenchVolunteers, SOURCE.frenchFlintlock, SOURCE.frenchShako],
  },
  {
    profileId: 'french-imperial-cocked-hat',
    participantIds: ['Q71084'],
    dateRange: [1804, 1805],
    sources: [SOURCE.frenchFlintlock, SOURCE.frenchShako],
  },
  {
    profileId: 'ottoman-ww1-infantry',
    participantIds: ['Q12560'],
    dateRange: [1915, 1918],
    sources: [
      SOURCE.ottomanMauser,
      SOURCE.ottomanClothCap,
      SOURCE.ottomanInfantryPhotograph,
      SOURCE.ottomanDressVariation,
    ],
  },
  {
    profileId: 'byzantine-spearman',
    participantIds: ['Q12544'],
    dateRange: [530, 650],
    sources: [SOURCE.byzantineInfantry, SOURCE.byzantineHelmet, SOURCE.byzantineEquipment],
  },
  {
    profileId: 'tercio-pikeman',
    participantIds: ['Q766543'],
    dateRange: [1567, 1643],
    sources: [SOURCE.tercio],
  },
  {
    profileId: 'civil-war-pikeman',
    participantIds: ['Q2284765', 'Q1130553'],
    dateRange: [1642, 1651],
    sources: [SOURCE.civilWarPike, SOURCE.civilWarSword, SOURCE.britishCivilWars],
  },
  {
    profileId: 'republican-infantry',
    participantIds: ['Q17167', 'Q1747689'],
    dateRange: [-220, -150],
    sources: [SOURCE.republican],
  },
  {
    profileId: 'persian-spearman',
    participantIds: ['Q389688'],
    dateRange: [-500, -450],
    sources: [SOURCE.persian],
  },
  {
    profileId: 'japanese-matchlock',
    participantIds: ['Q205662'],
    dateRange: [1603, 1868],
    sources: [SOURCE.japan],
  },
  {
    profileId: 'napoleonic-infantry',
    participantIds: ['Q71084', 'Q174193'],
    dateRange: [1808, 1815],
    sources: [SOURCE.peninsular, SOURCE.waterloo],
  },
  {
    profileId: 'napoleonic-infantry',
    participantIds: ['Q3399982', 'Q45670'],
    dateRange: [1808, 1814],
    sources: [SOURCE.peninsular],
  },
  {
    profileId: 'napoleonic-infantry',
    participantIds: ['Q27306'],
    dateRange: [1815, 1815],
    sources: [SOURCE.waterloo],
  },
  {
    profileId: 'flintlock-infantry',
    participantIds: ['Q161885'],
    dateRange: [1740, 1783],
    sources: [SOURCE.flintlock, SOURCE.sevenYears, SOURCE.revolution],
  },
  {
    profileId: 'flintlock-infantry',
    participantIds: ['Q70972'],
    dateRange: [1754, 1763],
    sources: [SOURCE.sevenYears],
  },
  {
    profileId: 'flintlock-infantry',
    participantIds: ['Q30', 'Q54122'],
    dateRange: [1775, 1783],
    sources: [SOURCE.revolution],
  },
  {
    profileId: 'musket-infantry',
    participantIds: ['Q30', 'Q81931', 'Q1125021'],
    dateRange: [1861, 1865],
    sources: [SOURCE.civilWar],
  },
  {
    profileId: 'british-rifle',
    participantIds: ['Q174193', 'Q145'],
    dateRange: [1916, 1918],
    sources: [SOURCE.westernFront, SOURCE.brodie],
  },
  {
    profileId: 'german-rifle',
    participantIds: ['Q43287'],
    dateRange: [1916, 1918],
    sources: [SOURCE.industrial],
  },
  {
    profileId: 'french-rifle',
    participantIds: ['Q70802', 'Q142'],
    dateRange: [1916, 1918],
    sources: [SOURCE.industrial],
  },
  {
    profileId: 'longbow-archer',
    participantIds: ['Q179876'],
    dateRange: [1337, 1453],
    sources: [SOURCE.hundredYears],
  },
  {
    profileId: 'medieval-man-at-arms',
    participantIds: ['Q70972'],
    dateRange: [1400, 1453],
    sources: [SOURCE.hundredYears],
  },
];

const ALIASES: Record<string, UnitProfileId> = {
  'napoleonic-line': 'napoleonic-infantry',
  'roman-legionary': 'roman-infantry',
  'hellenistic-hoplite': 'greek-hoplite',
  'steppe-horse-archer': 'steppe-archer',
  'modern-infantry': 'modern-rifle',
  'era-infantry': 'representative-infantry',
};

export function getUnitProfile(id: string | undefined): UnitProfile | undefined {
  if (!id) return undefined;
  const key = ALIASES[id] ?? id;
  return Object.hasOwn(UNIT_PROFILES, key) ? UNIT_PROFILES[key as UnitProfileId] : undefined;
}

export type ResolvedUnitProfile = UnitProfile & {
  /** A documented equipment analogy never establishes its share of an actual army. */
  evidence: 'documented-profile' | 'representative';
  /** False means the atlas marker remains; no unsuitable 3D substitute should load. */
  dateCompatible: boolean;
};

export function resolveUnitProfile({
  profileId,
  participantId,
  equipmentPolityId,
  year,
  medium,
}: {
  profileId?: string;
  participantId?: string;
  /** Source-reviewed identity of a scoped military unit; only supports an explicit equipment choice. */
  equipmentPolityId?: string;
  year: number;
  medium: BattleMedium;
}): ResolvedUnitProfile {
  const explicit = getUnitProfile(profileId);
  if (
    explicit &&
    explicit.medium === medium &&
    year >= explicit.dateRange[0] &&
    year <= explicit.dateRange[1] &&
    (!explicit.polityIds ||
      (participantId !== undefined && explicit.polityIds.includes(participantId)) ||
      (equipmentPolityId !== undefined && explicit.polityIds.includes(equipmentPolityId)))
  ) {
    return {
      ...explicit,
      evidence: explicit.sources.length ? 'documented-profile' : 'representative',
      dateCompatible: true,
    };
  }
  // Polity matching selects a reviewed analogy, never a verified order of battle.
  if (participantId) {
    const analogy = UNIT_ANALOGIES.find((rule) => {
      const profile: UnitProfile = UNIT_PROFILES[rule.profileId];
      return (
        !profile.explicitOnly &&
        rule.participantIds.includes(participantId) &&
        profile.medium === medium &&
        year >= rule.dateRange[0] &&
        year <= rule.dateRange[1] &&
        year >= profile.dateRange[0] &&
        year <= profile.dateRange[1]
      );
    });
    if (analogy) {
      const profile = UNIT_PROFILES[analogy.profileId];
      return {
        ...profile,
        sources: [...profile.sources, ...analogy.sources].filter(
          (source, index, sources) =>
            sources.findIndex((candidate) => candidate.url === source.url) === index,
        ),
        evidence: 'representative',
        dateCompatible: true,
      };
    }
    const matching = Object.values(UNIT_PROFILES).find(
      (profile: UnitProfile) =>
        !profile.explicitOnly &&
        profile.medium === medium &&
        year >= profile.dateRange[0] &&
        year <= profile.dateRange[1] &&
        profile.polityIds?.includes(participantId),
    );
    if (matching) return { ...matching, evidence: 'representative', dateCompatible: true };
  }
  // Land equipment cannot be inferred from century or continent alone. A plain
  // unarmed figure honestly preserves the formation while leaving equipment unknown.
  if (medium === 'land') {
    return {
      ...UNIT_PROFILES['unclassified-unit'],
      evidence: 'representative',
      dateCompatible: Number.isFinite(year),
    };
  }
  // Naval/air silhouettes are technology analogies with hard lower/upper gates.
  const candidates: UnitProfileId[] =
    medium === 'naval'
      ? ['steam-warship', 'sailing-warship', 'oared-galley']
      : ['jet-aircraft', 'propeller-aircraft', 'biplane-aircraft'];
  const compatible = candidates
    .map((id) => UNIT_PROFILES[id])
    .find(
      (profile) =>
        Number.isFinite(year) && year >= profile.dateRange[0] && year <= profile.dateRange[1],
    );
  if (compatible) return { ...compatible, evidence: 'representative', dateCompatible: true };
  return {
    ...UNIT_PROFILES['unclassified-unit'],
    medium,
    evidence: 'representative',
    dateCompatible: false,
  };
}
