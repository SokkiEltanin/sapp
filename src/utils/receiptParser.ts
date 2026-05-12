import { ExpenseCategory } from '@/types';

export interface ReceiptProduct {
  name: string;
  quantity: number;
  unitPrice: number;
  finalPrice: number;
  discount?: number;
  discountPercent?: number;
  promotion?: string;
  category: ExpenseCategory;
}

export interface ParsedReceipt {
  storeName?: string;
  date?: string;   // ISO: YYYY-MM-DD
  products: ReceiptProduct[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  raw: string;
}

// ─── Known store brands ───────────────────────────────────────────────────────

const STORE_BRANDS: { pattern: RegExp; name: string }[] = [
  { pattern: /\blidl\b/i,             name: 'Lidl' },
  { pattern: /\bbiedronka\b/i,        name: 'Biedronka' },
  { pattern: /\bkaufland\b/i,         name: 'Kaufland' },
  { pattern: /\bauchan\b/i,           name: 'Auchan' },
  { pattern: /\bcarrefour\b/i,        name: 'Carrefour' },
  { pattern: /\bżabka\b|\bzabka\b/i,  name: 'Żabka' },
  { pattern: /\bnetto\b/i,            name: 'Netto' },
  { pattern: /\bpepco\b/i,            name: 'Pepco' },
  { pattern: /\brossmann?\b/i,        name: 'Rossmann' },
  { pattern: /\bdino\b/i,             name: 'Dino' },
  { pattern: /\bstokrotka\b/i,        name: 'Stokrotka' },
  { pattern: /intermarche\b/i,        name: 'Intermarché' },
  { pattern: /\bpolomarket\b/i,       name: 'Polomarket' },
  { pattern: /\borlen\b/i,            name: 'Orlen' },
  { pattern: /\bbp\b/i,               name: 'BP' },
  { pattern: /\bshell\b/i,            name: 'Shell' },
  { pattern: /mcdonald/i,             name: "McDonald's" },
  { pattern: /\bkfc\b/i,              name: 'KFC' },
  { pattern: /\bsubway\b/i,           name: 'Subway' },
  { pattern: /\baldi\b/i,             name: 'Aldi' },
  { pattern: /\bspar\b/i,             name: 'Spar' },
  { pattern: /\bmakro\b/i,            name: 'Makro' },
  { pattern: /\bselgros\b/i,          name: 'Selgros' },
  { pattern: /\bhebe\b/i,             name: 'Hebe' },
  { pattern: /\bccc\b/i,              name: 'CCC' },
  { pattern: /\bzara\b/i,             name: 'Zara' },
  { pattern: /\breserved\b/i,         name: 'Reserved' },
  { pattern: /\bempik\b/i,            name: 'Empik' },
  { pattern: /\bdecathlon\b/i,        name: 'Decathlon' },
  { pattern: /\bmedia markt\b/i,      name: 'Media Markt' },
  { pattern: /\brtv euro agd\b/i,     name: 'RTV Euro AGD' },
  { pattern: /\bmax electro\b/i,      name: 'Max Electro' },
  { pattern: /\bburger king\b/i,      name: 'Burger King' },
  { pattern: /\bpizza hut\b/i,        name: 'Pizza Hut' },
  { pattern: /\bdomin[o]?'?s\b/i,     name: "Domino's" },
  { pattern: /\bpyszne\b/i,           name: 'Pyszne.pl' },
  { pattern: /\bglovo\b/i,            name: 'Glovo' },
  { pattern: /\bwolt\b/i,             name: 'Wolt' },
  { pattern: /\bstarbucks\b/i,        name: 'Starbucks' },
  { pattern: /\bcosta\b/i,            name: 'Costa Coffee' },
  { pattern: /\bgreen cafe\b/i,       name: 'Green Caffe Nero' },
  { pattern: /\bcinema city\b/i,      name: 'Cinema City' },
  { pattern: /\bmultikino\b/i,        name: 'Multikino' },
  { pattern: /\bhelios\b/i,           name: 'Helios' },
  { pattern: /\bcircle k\b/i,         name: 'Circle K' },
  { pattern: /\blotos\b/i,            name: 'Lotos' },
];

// ─── Category keywords ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  groceries: [
    // ─ nabiał ─
    'mleko', 'mleka', 'mleczko', 'ser ', 'serek', 'masło', 'jaj', 'jajk',
    'jogurt', 'śmietana', 'kefir', 'twaróg', 'twarożek', 'mascarpone',
    'ricotta', 'śmietank', 'maślanka', 'skyr', 'cottage', 'quark',
    'brie', 'camembert', 'gouda', 'edam', 'mozzarella', 'parmezan',
    'feta', 'topiony', 'fromage', 'serek wiej', 'napój mlecz', 'fromage frais',
    'labneh', 'burrata', 'provolone', 'grana padano', 'pecorino',
    'jajca', 'serek homog', 'homogenizow',
    // ─ mięso ─
    'wędlin', 'kiełbas', 'szynka', 'parówk', 'schab', 'polędwic', 'boczek',
    'mielona', 'pasztet', 'salami', 'indyk', 'kurczak', 'łopatk', 'filet',
    'nóżki', 'skrzydełk', 'żeberk', 'kark', 'udziec', 'mostek', 'wątróbk',
    'kaszank', 'krupniok', 'krakowsk', 'kabanos', 'mortadel',
    'prosciutto', 'chorizo', 'boczk', 'golonk', 'karczek', 'flaczk',
    'podgardle', 'smalec', 'słonina', 'karkówk', 'antrykot',
    'gulaszow', 'ragù', 'dziczyzn', 'dzik', 'jagnięcin', 'cielęcin',
    // ─ ryby i owoce morza ─
    'łosoś', 'tuńczyk', 'dorsz', 'makrela', 'śledź', 'anchois', 'krewetk',
    'ryba', 'filety ryb', 'paluszki ryb', 'pstrąg', 'tilapia', 'mintaj',
    'karp', 'sandacz', 'okoń', 'sardynk', 'halibut', 'flądra', 'morszczuk',
    'pangasiu', 'kawior', 'małże', 'kalmary', 'ośmiornic', 'homary',
    'ryba wędzon', 'śledź w śmiet', 'matjas', 'szprotki',
    // ─ warzywa ─
    'pomidor', 'ogórek', 'marchew', 'ziemniak', 'cebula', 'czosnek', 'papryka',
    'sałat', 'szpinak', 'brokuł', 'kapust', 'pietruszk', 'por', 'kalafior',
    'seler', 'buraki', 'rzodkiewk', 'kukurydza', 'fasola', 'groszek',
    'szparagi', 'dynia', 'cukinia', 'bakłażan', 'bataty', 'jarmuż', 'rukola',
    'roszponka', 'mix sałat', 'endywia', 'cykoria', 'botwinka', 'natka',
    'koperek', 'bazylia', 'oregano', 'tymian', 'rozmaryn', 'mięta',
    'szczypiorek', 'nać', 'karczochy', 'brukselk', 'pasternak', 'topinambur',
    'radicchio', 'rukiew', 'pak choi', 'edamame', 'bób', 'fasolka szpar',
    // ─ owoce ─
    'jabłk', 'banan', 'pomarańcz', 'gruszk', 'truskawk', 'malina', 'winogrono',
    'śliwk', 'cytryna', 'mango', 'kiwi', 'ananas', 'arbuz', 'melon',
    'czereśni', 'wiśni', 'morel', 'brzoskwini', 'figi', 'daktyl',
    'borówk', 'jeżyn', 'agrest', 'porzeczk', 'granat', 'papaja', 'awokado',
    'limonka', 'grejpfrut', 'mandarynk', 'klementynk', 'marakuja',
    'lychee', 'kokos', 'liczi', 'pitaya', 'persimmon', 'owoce egzot',
    // ─ pieczywo ─
    'chleb', 'bułk', 'bagietk', 'tost', 'graham', 'orkiszow', 'rustykalna',
    'żytni', 'razow', 'wieloziarnist', 'brioche', 'focaccia', 'ciabatt',
    'croissant', 'rogal', 'drożdżówk', 'pumpernik', 'kajzerek', 'ekler',
    'pączek', 'chałka', 'wafle ryżow', 'wafle kukurydz', 'ryżowe',
    'tortilla pszenn', 'naan', 'pita', 'lawasz', 'baguette',
    'chleb tostow', 'bułka tart', 'sucharki', 'pieczywo chrup',
    // ─ suche / konserwy / przyprawy ─
    'mąka', 'cukier', 'ryż', 'makaron', 'kasza', 'owsiank', 'płatk', 'musli',
    'granola', 'olej', 'oliwa', 'ocet', 'sos sojow', 'ketchup',
    'musztarda', 'majonez', 'pasta pomidor', 'przecier', 'bulion', 'kostka',
    'sól', 'pieprz', 'curry', 'cynamon', 'imbir', 'kurkuma', 'papryczk',
    'ziele angiel', 'liść laurow', 'goździk', 'wanilia', 'proszek do piecz',
    'drożdże', 'skrobia', 'żelatyna', 'miód', 'dżem', 'powidła', 'konfitura',
    'masło orzech', 'nutella', 'kakao', 'budyń', 'kisiel', 'galaretka',
    'ciecierzyc', 'soczewic', 'groch', 'tofu', 'tempeh',
    'konserwa', 'puszka', 'tuńczyk w puszc', 'fasola w puszc',
    'koncentrat pomidor', 'sos do', 'dressing', 'vinaigrette',
    'mak', 'sezam', 'siemię lniane', 'pestki dyni', 'nasiona',
    'amarantus', 'quinoa', 'kuskus', 'bulgur', 'polenta',
    'herbatniki', 'wafle', 'biszkopcik', 'tartaletk', 'ciasto gotow',
    // ─ napoje ─
    'woda', 'woda min', 'woda gazo', 'sok', 'piwo', 'wino', 'cola', 'fanta',
    'sprite', 'pepsi', 'energy', 'herbata', 'kawa', 'napój', 'lemoniada',
    'kombucha', 'smoothie', 'cydr', 'kompot', 'syrop', 'napój owoc',
    'isoton', 'gatorade', 'powerade', 'red bull', 'monster', 'tiger',
    'burn energy', 'wódka', 'whisky', 'rum', 'gin', 'brandy', 'likier',
    'szampan', 'prosecco', 'whiskey', 'tequila', 'bourbon', 'cognac',
    'aperol', 'campari', 'vermouth', 'piwo bezalk', 'piwo kraft',
    'napój gazow', 'woda kokosow', 'mleko roślin', 'napój owsan',
    'napój migdał', 'napój sojow', 'napój ryżow',
    // ─ przekąski ─
    'chipsy', 'paluszk', 'krakersy', 'orzeszk', 'orzech', 'migdał', 'słonecznik',
    'pistacj', 'popcorn', 'prażynk', 'preczel', 'nachos', 'mix orzech',
    'cashew', 'piniowe', 'orzechy laskow', 'wiórki kokos', 'soletti',
    'chrupki', 'puff', 'pufki', 'corn flakes', 'orzeszki ziemne',
    // ─ słodycze ─
    'czekolad', 'cukierek', 'batonik', 'lody', 'wafelek', 'ciastk', 'biszkopty',
    'kinder', 'kitkat', 'chrupki', 'pralinki', 'toffi', 'galaretk',
    'żelki', 'karmel', 'ptasie mleczk', 'michałk', 'krówk', 'chałw',
    'miodownik', 'piernik', 'makowiec', 'sernik', 'browni',
    'snickers', 'twix', 'mars', 'bounty', 'milky way', 'raffaello',
    'ferrero', 'lion', 'oreo', 'lotus', 'delicje', 'prince polo',
    'wawel', 'wedel', 'mieszko', 'milka', 'ritter sport', 'lindt',
    'haribo', 'nimm2', 'mentos', 'tic tac', 'halls', 'ricola',
    'lizak', 'żulek', 'krówki', 'torcik', 'tiramisu', 'muffin', 'donut',
    // ─ chemia gospodarcza / higiena ─
    'szampon', 'mydło', 'pasta do zębów', 'proszek do prania', 'płyn do prania',
    'papier toalet', 'chusteczk', 'zmywak', 'gąbka', 'dezodorant',
    'płyn do płukan', 'zmiękcz', 'czyścik', 'spray', 'odświeżacz',
    'worek na śmiec', 'ściereczk', 'rękawiczki gum', 'płyn do naczyń',
    'tabletki do zmyw', 'kapsułk', 'żel do prania', 'wybielacz',
    'soda oczyszcz', 'pasta bhp', 'wc duck', 'domestos', 'cif', 'ajax',
    'mr muscle', 'vanish', 'calgon', 'persil', 'ariel', 'vizir', 'bold',
    'lenor', 'silan', 'comfort', 'coccolino',
    'szczoteczka', 'nić dentyst', 'płyn do płukania ust', 'wykałaczk',
    'ręcznik papier', 'papier kuch', 'serwetk', 'waciki', 'patyczki',
    'podpaska', 'tampon', 'wkładka', 'pielucha', 'pampers', 'huggies',
    'prezerwatywa', 'krem do rąk', 'krem do twarzy', 'balsam do ciała',
    // ─ sklepy spożywcze ─
    'lidl', 'biedronka', 'kaufland', 'auchan', 'carrefour', 'żabka', 'netto',
    'polomarket', 'stokrotka', 'dino', 'intermarche', 'selgros', 'makro',
    'frisco', 'spar', 'aldi', 'simply market',
  ],
  transport: [
    'paliwo', 'benzyna', 'benzyna pb', 'pb95', 'pb98', 'diesel', 'on ', 'lpg', 'cng',
    'parking', 'autostrada', 'bilet', 'mpk', 'ztm', 'pkp', 'pkm', 'bus',
    'taxi', 'uber', 'bolt', 'orlen', 'bp ', 'shell', 'circle k', 'lotos',
    'via toll', 'mytoll', 'e-toll', 'viamichelin',
    'bilet miesięczn', 'bilet jednorazow', 'doładowanie kart', 'e-bilet',
    'myjnia', 'serwis samoch', 'ogumienie', 'opona', 'filtr olej',
    'olej silnikow', 'hamulce', 'przegląd', 'stacja paliw',
    'flixtrain', 'flixbus', 'polbus', 'intercity', 'pendolino', 'leo express',
    'blablacar', 'freenow', 'itaxi', 'mytaxi',
    'rower miejski', 'nextbike', 'wavelo', 'hulajnoga', 'lime', 'tier',
    'bolt scooter', 'prom', 'lot ', 'ryanair', 'wizz', 'easyjet', 'wizzair',
    'wizz air', 'lot airlines', 'polish airlines', 'karta miejsk',
    'bilet ztm', 'bilet pkp', 'bilet pkm', 'kolej', 'tramwaj',
    'autobus', 'metro', 'szybka kolej', 'skm', 'wkd',
    'parking strzeż', 'parking plac', 'autostrada a1', 'autostrada a2',
    'myviatolls', 'viatoll', 'transponder',
  ],
  entertainment: [
    'kino', 'film', 'netflix', 'spotify', 'gier', 'steam', 'playstation',
    'xbox', 'nintendo', 'koncert', 'teatr', 'muzeum', 'basen', 'siłowni', 'fitness',
    'książk', 'empik', 'zabawk', 'cinema city', 'multikino', 'helios', 'imax',
    'allegro', 'amazon prime', 'youtube premium', 'tidal', 'apple music',
    'deezer', 'hbo max', 'disney plus', 'canal plus', 'player', 'ipla',
    'nc plus', 'polsat box', 'tvn player', 'kinoplex', 'vue',
    'bowling', 'bilard', 'paintball', 'laser', 'kartodrom', 'aquapark',
    'trampoliny', 'escape room', 'zoo', 'aquarium', 'ogród botan',
    'wycieczka', 'wyjazd', 'hotel', 'hostel', 'airbnb', 'booking',
    'wakacje', 'urlop', 'resort',
    'sprzęt sportow', 'rower', 'narty', 'snowboard',
    'tenis', 'squash', 'badminton', 'yoga', 'pilates', 'zumba',
    'siłownia', 'crossfit', 'gym', 'sport', 'bieg',
    'gaming', 'monitor', 'klawiatura', 'myszka', 'słuchawki', 'headset',
    'joystick', 'pad', 'konsola', 'gra pc', 'gra na', 'dlc', 'season pass',
    'album muzycz', 'winyl', 'płyta cd', 'gra planszow', 'puzzle', 'karty do gry',
    'lego', 'figurka', 'model',
    'decathlon', 'go sport', '4f', 'intersport', 'sport sklep',
  ],
  health: [
    'aptek', 'lek ', 'leki', 'tabletk', 'witamin', 'suplement', 'maść', 'syrop',
    'opatrunek', 'plaster', 'aspiryn', 'ibuprofen', 'paracetamol', 'ketonal',
    'termometr', 'ciśnieni', 'test ciąż', 'szczoteczk', 'nić dentyst',
    'apteka gemini', 'doz apteka', 'hebe', 'cefarm', 'cosmedica', 'dbam',
    'kolagen', 'omega 3', 'magnez', 'wapń', 'żelazo', 'cynk', 'kwas foliow',
    'krem do', 'balsam', 'żel pod prysznic', 'płyn micel', 'tonik', 'serum',
    'spf', 'krem na noc', 'olejek', 'hydrożel', 'bandaż', 'opaska',
    'gaza', 'strzykawka', 'glukometr', 'inhalator', 'nebulizator',
    'probiotyk', 'prebiotyk', 'enzym', 'tran', 'dha', 'epa',
    'witamina c', 'witamina d', 'wit. d', 'witamina b', 'wit. b',
    'żeńszeń', 'ashwagandha', 'melatonin', 'valeriana', 'dziurawiec',
    'enterol', 'lakcid', 'nifuroksazyd', 'ibuprom', 'panadol', 'apap',
    'rapidol', 'nurofen', 'pyralgina', 'no-spa', 'duspatalin',
    'lacalut', 'elmex', 'oral-b', 'colgate', 'sensodyne', 'listerine',
    'gaviscon', 'rennie', 'ranigast', 'polpharma', 'zdrovit',
    'rutinoscorbin', 'cevitt', 'troxerutin', 'diosminex',
    'poradnia', 'wizyta lek', 'konsultacj', 'stomatolog', 'dentysta',
    'fizjoter', 'masaż leczn', 'rehabilit', 'badanie krwi', 'morfologi',
    'rtg', 'usg', 'mri', 'tomografi', 'mammografi', 'cytologi',
    'szczepionk', 'szczepienie', 'apteka nocna',
    'drogeria hebe', 'rossmann apteka',
    'prezerwatywy', 'test ciążowy', 'test owulacj', 'pompka do',
  ],
  clothing: [
    'koszulk', 'spodnie', 'sukienk', 'bluza', 'kurtka', 'buty', 'skarpet',
    'bielizna', 'czapk', 'szalik', 'rękawiczk', 'zara', 'h&m', 'hm ',
    'reserved', 'cropp', 'house', 'odzież', 'ubranie',
    'nike', 'adidas', 'puma', 'reebok', 'new balance', 'vans', 'converse',
    'mango', 'stradivarius', 'mohito', 'sinsay', 'medicine', 'levi',
    'wrangler', 'lee ', 'tommy', 'lacoste', 'ralph lauren', 'calvin klein',
    'guess', 'versace', 'armani', 'emporio', 'boss', 'diesel',
    'sneaker', 'trampki', 'sandały', 'sandałk', 'kozaki', 'botki',
    'mokasyn', 't-shirt', 'polo shirt', 'sweter', 'kamizelk', 'płaszcz', 'parka',
    'dres', 'legginsy', 'szorty', 'bokserki', 'figi', 'stanik', 'podkoszulek',
    'rajstopy', 'getry', 'body ', 'kombinezon', 'piżama', 'szlafrok',
    'polar', 'kurtka zimow', 'kurtka pucho', 'wiatrówka', 'softshell',
    'szal', 'czapka', 'beret', 'kapelusz', 'pasek', 'portfel',
    'torba skórz', 'plecak szkoln', 'nerka', 'kuferek',
    'buty sportow', 'buty do bieg', 'halówki', 'korki', 'obuwie',
    'odzież sport', 'koszulka sport', 'spodenki sport',
    'ccc', 'half price', 'deichmann', 'ecco', 'geox', 'skechers', 'clarks',
    'pepco odzież', 'primark', 'tkmaxx', 'sek', 'big star',
  ],
  housing: [
    'czynsz', 'rachun', 'prąd', 'gaz ', 'internet', 'telefon', 'ubezpieczeni',
    'ikea', 'meble', 'farba', 'narzędzi', 'śrub', 'klej', 'taśm',
    'castorama', 'leroy merlin', 'obi ', 'selgros', 'merkury market',
    'czynsz administr', 'opłata za wod', 'opłata za ogrzew', 'wywóz śmiec',
    'czynsz najm', 'spółdzielni', 'wspólnota', 'administracja',
    'garaż', 'antena', 'telewizja kablowa', 'multimedia', 'vectra',
    'upc', 'orange', 't-mobile', 'plus abonament', 'play abonament',
    'sofa', 'szafa', 'komoda', 'regał', 'wieszak', 'lustro', 'ramka',
    'kwiaty donicz', 'ziemia ogrod', 'doniczka', 'lampk', 'poduszka',
    'pościel', 'kołdra', 'podkładk', 'filtr do wod',
    'wiertł', 'kołk', 'gwoździ', 'wkrętk', 'śrubokręt', 'klucz płask',
    'poziomica', 'farba do ścian', 'gips', 'tynk', 'silikon', 'pianka mont',
    'bateria łazienk', 'kran', 'rura', 'złączk', 'wąż ogrodow', 'pompa',
    'żarówka', 'led żarówk', 'bezpiecznik', 'kabel elektr', 'gniazdko',
    'alarm', 'czujnik dymu', 'kamera ip', 'zamek', 'klamka',
    'listwa', 'gniazdko', 'przedłużacz', 'rozgałęźnik',
    'pędzel', 'wałek', 'szpachelk', 'taśma malars', 'folia ochr',
    'drążek', 'hak', 'policz', 'narożnik', 'listwa przypodłog',
    'panele', 'wykładzina', 'dywan', 'chodnik', 'mata',
    'roślina', 'kwiat doniczkow', 'ziemia kwiatow', 'nawóz',
    'sprzęt agd', 'lodówka', 'pralka', 'zmywarka', 'piekarnik',
    'odkurzacz', 'żelazko', 'czajnik', 'toster', 'blender', 'mikser',
    'robot kuchenn', 'multicooker', 'air fryer',
  ],
  subscriptions: [
    'subskrypcj', 'premium', 'abonament', 'miesięczn', 'roczn',
    'microsoft', 'apple subscr', 'google one', 'adobe', 'hbo', 'disney', 'canal',
    'autopay', 'płatność cykliczn', 'opłata miesięczn', 'opłata roczn',
    'netflix', 'spotify', 'youtube premium', 'tidal', 'amazon prime',
    'dropbox', 'icloud', 'onedrive', 'xbox game pass', 'ea play',
    'playstation plus', 'ps plus', 'ps now', 'geforce now', 'luna',
    'crunchyroll', 'funimation', 'mubi', 'paramount plus', 'apple tv plus',
    'linkedin premium', 'notion', 'figma', 'canva pro',
    'antivirus', 'kaspersky', 'norton', 'avg', 'bitdefender',
    'password manager', 'nordvpn', 'expressvpn', 'proton',
    'gpw', 'bossa', 'degiro', 'etoro', 'trading 212',
  ],
  other: [],
};

// ─── Food sub-tags ────────────────────────────────────────────────────────────

const FOOD_TAG_MAP: [string, string[]][] = [
  ['mięso',      [
    'polędwica','schab','szynka','boczek','kiełbas','wędlin','drób','kurczak',
    'indyk','wieprzow','wołow','mielona','pasztet','salami','kabanos','parówk',
    'mortadel','krakowsk','karkówk','golonk','udziec','łopatk','żeberk',
    'prosciutto','chorizo','kaszank','krupniok',
  ]],
  ['nabiał',     [
    'mleko','ser','jogurt','kefir','śmietana','twaróg','jaj','masło','śmietank',
    'maślanka','mascarpone','ricotta','brie','camembert','gouda','edam',
    'mozzarella','parmezan','feta','topiony','skyr','cottage','jajca',
  ]],
  ['ryby',       [
    'łosoś','tuńczyk','dorsz','makrela','śledź','anchois','krewetk','pstrąg',
    'tilapia','mintaj','karp','sardynk','halibut','flądra','morszczuk',
    'pangasiu','kawior','małże','kalmary','szprotki','ryba',
  ]],
  ['warzywa',    [
    'ogórek','pomidor','marchew','ziemniak','cebula','papryka','sałat','kapust',
    'brokuł','szpinak','pietruszk','por','kalafior','seler','buraki','rzodkiewk',
    'kukurydza','fasola','groszek','szparagi','dynia','cukinia','bakłażan',
    'bataty','jarmuż','rukola','botwinka','natka','koperek',
  ]],
  ['owoce',      [
    'jabłk','banan','pomarańcz','gruszk','truskawk','malina','winogrono',
    'śliwk','cytryna','mango','kiwi','ananas','arbuz','melon','czereśni',
    'wiśni','morel','brzoskwini','figi','daktyl','borówk','jeżyn','agrest',
    'porzeczk','granat','papaja','awokado','limonka','grejpfrut',
  ]],
  ['słodycze',   [
    'czekolad','cukierek','batonik','lody','wafelek','ciastk','biszkopty',
    'kinder','kitkat','pralinki','toffi','galaretk','żelki','karmel',
    'ptasie mleczk','michałk','krówk','chałw','miodownik','piernik',
    'snickers','twix','mars','bounty','milky way','raffaello','ferrero',
    'lion','oreo','lotus','delicje','prince polo','wawel','wedel',
    'milka','ritter','lindt','haribo','mentos','lizak','donut','muffin',
  ]],
  ['pieczywo',   [
    'chleb','bułk','bagietk','tost','graham','pumpernik','orkiszow','rustykalna',
    'żytni','razow','brioche','focaccia','ciabatt','croissant','rogal',
    'drożdżówk','kajzerek','pączek','chałka','sucharki','pieczywo chrup',
  ]],
  ['napoje',     [
    'woda','sok','piwo','wino','cola','fanta','sprite','pepsi','energy',
    'herbata','kawa','napój','lemoniada','kombucha','smoothie','cydr',
    'gatorade','powerade','red bull','monster','tiger','wódka','whisky',
    'rum','gin','brandy','likier','szampan','prosecco','napój gazow',
  ]],
  ['przekąski',  [
    'chipsy','paluszk','krakersy','orzeszk','migdał','słonecznik','prażynk',
    'pistacj','popcorn','preczel','nachos','cashew','chrupki','puff','soletti',
  ]],
  ['chemia',     [
    'szampon','mydło','proszek','płyn do','chusteczk','papier toalet',
    'zmywak','gąbk','dezodorant','płyn do płukan','worek na śmiec',
    'ściereczk','rękawiczki gum','tabletki do zmyw','kapsułk','żel do pran',
    'wybielacz','soda oczyszcz','domestos','cif','ajax','mr muscle',
    'vanish','persil','ariel','vizir','lenor','silan','coccolino',
  ]],
  ['higiena',    [
    'pasta do zębów','szczoteczka','nić dentyst','płyn do płukania ust',
    'ręcznik papier','papier kuch','serwetk','waciki','patyczki',
    'podpaska','tampon','wkładka','pielucha','pampers','huggies',
    'krem do rąk','krem do twarzy','balsam do ciała','żel pod prysznic',
    'płyn micel',
  ]],
  ['dania gotowe',['pierogi','naleśnik','pizza mrożon','gotow','mrożon','zupa gotow',
    'obiad gotow','potrawa gotow','danie gotow','kotlet gotow','lasagna',
    'gnocchi','risotto','paella','tikka masala','curry gotow',
  ]],
];

export function getFoodTags(name: string): string[] {
  const lower = name.toLowerCase();
  return FOOD_TAG_MAP
    .filter(([, kws]) => kws.some(kw => lower.includes(kw)))
    .map(([tag]) => tag);
}

function categorize(name: string): ExpenseCategory {
  const lower = name.toLowerCase();
  // health before groceries to catch pharmacy keywords
  const order: ExpenseCategory[] = ['health', 'transport', 'entertainment', 'clothing', 'housing', 'subscriptions', 'groceries'];
  for (const cat of order) {
    const keywords = CATEGORY_KEYWORDS[cat];
    if (cat === 'other') continue;
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'groceries';
}

// ─── Promotion detection ──────────────────────────────────────────────────────

function detectPromotion(line: string): string | undefined {
  if (/1\s*\+\s*1/i.test(line)) return '1+1';
  if (/2\s*za\s*cen[ęe]\s*1/i.test(line)) return '2 za cenę 1';
  if (/3\s*za\s*cen[ęe]\s*2/i.test(line)) return '3 za cenę 2';
  if (/opust\s+promocyjn/i.test(line)) return 'Promo';
  const pctMatch = line.match(/-(\d+(?:[.,]\d+)?)\s*%/);
  if (pctMatch) return `-${pctMatch[1]}%`;
  if (/gratis|bezpłatn|free/i.test(line)) return 'gratis';
  return undefined;
}

// ─── VAT code stripping ───────────────────────────────────────────────────────

function stripVatCode(line: string): string {
  let s = line.replace(/(\d+[.,]\d{1,3})\s*[A-E]\s*$/, '$1');
  s = s.replace(/\s{2,}[A-E]\s{2,}(\d+[.,]\d{1,3}\s*$)/, '  $1');
  return s;
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

// Name  qty*price  total  (optional VAT letter at end stripped by stripVatCode)
const FULL_RE = /^(.+?)\s{2,}(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{1,3})\s*$/i;
// Name  total  (single price, 1 unit)
const SIMPLE_RE = /^(.+?)\s{1,}(\d+[.,]\d{2})\s*$/;
// Weight-based info line: 0,345kg * 19,99/kg
const WEIGHT_RE = /^(\d+[.,]\d+)\s*(?:kg|g|dag|l|ml|szt)\.?\s*[x×*]\s*(\d+[.,]\d{2,3})(?:[/\\](?:kg|g|dag|l|szt))?/i;
// Standalone info line: qty * unitprice  total
const PRODUCT_INFO_RE = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{1,3})\s*$/;
// Inline total with weight+price: "0,523  kg  x  12,99/kg  6,79"
const WEIGHT_INLINE_RE = /^(\d+[.,]\d+)\s*kg\s*[x×*]\s*(\d+[.,]\d{2})\/kg\s+(\d+[.,]\d{2})/i;
const DISCOUNT_KW_RE = /^(?:RABAT(?:\s+\w+)?|OPUST|ZNIZKA|ZNIZK|PROMOCJA|OBNIŻKA|OBN|UPUST|KDR|LIDL\s*PLUS|PLUS\s*KUPON|KUPON|BON|VOUCHER|APLIKACJA|APP|MOJA\s*BIEDRONKA|BIEDRONKA\s*APP|GRATIS(?:\s+ZA)?\s+[-–]?(\d+[.,]\d{2})|HAPPY\s*HOUR|OFERTA|KARTA\s*STAŁ|KARTA\s*RABAT|ZWROT)\s*[-–]?\s*(\d+[.,]\d{2})/i;
const DISCOUNT_NEG_RE = /^[#*]?\s*[-–]\s*(\d+[.,]\d{2})\s*$/;
const INLINE_DISC_RE = /^.+\s{2,}[-–]\s*(\d+[.,]\d{2})\s*$/;
const PRICE_ONLY_RE = /^\s*(\d+[.,]\d{1,3})\s*$/;

const SKIP_RE = /^(SUMA|RAZEM|DO ZAP[ŁL]ATY|[ŁL][AĄ]CZNIE|PTU|KWOTA|VAT\s+[A-E]|PARAGON|DZIE[NK]UJEMY|DZIE[NK]\.?|THANK|KOD\s|NIP|DATA\s|KASJER|ZAPRASZAMY|ZMIANA|GOT[ÓO]WKA|KARTA|P[ŁL]ATNO|FISKALNY|WYDRUK|POKWITOWANIE|ORYGINA[ŁL]|KOPIA|NUMER|TERMINAL|TRANSAKCJA|APPROVED|AUTORYZ|POWROT|POWRÓT|CASHBACK|SPRZEDAŻ|SPRZEDAZ|SALDO|ODBIÓR|ODBIORY|SERIA|KASY|KAS\s|CZĄSTK|CZASTK|SUMA\s+CZĄSTK|NADRUK|PARAGON FISKALN|KOPIĘ|NIEFISKALN)/i;

const TOTAL_RE = /(?:SUMA(?:\s+PLN)?|RAZEM(?:\s+PLN)?|DO\s+ZAP[ŁL]ATY|[ŁL][AĄ]CZNIE|TOTAL|DO\s+ZAP[ŁL]ATY\s+PLN)\s*:?\s*(?:PLN\s*)?(\d+[.,]\d{2})/i;

// ─── Abbreviation expansion ───────────────────────────────────────────────────
// Ordered from most-specific to least-specific to avoid partial overwrites

const ABBR_MAP: [RegExp, string][] = [
  // Meat / mięso
  [/\bpier\.?\s*z\.?\s*kurcz\.?\b/i,   'Pierś z kurczaka'],
  [/\bpol\.?\s*z\.?\s*kurcz\.?\b/i,    'Polędwica z kurczaka'],
  [/\bfil\.?\s*z\.?\s*kurcz\.?\b/i,    'Filet z kurczaka'],
  [/\bpier\.?\s*ind\.?\b/i,            'Pierś z indyka'],
  [/\bpol\.?\s*wieprzow\.?\b/i,        'Polędwica wieprzowa'],
  [/\bschab\s+b\.?\s*k\.?\b/i,         'Schab bez kości'],
  [/\bschab\s+bez\.?\b/i,              'Schab bez kości'],
  [/\bkarkówk\.?\b/i,                  'Karkówka'],
  [/\bmiel\.?\s+wieprzow\.?\b/i,       'Mielona wieprzowa'],
  [/\bmiel\.?\s+mieszana\.?\b/i,       'Mielona mieszana'],
  [/\bwędl\.?\b/i,                     'Wędlina'],
  [/\bkiełb\.?\b/i,                    'Kiełbasa'],
  [/\bpasztet\.?\b/i,                  'Pasztet'],
  [/\bwołow\.?\b/i,                    'Wołowina'],
  [/\bwieprzow\.?\b/i,                 'Wieprzowina'],
  [/\bdrob\.?\b/i,                     'Drób'],
  [/\bkurcz\.?\b/i,                    'Kurczak'],
  [/\bindyk\.?\b/i,                    'Indyk'],
  // Nabiał
  [/\bjogurt\s+nat\.?\b/i,             'Jogurt naturalny'],
  [/\bjogurt\s+pit\.?\b/i,             'Jogurt pitny'],
  [/\bjogurt\s+greck\.?\b/i,           'Jogurt grecki'],
  [/\bśmiet\.?\b/i,                    'Śmietana'],
  [/\bśmietank\.?\b/i,                 'Śmietanka'],
  [/\bser\s+żółt\.?\b/i,              'Ser żółty'],
  [/\bser\s+twarog\.?\b/i,            'Ser twarogowy'],
  [/\btwaróg\s+chud\.?\b/i,           'Twaróg chudy'],
  [/\bmasło\s+ekstr\.?\b/i,           'Masło extra'],
  // Warzywa/Owoce
  [/\bziem\.?\b/i,                     'Ziemniaki'],
  [/\bogórk\.?\b/i,                    'Ogórki'],
  [/\bpom\.?\s+gruntow\.?\b/i,        'Pomidory gruntowe'],
  [/\bpap\.?\s+czerw\.?\b/i,          'Papryka czerwona'],
  [/\bpap\.?\s+żółt\.?\b/i,           'Papryka żółta'],
  [/\bpap\.?\s+ziel\.?\b/i,           'Papryka zielona'],
  [/\bsałat\.?\b/i,                    'Sałata'],
  [/\bkapust\.?\b/i,                   'Kapusta'],
  [/\bbrokuł\.?\b/i,                   'Brokuł'],
  [/\bszpinak\.?\b/i,                  'Szpinak'],
  [/\bbanan\.?\b/i,                    'Banan'],
  [/\bjabłk\.?\b/i,                    'Jabłka'],
  [/\bpomarańcz\.?\b/i,               'Pomarańcze'],
  // Pieczywo
  [/\bbułk\.?\s+kajz\.?\b/i,          'Bułka kajzerka'],
  [/\bchleb\s+razow\.?\b/i,           'Chleb razowy'],
  [/\bchleb\s+żytn\.?\b/i,            'Chleb żytni'],
  [/\bchleb\s+orkisz\.?\b/i,          'Chleb orkiszowy'],
  // Higiena/Chemia
  [/\bpap\.?\s+toal\.?\b/i,           'Papier toaletowy'],
  [/\bpap\.?\s+kuch\.?\b/i,           'Papier kuchenny'],
  [/\bchust\.?\s+nawil\.?\b/i,        'Chusteczki nawilżane'],
  [/\bchust\.?\s+hyg\.?\b/i,          'Chusteczki higieniczne'],
  [/\bchust\.?\s+kosm\.?\b/i,         'Chusteczki kosmetyczne'],
  [/\bszamp\.?\b/i,                    'Szampon'],
  [/\bpast\.?\s+z\.?\s*zęb\.?\b/i,   'Pasta do zębów'],
  [/\bdezod\.?\b/i,                    'Dezodorant'],
  [/\bżel\s+p\.?\s*prysz\.?\b/i,     'Żel pod prysznic'],
  [/\bpłyn\s+do\s+nacz\.?\b/i,       'Płyn do naczyń'],
  [/\bpłyn\s+do\s+płuk\.?\b/i,       'Płyn do płukania'],
  [/\bproszek\s+do\s+pran\.?\b/i,    'Proszek do prania'],
  [/\bkaps\.?\s+do\s+pran\.?\b/i,    'Kapsułki do prania'],
  [/\bdet\.?\s+kaps\.?\b/i,           'Detergent kapsułki'],
  // Napoje
  [/\bwoda\s+min\.?\s+nieg\.?\b/i,   'Woda mineralna niegazowana'],
  [/\bwoda\s+min\.?\s+gaz\.?\b/i,    'Woda mineralna gazowana'],
  [/\bwoda\s+min\.?\b/i,              'Woda mineralna'],
  [/\bwoda\s+sm\.?\b/i,               'Woda smakowa'],
  [/\bnap\.?\s+gaz\.?\b/i,            'Napój gazowany'],
  [/\bnap\.?\s+energet\.?\b/i,        'Napój energetyczny'],
  // Dania gotowe
  [/\bpierogi\s+ru\.?\b/i,            'Pierogi ruskie'],
  [/\bpierogi\s+z\s+m\.?\b/i,        'Pierogi z mięsem'],
  [/\bnaleśn\.?\b/i,                  'Naleśniki'],
  [/\bzupa\s+krem\.?\b/i,             'Zupa krem'],
  // Generic dot-abbreviation: capitalize after expansion
  [/\.{1,2}\s*$/, ''],   // strip trailing dots
];

function expandAbbreviations(name: string): string {
  let s = name;
  for (const [pattern, replacement] of ABBR_MAP) {
    s = s.replace(pattern, replacement);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Name cleaner — strips PLU codes, leading asterisks, noise, expands abbreviations
function cleanName(raw: string): string {
  let s = raw.replace(/^[*#@]\s*/, '').trim();
  s = s.replace(/\s+[A-E]\s*$/, '').trim();
  // Remove leading 6-13 digit PLU/EAN code
  s = s.replace(/^\d{6,13}\s+/, '');
  // Remove trailing PLN/ZŁ suffix
  s = s.replace(/\s+(?:PLN|Z[ŁL])$/i, '').trim();
  // Expand Polish receipt abbreviations
  s = expandAbbreviations(s);
  return s;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const products: ReceiptProduct[] = [];
  let total = 0;
  let subtotal = 0;
  let totalDiscount = 0;
  let storeName: string | undefined;
  let date: string | undefined;
  let lastProduct: ReceiptProduct | null = null;
  let pendingName: string | null = null;

  const headerText = lines.slice(0, 12).join(' ');
  for (const brand of STORE_BRANDS) {
    if (brand.pattern.test(headerText)) { storeName = brand.name; break; }
  }
  if (!storeName) {
    for (const brand of STORE_BRANDS) {
      if (brand.pattern.test(text)) { storeName = brand.name; break; }
    }
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const dmyMatch = text.match(/\b(\d{2}[./]\d{2}[./]\d{4})\b/);
  if (isoMatch) {
    date = isoMatch[1];
  } else if (dmyMatch) {
    const parts = dmyMatch[1].split(/[./]/);
    date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Try multiple total patterns in priority order
  const totalPatterns = [
    /SUMA\s+PLN\s+(\d+[.,]\d{2})/i,
    /DO\s+ZAP[ŁL]ATY\s+(?:PLN\s+)?(\d+[.,]\d{2})/i,
    /RAZEM\s+(?:PLN\s+)?(\d+[.,]\d{2})/i,
    /SUMA\s*:?\s*(\d+[.,]\d{2})/i,
    /[ŁL][AĄ]CZNIE\s+(?:PLN\s+)?(\d+[.,]\d{2})/i,
    /TOTAL\s+(?:PLN\s+)?(\d+[.,]\d{2})/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m) { total = parseFloat(m[1].replace(',', '.')); break; }
  }

  const addProduct = (p: ReceiptProduct) => {
    if (p.name.length < 2) return;
    if (p.finalPrice > 5000) return;
    products.push(p);
    lastProduct = p;
    subtotal += p.finalPrice;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];

    // Weight inline: "0,523 kg x 12,99/kg 6,79" — update last product
    const wil = raw.match(WEIGHT_INLINE_RE);
    if (wil && lastProduct !== null) {
      const lp  = lastProduct as ReceiptProduct;
      const qty = parseFloat(wil[1].replace(',', '.'));
      const u   = parseFloat(wil[2].replace(',', '.'));
      const tot = parseFloat(wil[3].replace(',', '.'));
      if (tot > 0 && tot < 5000) {
        subtotal -= lp.finalPrice;
        lp.quantity = qty; lp.unitPrice = u; lp.finalPrice = tot;
        subtotal += tot;
        pendingName = null;
        continue;
      }
    }

    const wm = raw.match(WEIGHT_RE);
    if (wm && lastProduct !== null) {
      const lp  = lastProduct as ReceiptProduct;
      const qty = parseFloat(wm[1].replace(',', '.'));
      const u   = parseFloat(wm[2].replace(',', '.'));
      const tot = Math.round(qty * u * 100) / 100;
      subtotal -= lp.finalPrice;
      lp.quantity   = qty;
      lp.unitPrice  = u;
      lp.finalPrice = tot;
      subtotal += tot;
      pendingName = null;
      continue;
    }

    const line = stripVatCode(raw);

    if (SKIP_RE.test(line)) continue;
    if (/^\d{8,}$/.test(line)) continue;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(line)) continue;
    if (/^\d+\s+\d+\s+nr:/i.test(line)) continue;

    const promo = detectPromotion(line);

    const dkm = line.match(DISCOUNT_KW_RE);
    const dnm = line.match(DISCOUNT_NEG_RE);
    const dim = line.match(INLINE_DISC_RE);
    if ((dkm || dnm || dim) && lastProduct !== null) {
      const lp   = lastProduct as ReceiptProduct;
      // DISCOUNT_KW_RE has 2 capture groups (optional gratis group + amount), take the last defined
      const dkmVal = dkm ? (dkm[2] ?? dkm[1]) : undefined;
      const disc = parseFloat((dkmVal ?? (dnm ? dnm[1] : dim![1])).replace(',', '.'));
      if (disc > 0) {
        lp.discount    = (lp.discount ?? 0) + disc;
        lp.finalPrice  = Math.max(0, lp.finalPrice - disc);
        lp.promotion   = lp.promotion ?? detectPromotion(raw) ?? `−${disc.toFixed(2)} zł`;
        subtotal      -= disc;
        totalDiscount += disc;
      }
      pendingName = null;
      continue;
    }

    if (pendingName) {
      const wm2 = raw.match(WEIGHT_RE);
      if (wm2) {
        const qty  = parseFloat(wm2[1].replace(',', '.'));
        const u    = parseFloat(wm2[2].replace(',', '.'));
        const totalM = line.match(/(\d+[.,]\d{1,3})\s*$/);
        const tot  = totalM
          ? parseFloat(totalM[1].replace(',', '.'))
          : Math.round(qty * u * 100) / 100;
        if (tot > 0 && tot < 5000) {
          addProduct({ name: pendingName, quantity: qty, unitPrice: u, finalPrice: tot, category: categorize(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      // Weight inline on pending name line
      const wil2 = raw.match(WEIGHT_INLINE_RE);
      if (wil2) {
        const qty = parseFloat(wil2[1].replace(',', '.'));
        const u   = parseFloat(wil2[2].replace(',', '.'));
        const tot = parseFloat(wil2[3].replace(',', '.'));
        if (tot > 0 && tot < 5000) {
          addProduct({ name: pendingName, quantity: qty, unitPrice: u, finalPrice: tot, category: categorize(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      const pm = line.match(PRICE_ONLY_RE);
      if (pm) {
        const price = parseFloat(pm[1].replace(',', '.'));
        if (price > 0 && price < 5000) {
          addProduct({ name: pendingName, quantity: 1, unitPrice: price, finalPrice: price, category: categorize(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      const pim = line.match(PRODUCT_INFO_RE);
      if (pim) {
        const qty = parseFloat(pim[1].replace(',', '.'));
        const u   = parseFloat(pim[2].replace(',', '.'));
        const tot = parseFloat(pim[3].replace(',', '.'));
        if (tot > 0 && tot < 5000) {
          addProduct({ name: pendingName, quantity: qty, unitPrice: u, finalPrice: tot, category: categorize(pendingName), promotion: promo });
          pendingName = null; continue;
        }
      }
      pendingName = null;
    }

    const fm = line.match(FULL_RE);
    if (fm) {
      const name = cleanName(fm[1]);
      const qty  = parseFloat(fm[2].replace(',', '.'));
      const u    = parseFloat(fm[3].replace(',', '.'));
      const tot  = parseFloat(fm[4].replace(',', '.'));
      if (tot < 5000 && name.length >= 2) {
        addProduct({ name, quantity: qty, unitPrice: u, finalPrice: tot, category: categorize(name), promotion: promo });
      }
      continue;
    }

    const sm = line.match(SIMPLE_RE);
    if (sm) {
      const name  = cleanName(sm[1]);
      const price = parseFloat(sm[2].replace(',', '.'));
      // Reject obvious non-product lines
      if (price > 0 && price < 5000 && name.length >= 2 &&
          !/^(PLN|ZŁ|ZL|\d+|[A-E]|PTU|VAT|SUMA|RAZEM|KARTA|KASJER|ZMIANA)$/i.test(name) &&
          !/^\d+$/.test(name)) {
        addProduct({ name, quantity: 1, unitPrice: price, finalPrice: price, category: categorize(name), promotion: promo });
      }
      continue;
    }

    if (promo && lastProduct !== null && !(lastProduct as ReceiptProduct).promotion) {
      (lastProduct as ReceiptProduct).promotion = promo;
      continue;
    }

    if (line.length >= 2 && !/^\d/.test(line) && !/^[A-E]\s/.test(line)) {
      const nextRaw = lines[idx + 1];
      if (nextRaw) {
        const nextClean = stripVatCode(nextRaw.trim());
        if (
          PRICE_ONLY_RE.test(nextClean) ||
          nextClean.match(WEIGHT_RE) ||
          nextClean.match(WEIGHT_INLINE_RE) ||
          PRODUCT_INFO_RE.test(nextClean)
        ) {
          pendingName = cleanName(line);
        }
      }
    }
  }

  return {
    storeName,
    date,
    products,
    subtotal: subtotal || total,
    totalDiscount,
    total: total || subtotal,
    raw: text,
  };
}

// ─── Group by category ────────────────────────────────────────────────────────

export function groupReceiptByCategory(receipt: ParsedReceipt): Record<ExpenseCategory, number> {
  const result: Partial<Record<ExpenseCategory, number>> = {};
  for (const p of receipt.products) {
    result[p.category] = (result[p.category] ?? 0) + p.finalPrice;
  }
  return result as Record<ExpenseCategory, number>;
}
