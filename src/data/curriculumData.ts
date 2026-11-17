import {
  EnemyType,
  ExerciseCategory,
  MissionDefinition,
  WaveDefinition,
  WaveSpawnGroup,
  WorldDefinition,
} from '../types';

export const WORLDS_DATA: WorldDefinition[] = [
  {
    id: 1,
    theme: 'green_valley',
    namePl: 'Zielona Dolina',
    nameEn: 'Green Valley',
    focusPl: 'Klawisze F, J, D, K oraz podstawowe ułożenie palców',
    focusEn: 'F, J, D, K and basic finger positioning',
    descriptionPl:
      'Pierwsza linia obrony KeyFort. Naucz się wyczuwać wypustki na klawiszach F oraz J i opanuj pracę palców wskazujących oraz środkowych.',
    descriptionEn:
      'KeyFort’s outer perimeter. Learn to feel the tactile bumps on F and J and master your index and middle fingers.',
    primaryColor: '#22c55e',
    secondaryColor: '#14532d',
    introducedKeys: ['f', 'j', ' ', 'd', 'k'],
    unlockedTower: 'gun',
    bossNamePl: 'Strażnik Doliny MK-I',
    bossNameEn: 'Valley Warden MK-I',
  },
  {
    id: 2,
    theme: 'dark_forest',
    namePl: 'Mroczny Las',
    nameEn: 'Dark Forest',
    focusPl: 'Pozostałe klawisze rzędu domowego (S, L, A, ;, G, H)',
    focusEn: 'Remaining home-row keys (S, L, A, ;, G, H)',
    descriptionPl:
      'Gęsty las kryje szybkie Roje. Opanuj pracę palców serdecznych i małych oraz boczne sięgnięcia do G i H, aby pisać pierwsze pełne słowa.',
    descriptionEn:
      'Dense woods hide fast Swarms. Master your ring and pinky fingers plus lateral reaches to G and H to type your first real words.',
    primaryColor: '#6366f1',
    secondaryColor: '#1e1b4b',
    introducedKeys: ['s', 'l', 'a', ';', 'g', 'h'],
    unlockedTower: 'frost',
    bossNamePl: 'Leśny Kolos Cienia',
    bossNameEn: 'Shadowwood Colossus',
  },
  {
    id: 3,
    theme: 'mountain_pass',
    namePl: 'Górska Przełęcz',
    nameEn: 'Mountain Pass',
    focusPl: 'Górny rząd klawiatury (E, I, R, U, W, O, T, Y, Q, P)',
    focusEn: 'Upper keyboard row (E, I, R, U, W, O, T, Y, Q, P)',
    descriptionPl:
      'Wysokogórskie szlaki wymagają sięgania do górnego rzędu klawiszy z powrotem na pozycję bazową. Odblokuj Wieżę Tesli przeciwko Tarczom i Duchom.',
    descriptionEn:
      'High altitude trails require reaching up to the top row while returning to home anchors. Unlock the Tesla Tower against Shields and Ghosts.',
    primaryColor: '#f97316',
    secondaryColor: '#431407',
    introducedKeys: ['e', 'i', 'r', 'u', 'w', 'o', 't', 'y', 'q', 'p'],
    unlockedTower: 'tesla',
    bossNamePl: 'Górski Gromowładny',
    bossNameEn: 'Peak Stormbringer',
  },
  {
    id: 4,
    theme: 'desert_outpost',
    namePl: 'Pustynny Posterunek',
    nameEn: 'Desert Outpost',
    focusPl: 'Dolny rząd klawiatury (V, M, C, ,, B, N, X, ., Z, /)',
    focusEn: 'Lower keyboard row (V, M, C, ,, B, N, X, ., Z, /)',
    descriptionPl:
      'Na spalonych słońcem wydmach opanujesz dolny rząd klawiatury, kompletując cały alfabet i odblokowując Wieżę Snajperską.',
    descriptionEn:
      'Across sun-baked dunes, master the bottom keyboard row to complete the full alphabet and unlock the Sniper Tower.',
    primaryColor: '#eab308',
    secondaryColor: '#422006',
    introducedKeys: ['v', 'm', 'c', ',', 'b', 'n', 'x', '.', 'z', '/'],
    unlockedTower: 'sniper',
    bossNamePl: 'Skorpion Pustynny',
    bossNameEn: 'Dune Scorpius',
  },
  {
    id: 5,
    theme: 'frozen_islands',
    namePl: 'Lodowe Wyspy',
    nameEn: 'Frozen Islands',
    focusPl: 'Słowa, spacje, sylaby i płynna konsolidacja trzech rzędów',
    focusEn: 'Words, spaces, syllables and three-row consolidation',
    descriptionPl:
      'Zamarznięty archipelag wystawia na próbę płynność łączenia liter w słowa, dwuznaki i frazy bez patrzenia na klawiaturę.',
    descriptionEn:
      'The frozen archipelago tests your rhythm combining all three rows into smooth words, bigrams, and tactical phrases.',
    primaryColor: '#06b6d4',
    secondaryColor: '#083344',
    introducedKeys: [],
    bossNamePl: 'Lodowy Lewiatan',
    bossNameEn: 'Cryo Leviathan',
  },
  {
    id: 6,
    theme: 'ancient_ruins',
    namePl: 'Starożytne Ruiny',
    nameEn: 'Ancient Ruins',
    focusPl: 'Polskie znaki diakrytyczne z klawiszem AltGr (ą, ć, ę, ł, ń, ó, ś, ź, ż)',
    focusEn: 'Polish diacritical characters with AltGr (ą, ć, ę, ł, ń, ó, ś, ź, ż)',
    descriptionPl:
      'Odkryj tajemnice polskich znaków diakrytycznych używając prawego klawisza Alt (AltGr) w układzie Polski Programisty.',
    descriptionEn:
      'Master all nine Polish diacritical characters using Right Alt (AltGr) on the standard Polish Programmer layout.',
    primaryColor: '#d946ef',
    secondaryColor: '#3b0764',
    introducedKeys: ['ą', 'ę', 'ł', 'ó', 'ś', 'ć', 'ń', 'ż', 'ź'],
    bossNamePl: 'Archont Starożytnych Ruin',
    bossNameEn: 'Archon of the Ruins',
  },
  {
    id: 7,
    theme: 'industrial_city',
    namePl: 'Przemysłowe Miasto',
    nameEn: 'Industrial City',
    focusPl: 'Wielkie litery (Shift), cyfry (0–9) oraz interpunkcja',
    focusEn: 'Uppercase letters (Shift), numbers (0–9) and punctuation',
    descriptionPl:
      'W cybernetycznej metropolii nauczysz się zasady przeciwległego klawisza Shift, rzędu cyfr oraz znaków interpunkcyjnych.',
    descriptionEn:
      'In the cybernetic metropolis, master the opposite-hand Shift rule, the number row, and tactical punctuation.',
    primaryColor: '#ef4444',
    secondaryColor: '#450a0a',
    introducedKeys: [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'R', 'S', 'T', 'U', 'W', 'Z', 'Ł', 'Ś', 'Ż',
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', ':', '!', '?',
    ],
    bossNamePl: 'Żelazny Nadzorca Fabryki',
    bossNameEn: 'Iron Foundry Overseer',
  },
  {
    id: 8,
    theme: 'final_fortress',
    namePl: 'Ostatnia Twierdza',
    nameEn: 'Final Fortress',
    focusPl: 'Pełne zdania, wysoka celność i biegłość pisania',
    focusEn: 'Full sentences, high accuracy and typing fluency',
    descriptionPl:
      'Ostateczne starcie o rdzeń KeyFort. Pisz pełne polskie i angielskie zdania, utrzymując zasilanie całej sieci obronnej.',
    descriptionEn:
      'The final stand for the KeyFort core. Type complete sentences with accuracy and fluency while commanding full-scale defenses.',
    primaryColor: '#f43f5e',
    secondaryColor: '#4c0519',
    introducedKeys: [],
    bossNamePl: 'Imperator KeyFort Omega',
    bossNameEn: 'Emperor KeyFort Omega',
  },
];

interface MissionSeedSpec {
  worldId: number;
  missionIndex: number;
  namePl: string;
  nameEn: string;
  subtitlePl: string;
  subtitleEn: string;
  lessonIntroPl: string;
  lessonIntroEn: string;
  newKeys: string[];
  focusCategories: ExerciseCategory[];
  requiredTypedChars: number;
  targetAccuracy: number;
}

const MISSION_SPECS: MissionSeedSpec[] = [
  // WORLD 1: Green Valley (f, j, space, d, k)
  {
    worldId: 1,
    missionIndex: 1,
    namePl: 'Wypustki Bazowe: F oraz J',
    nameEn: 'Tactile Anchors: F and J',
    subtitlePl: 'Palce wskazujące obu dłoni',
    subtitleEn: 'Left and right index fingers',
    lessonIntroPl: 'Połóż lewy palec wskazujący na klawiszu F, a prawy na J. Poczuj pod opuszkami małe wypustki orientacyjne.',
    lessonIntroEn: 'Place your left index finger on F and right index finger on J. Feel the small tactile ridges under your fingertips.',
    newKeys: ['f', 'j'],
    focusCategories: ['drill', 'alternation'],
    requiredTypedChars: 42,
    targetAccuracy: 0.8,
  },
  {
    worldId: 2 - 1,
    missionIndex: 2,
    namePl: 'Rytm Kciuka: Klawisz Spacji',
    nameEn: 'Thumb Rhythm: The Spacebar',
    subtitlePl: 'F, J oraz Spacja',
    subtitleEn: 'F, J, and Spacebar',
    lessonIntroPl: 'Używaj kciuka do wciskania Spacji. Zachowuj spokojny, równy rytm pomiędzy grupami znaków.',
    lessonIntroEn: 'Use your thumb to press the Spacebar. Maintain a calm, steady rhythm between character groups.',
    newKeys: [' '],
    focusCategories: ['drill', 'alternation'],
    requiredTypedChars: 52,
    targetAccuracy: 0.82,
  },
  {
    worldId: 1,
    missionIndex: 3,
    namePl: 'Środkowy Wspólnik: Klawisz D',
    nameEn: 'Left Middle Support: Key D',
    subtitlePl: 'Dodajemy klawisz D do F i J',
    subtitleEn: 'Adding D to F and J',
    lessonIntroPl: 'Lewy palec środkowy spoczywa naturalnie na klawiszu D, tuż obok F.',
    lessonIntroEn: 'Your left middle finger rests naturally on key D, right next to F.',
    newKeys: ['d'],
    focusCategories: ['drill', 'coordination'],
    requiredTypedChars: 62,
    targetAccuracy: 0.82,
  },
  {
    worldId: 1,
    missionIndex: 4,
    namePl: 'Symetria Dłoni: Klawisz K',
    nameEn: 'Hand Symmetry: Key K',
    subtitlePl: 'Prawy palec środkowy na K',
    subtitleEn: 'Right middle finger on K',
    lessonIntroPl: 'Prawy palec środkowy odpowiada za klawisz K. Ćwicz naprzemienne kombinacje D-K oraz F-J.',
    lessonIntroEn: 'Your right middle finger controls K. Practice alternating combinations of D-K and F-J.',
    newKeys: ['k'],
    focusCategories: ['drill', 'alternation', 'coordination'],
    requiredTypedChars: 85,
    targetAccuracy: 0.85,
  },
  {
    worldId: 1,
    missionIndex: 5,
    namePl: 'Czwórka Rdzeniowa: F, D, J, K',
    nameEn: 'Core Quartet: F, D, J, K',
    subtitlePl: 'Koordynacja czterech palców',
    subtitleEn: 'Four-finger coordination',
    lessonIntroPl: 'Połącz wszystkie cztery poznane klawisze w dłuższe sekwencje zasilające wieże.',
    lessonIntroEn: 'Combine all four learned keys into longer energy sequences to power your towers.',
    newKeys: [],
    focusCategories: ['coordination', 'alternation', 'bigrams'],
    requiredTypedChars: 95,
    targetAccuracy: 0.85,
  },
  {
    worldId: 1,
    missionIndex: 6,
    namePl: 'BOSS: Strażnik Doliny MK-I',
    nameEn: 'BOSS: Valley Warden MK-I',
    subtitlePl: 'Egzamin z klawiszy F, J, D, K',
    subtitleEn: 'Mastery exam for F, J, D, K',
    lessonIntroPl: 'Strażnik Doliny nadciąga! Utrzymuj wysokie naładowanie energii za pomocą precyzyjnego pisania F, D, J, K.',
    lessonIntroEn: 'The Valley Warden approaches! Keep energy reserves high by accurately typing F, D, J, and K.',
    newKeys: [],
    focusCategories: ['coordination', 'alternation', 'bigrams'],
    requiredTypedChars: 110,
    targetAccuracy: 0.86,
  },

  // WORLD 2: Dark Forest (s, l, a, ;, g, h)
  {
    worldId: 2,
    missionIndex: 1,
    namePl: 'Palce Serdeczne: S oraz L',
    nameEn: 'Ring Fingers: S and L',
    subtitlePl: 'Rozszerzamy rząd domowy o S i L',
    subtitleEn: 'Expanding the home row with S and L',
    lessonIntroPl: 'Lewy palec serdeczny obsługuje S, a prawy palec serdeczny obsługuje L.',
    lessonIntroEn: 'Your left ring finger presses S, while your right ring finger presses L.',
    newKeys: ['s', 'l'],
    focusCategories: ['drill', 'coordination'],
    requiredTypedChars: 95,
    targetAccuracy: 0.85,
  },
  {
    worldId: 2,
    missionIndex: 2,
    namePl: 'Pierwsze Słowa: Klawisz A',
    nameEn: 'First Real Words: Key A',
    subtitlePl: 'Lewy mały palec na A — pierwsze słowa!',
    subtitleEn: 'Left pinky on A — unlocking real words!',
    lessonIntroPl: 'Dodajemy klawisz A pod lewym małym palcem. Teraz możesz pisać prawdziwe słowa, takie jak: las, sala, fala, kasa!',
    lessonIntroEn: 'Adding key A under your left pinky unlocks real words like: las, sala, fala, ask, fall, dad!',
    newKeys: ['a'],
    focusCategories: ['drill', 'syllables', 'words'],
    requiredTypedChars: 105,
    targetAccuracy: 0.85,
  },
  {
    worldId: 2,
    missionIndex: 3,
    namePl: 'Pełne Oparcie: Średnik (;)',
    nameEn: 'Full Home Stance: Semicolon (;)',
    subtitlePl: 'Prawy mały palec na średniku (;)',
    subtitleEn: 'Right pinky on semicolon (;)',
    lessonIntroPl: 'Prawy mały palec spoczywa na klawiszu średnika (;). Wszystkie osiem palców ma już swoje miejsce domowe.',
    lessonIntroEn: 'Your right pinky rests on the semicolon (;) key. All eight fingers now occupy their home anchors.',
    newKeys: [';'],
    focusCategories: ['drill', 'coordination', 'words'],
    requiredTypedChars: 110,
    targetAccuracy: 0.85,
  },
  {
    worldId: 2,
    missionIndex: 4,
    namePl: 'Boczne Sięgnięcie: Klawisz G',
    nameEn: 'Inner Reach Left: Key G',
    subtitlePl: 'Lewy palec wskazujący sięga do G',
    subtitleEn: 'Left index finger reaches to G',
    lessonIntroPl: 'Lewy palec wskazujący przesuwa się z F w prawo na G, a po wciśnięciu natychmiast wraca na F.',
    lessonIntroEn: 'Your left index finger reaches right from F to G, then immediately returns to F.',
    newKeys: ['g'],
    focusCategories: ['drill', 'syllables', 'words'],
    requiredTypedChars: 115,
    targetAccuracy: 0.85,
  },
  {
    worldId: 2,
    missionIndex: 5,
    namePl: 'Most Środkowy: Klawisz H',
    nameEn: 'Inner Reach Right: Key H',
    subtitlePl: 'Prawy palec wskazujący sięga do H',
    subtitleEn: 'Right index finger reaches to H',
    lessonIntroPl: 'Prawy palec wskazujący sięga z J w lewo na H i wraca na J. Cały rząd domowy jest już odblokowany!',
    lessonIntroEn: 'Your right index finger reaches left from J to H and returns to J. The entire home row is now unlocked!',
    newKeys: ['h'],
    focusCategories: ['drill', 'words', 'alternation'],
    requiredTypedChars: 125,
    targetAccuracy: 0.86,
  },
  {
    worldId: 2,
    missionIndex: 6,
    namePl: 'BOSS: Leśny Kolos Cienia',
    nameEn: 'BOSS: Shadowwood Colossus',
    subtitlePl: 'Mistrzostwo pełnego rzędu domowego',
    subtitleEn: 'Complete Home Row Mastery',
    lessonIntroPl: 'Pokonaj Leśnego Kolosa pisząc płynnie słowa i sekwencje z całego rzędu domowego (A S D F G H J K L ;).',
    lessonIntroEn: 'Defeat the Shadowwood Colossus by smoothly typing words and drills across the entire home row.',
    newKeys: [],
    focusCategories: ['words', 'syllables', 'coordination'],
    requiredTypedChars: 135,
    targetAccuracy: 0.86,
  },

  // WORLD 3: Mountain Pass (e, i, r, u, w, o, t, y, q, p)
  {
    worldId: 3,
    missionIndex: 1,
    namePl: 'Szczyt Środkowy: E oraz I',
    nameEn: 'Middle Finger Ascent: E and I',
    subtitlePl: 'Sięgnięcie w górę z D->E oraz K->I',
    subtitleEn: 'Reaching up from D->E and K->I',
    lessonIntroPl: 'Palce środkowe sięgają o jeden rząd wyżej: lewy z D na E, prawy z K na I. Odblokowuje to dziesiątki nowych słów!',
    lessonIntroEn: 'Middle fingers reach one row up: left from D to E, right from K to I. This unlocks dozens of new words!',
    newKeys: ['e', 'i'],
    focusCategories: ['drill', 'syllables', 'words'],
    requiredTypedChars: 120,
    targetAccuracy: 0.85,
  },
  {
    worldId: 3,
    missionIndex: 2,
    namePl: 'Wektory Wskazujące: R oraz U',
    nameEn: 'Index Vectors: R and U',
    subtitlePl: 'Sięgnięcie w górę z F->R oraz J->U',
    subtitleEn: 'Reaching up from F->R and J->U',
    lessonIntroPl: 'Palce wskazujące wędrują w górę: lewy na R, prawy na U. Pamiętaj o powrocie na wypustki F i J.',
    lessonIntroEn: 'Index fingers reach upward: left to R, right to U. Always return to the F and J home ridges.',
    newKeys: ['r', 'u'],
    focusCategories: ['drill', 'syllables', 'words'],
    requiredTypedChars: 125,
    targetAccuracy: 0.85,
  },
  {
    worldId: 3,
    missionIndex: 3,
    namePl: 'Skrzydła Wiatru: W oraz O',
    nameEn: 'Wings of the Pass: W and O',
    subtitlePl: 'Palce serdeczne sięgają z S->W oraz L->O',
    subtitleEn: 'Ring fingers reach from S->W and L->O',
    lessonIntroPl: 'Palce serdeczne sięgają w górę na klawisze W oraz O, otwierając bogaty zasób polskiego słownictwa.',
    lessonIntroEn: 'Ring fingers reach upward to W and O, unlocking a rich vocabulary of Polish and English words.',
    newKeys: ['w', 'o'],
    focusCategories: ['drill', 'words', 'syllables'],
    requiredTypedChars: 130,
    targetAccuracy: 0.86,
  },
  {
    worldId: 3,
    missionIndex: 4,
    namePl: 'Most Górski: T oraz Y',
    nameEn: 'High Bridge: T and Y',
    subtitlePl: 'Skos palców wskazujących do T oraz Y',
    subtitleEn: 'Diagonal index reach to T and Y',
    lessonIntroPl: 'Palce wskazujące wykonują dłuższe sięgnięcie po przekątnej: lewy z F na T, prawy z J na Y.',
    lessonIntroEn: 'Index fingers make a diagonal upper reach: left from F to T, right from J to Y.',
    newKeys: ['t', 'y'],
    focusCategories: ['drill', 'words', 'bigrams'],
    requiredTypedChars: 135,
    targetAccuracy: 0.86,
  },
  {
    worldId: 3,
    missionIndex: 5,
    namePl: 'Krawędzie Grani: Q oraz P',
    nameEn: 'Outer Peaks: Q and P',
    subtitlePl: 'Małe palce sięgają na Q oraz P',
    subtitleEn: 'Pinky fingers reach to Q and P',
    lessonIntroPl: 'Małe palce obsługują skrajne klawisze górnego rzędu: lewy Q, prawy P. Cały górny rząd jest Twój!',
    lessonIntroEn: 'Pinky fingers control the outer top-row keys: left Q, right P. The entire top row is now yours!',
    newKeys: ['q', 'p'],
    focusCategories: ['drill', 'words', 'coordination'],
    requiredTypedChars: 140,
    targetAccuracy: 0.86,
  },
  {
    worldId: 3,
    missionIndex: 6,
    namePl: 'BOSS: Górski Gromowładny',
    nameEn: 'BOSS: Peak Stormbringer',
    subtitlePl: 'Konsolidacja rzędu domowego i górnego',
    subtitleEn: 'Home and Top Row Consolidation',
    lessonIntroPl: 'Gromowładny chroni się potężną tarczą. Zbuduj Wieże Tesli i pisz płynnie słowa z dwóch rzędów klawiatury!',
    lessonIntroEn: 'The Stormbringer projects heavy shields. Build Tesla Towers and smoothly type words across both rows!',
    newKeys: [],
    focusCategories: ['words', 'bigrams', 'alternation'],
    requiredTypedChars: 150,
    targetAccuracy: 0.86,
  },

  // WORLD 4: Desert Outpost (v, m, c, ,, b, n, x, ., z, /)
  {
    worldId: 4,
    missionIndex: 1,
    namePl: 'Dolny Wektor: V oraz M',
    nameEn: 'Lower Vector: V and M',
    subtitlePl: 'Palce wskazujące schodzą na V i M',
    subtitleEn: 'Index fingers descend to V and M',
    lessonIntroPl: 'Rozpoczynamy naukę dolnego rzędu. Lewy palec wskazujący schodzi z F na V, a prawy z J na M.',
    lessonIntroEn: 'We begin the bottom row. Left index moves down from F to V, and right index moves from J to M.',
    newKeys: ['v', 'm'],
    focusCategories: ['drill', 'words', 'syllables'],
    requiredTypedChars: 130,
    targetAccuracy: 0.85,
  },
  {
    worldId: 4,
    missionIndex: 2,
    namePl: 'Zejście Środkowe: C oraz Przecinek (,)',
    nameEn: 'Middle Descent: C and Comma (,)',
    subtitlePl: 'Palce środkowe na C oraz przecinek (,)',
    subtitleEn: 'Middle fingers on C and comma (,)',
    lessonIntroPl: 'Lewy palec środkowy schodzi z D na C, a prawy palec środkowy z K na przecinek (,).',
    lessonIntroEn: 'Left middle finger descends from D to C, while right middle finger moves from K to comma (,).',
    newKeys: ['c', ','],
    focusCategories: ['drill', 'words', 'bigrams'],
    requiredTypedChars: 135,
    targetAccuracy: 0.85,
  },
  {
    worldId: 4,
    missionIndex: 3,
    namePl: 'Centrum Pustyni: B oraz N',
    nameEn: 'Desert Core: B and N',
    subtitlePl: 'Dalsze dolne sięgnięcie do B i N',
    subtitleEn: 'Inner lower reach to B and N',
    lessonIntroPl: 'Palce wskazujące sięgają do środka dolnego rzędu: lewy na B, prawy na N.',
    lessonIntroEn: 'Index fingers reach toward the center of the bottom row: left to B, right to N.',
    newKeys: ['b', 'n'],
    focusCategories: ['drill', 'words', 'syllables'],
    requiredTypedChars: 140,
    targetAccuracy: 0.86,
  },
  {
    worldId: 4,
    missionIndex: 4,
    namePl: 'Kropka Taktyczna: X oraz Kropka (.)',
    nameEn: 'Tactical Point: X and Period (.)',
    subtitlePl: 'Palce serdeczne na X oraz kropkę (.)',
    subtitleEn: 'Ring fingers on X and period (.)',
    lessonIntroPl: 'Palce serdeczne schodzą w dół: lewy z S na X, prawy z L na kropkę (.).',
    lessonIntroEn: 'Ring fingers descend: left from S to X, right from L to period (.).',
    newKeys: ['x', '.'],
    focusCategories: ['drill', 'words', 'coordination'],
    requiredTypedChars: 145,
    targetAccuracy: 0.86,
  },
  {
    worldId: 4,
    missionIndex: 5,
    namePl: 'Ostatnie Litery: Z oraz Ukośnik (/)',
    nameEn: 'Final Alphabet Keys: Z and Slash (/)',
    subtitlePl: 'Małe palce na Z oraz /',
    subtitleEn: 'Pinky fingers on Z and /',
    lessonIntroPl: 'Małe palce zamykają dolny rząd klawiszami Z oraz /. Znasz już wszystkie podstawowe litery alfabetu!',
    lessonIntroEn: 'Pinky fingers complete the bottom row with Z and /. You now know every base letter of the alphabet!',
    newKeys: ['z', '/'],
    focusCategories: ['drill', 'words', 'bigrams'],
    requiredTypedChars: 150,
    targetAccuracy: 0.86,
  },
  {
    worldId: 4,
    missionIndex: 6,
    namePl: 'BOSS: Skorpion Pustynny',
    nameEn: 'BOSS: Dune Scorpius',
    subtitlePl: 'Pełne opanowanie trzech rzędów klawiatury',
    subtitleEn: 'Full Three-Row Alphabet Mastery',
    lessonIntroPl: 'Skorpion Pustynny atakuje na czele Czołgów i Rozdzielaczy! Wykorzystaj Wieże Snajperskie i pełny alfabet.',
    lessonIntroEn: 'Dune Scorpius leads Tanks and Splitters! Deploy Sniper Towers and command the full three-row alphabet.',
    newKeys: [],
    focusCategories: ['words', 'bigrams', 'coordination'],
    requiredTypedChars: 165,
    targetAccuracy: 0.86,
  },

  // WORLD 5: Frozen Islands (Words, spaces, consolidation)
  {
    worldId: 5,
    missionIndex: 1,
    namePl: 'Częste Dwuznaki i Sylaby',
    nameEn: 'High-Frequency Bigrams & Syllables',
    subtitlePl: 'Płynne przejścia między sąsiednimi rzędami',
    subtitleEn: 'Smooth transitions across rows',
    lessonIntroPl: 'Ćwicz najczęściej występujące w języku polskim i angielskim połączenia liter (cz, sz, rz, pr, st, nie, pro).',
    lessonIntroEn: 'Practice the most frequent letter combinations and syllables (cz, sz, rz, pr, st, th, ing, pro).',
    newKeys: [],
    focusCategories: ['bigrams', 'syllables', 'words'],
    requiredTypedChars: 150,
    targetAccuracy: 0.86,
  },
  {
    worldId: 5,
    missionIndex: 2,
    namePl: 'Naprzemienny Strumień Dłoni',
    nameEn: 'Alternating Hand Flow',
    subtitlePl: 'Harmonia lewej i prawej ręki',
    subtitleEn: 'Left and right hand harmony',
    lessonIntroPl: 'Gdy jedna dłoń wciska klawisz, druga już przygotowuje się do kolejnego znaku. Buduj wysokie kombo!',
    lessonIntroEn: 'While one hand presses a key, the other prepares for the next character. Build a high combo streak!',
    newKeys: [],
    focusCategories: ['alternation', 'words'],
    requiredTypedChars: 155,
    targetAccuracy: 0.87,
  },
  {
    worldId: 5,
    missionIndex: 3,
    namePl: 'Gimnastyka Zewnętrznych Palców',
    nameEn: 'Outer Finger Agility',
    subtitlePl: 'Wzmocnienie palców serdecznych i małych',
    subtitleEn: 'Strengthening ring and pinky fingers',
    lessonIntroPl: 'Skupiamy się na słowach bogatych w litery A, Z, S, X, W, O, L, P, aby wyrównać sprawność wszystkich palców.',
    lessonIntroEn: 'Focus on words rich in A, Z, S, X, W, O, L, and P to balance the agility of all ten fingers.',
    newKeys: [],
    focusCategories: ['coordination', 'words', 'bigrams'],
    requiredTypedChars: 160,
    targetAccuracy: 0.87,
  },
  {
    worldId: 5,
    missionIndex: 4,
    namePl: 'Długie Słowa Taktyczne',
    nameEn: 'Extended Tactical Vocabulary',
    subtitlePl: 'Słowa wielosylabowe bez utraty rytmu',
    subtitleEn: 'Multi-syllable words with steady rhythm',
    lessonIntroPl: 'Pisz dłuższe wyrazy w równym tempie. Nie przyspieszaj kosztem błędów — celność daje wyższe kombo energii!',
    lessonIntroEn: 'Type longer words at an even pace. Do not rush at the expense of accuracy — precision fuels higher energy combos!',
    newKeys: [],
    focusCategories: ['words', 'syllables'],
    requiredTypedChars: 165,
    targetAccuracy: 0.87,
  },
  {
    worldId: 5,
    missionIndex: 5,
    namePl: 'Rozkazy Polowe i Frazy',
    nameEn: 'Field Commands & Multi-Word Phrases',
    subtitlePl: 'Łączenie słów spacjami w płynne frazy',
    subtitleEn: 'Linking words with spaces into fluent phrases',
    lessonIntroPl: 'Wpisuj dwu- i trzywyrazowe meldunki obronne, utrzymując reaktory w stanie Przeciążenia Bojowego.',
    lessonIntroEn: 'Enter two- and three-word defensive dispatches while keeping your reactors in Combat Overcharge.',
    newKeys: [],
    focusCategories: ['words', 'sentences'],
    requiredTypedChars: 175,
    targetAccuracy: 0.87,
  },
  {
    worldId: 5,
    missionIndex: 6,
    namePl: 'BOSS: Lodowy Lewiatan',
    nameEn: 'BOSS: Cryo Leviathan',
    subtitlePl: 'Egzamin płynności słów i fraz',
    subtitleEn: 'Word and Phrase Fluency Exam',
    lessonIntroPl: 'Lodowy Lewiatan zamraża słabo zasilane wieże! Pisz płynnie pełne frazy, by utrzymać maksymalną moc obrony.',
    lessonIntroEn: 'The Cryo Leviathan chills underpowered towers! Type full phrases smoothly to sustain peak defense output.',
    newKeys: [],
    focusCategories: ['words', 'sentences', 'bigrams'],
    requiredTypedChars: 185,
    targetAccuracy: 0.88,
  },

  // WORLD 6: Ancient Ruins (Polish diacritics: ą, ę, ł, ó, ś, ć, ń, ż, ź)
  {
    worldId: 6,
    missionIndex: 1,
    namePl: 'Samogłoski Nosowe: Ą oraz Ę',
    nameEn: 'Polish Nasal Vowels: Ą and Ę',
    subtitlePl: 'Prawy Alt (AltGr) + A oraz E',
    subtitleEn: 'Right Alt (AltGr) + A and E',
    lessonIntroPl: 'Przytrzymaj prawym kciukiem klawisz AltGr (Prawy Alt) i wciśnij A (ą) lub E (ę) palcami lewej dłoni.',
    lessonIntroEn: 'Hold Right Alt (AltGr) with your right thumb and press A (ą) or E (ę) with your left hand.',
    newKeys: ['ą', 'ę'],
    focusCategories: ['drill', 'diacritics', 'words'],
    requiredTypedChars: 145,
    targetAccuracy: 0.85,
  },
  {
    worldId: 6,
    missionIndex: 2,
    namePl: 'Runy Północy: Ł oraz Ó',
    nameEn: 'Northern Runes: Ł and Ó',
    subtitlePl: 'Prawy Alt (AltGr) + L oraz O',
    subtitleEn: 'Right Alt (AltGr) + L and O',
    lessonIntroPl: 'Klawisze Ł (AltGr + L) oraz Ó (AltGr + O) leżą pod prawym palcem serdecznym. Ćwicz płynną współpracę z kciukiem.',
    lessonIntroEn: 'Keys Ł (AltGr + L) and Ó (AltGr + O) sit under your right ring finger. Practice smooth thumb-ring coordination.',
    newKeys: ['ł', 'ó'],
    focusCategories: ['drill', 'diacritics', 'words'],
    requiredTypedChars: 150,
    targetAccuracy: 0.85,
  },
  {
    worldId: 6,
    missionIndex: 3,
    namePl: 'Miękkie Brzmienia: Ś oraz Ć',
    nameEn: 'Soft Consonants: Ś and Ć',
    subtitlePl: 'Prawy Alt (AltGr) + S oraz C',
    subtitleEn: 'Right Alt (AltGr) + S and C',
    lessonIntroPl: 'Prawy kciuk przytrzymuje AltGr, a lewa dłoń wybiera S (ś) lub C (ć).',
    lessonIntroEn: 'Your right thumb holds AltGr while your left hand presses S (ś) or C (ć).',
    newKeys: ['ś', 'ć'],
    focusCategories: ['drill', 'diacritics', 'words'],
    requiredTypedChars: 155,
    targetAccuracy: 0.86,
  },
  {
    worldId: 6,
    missionIndex: 4,
    namePl: 'Znak Mocy: Ń oraz Ż',
    nameEn: 'Runes of Power: Ń and Ż',
    subtitlePl: 'Prawy Alt (AltGr) + N oraz Z',
    subtitleEn: 'Right Alt (AltGr) + N and Z',
    lessonIntroPl: 'Dodajemy Ń (AltGr + N) oraz Ż (AltGr + Z). Zwróć uwagę na dokładny powrót małego palca z Z na A.',
    lessonIntroEn: 'Adding Ń (AltGr + N) and Ż (AltGr + Z). Focus on returning your left pinky cleanly from Z back to A.',
    newKeys: ['ń', 'ż'],
    focusCategories: ['drill', 'diacritics', 'words'],
    requiredTypedChars: 160,
    targetAccuracy: 0.86,
  },
  {
    worldId: 6,
    missionIndex: 5,
    namePl: 'Ostatni Diakrytyk: Ź (AltGr + X)',
    nameEn: 'Final Diacritic: Ź (AltGr + X)',
    subtitlePl: 'Rozróżnianie Ż (AltGr+Z) oraz Ź (AltGr+X)',
    subtitleEn: 'Distinguishing Ż (AltGr+Z) and Ź (AltGr+X)',
    lessonIntroPl: 'Klawisz Ź wpisujemy kombinacją AltGr + X. Ćwicz słowa zawierające wszystkie dziewięć polskich znaków!',
    lessonIntroEn: 'Type Ź using AltGr + X. Practice authentic Polish words containing all nine diacritical characters!',
    newKeys: ['ź'],
    focusCategories: ['drill', 'diacritics', 'words'],
    requiredTypedChars: 165,
    targetAccuracy: 0.86,
  },
  {
    worldId: 6,
    missionIndex: 6,
    namePl: 'BOSS: Archont Starożytnych Ruin',
    nameEn: 'BOSS: Archon of the Ruins',
    subtitlePl: 'Egzamin z polskich znaków diakrytycznych',
    subtitleEn: 'Polish Diacritics Mastery Exam',
    lessonIntroPl: 'Archont fazuje w zaświaty! Wpisuj bezbłędnie polskie wyrazy z ą, ć, ę, ł, ń, ó, ś, ź, ż, by zasilić detektory.',
    lessonIntroEn: 'The Archon shifts into spectral phase! Accurately type Polish words with diacritics to power your scanners.',
    newKeys: [],
    focusCategories: ['diacritics', 'words', 'sentences'],
    requiredTypedChars: 180,
    targetAccuracy: 0.87,
  },

  // WORLD 7: Industrial City (Capitals, Numbers, Punctuation)
  {
    worldId: 7,
    missionIndex: 1,
    namePl: 'Zasada Przeciwległego Shiftu (A–M)',
    nameEn: 'Opposite-Hand Shift Rule (A–M)',
    subtitlePl: 'Wielkie litery A–M z klawiszem Shift',
    subtitleEn: 'Uppercase letters A–M with Shift',
    lessonIntroPl: 'Aby wpisać wielką literę lewą dłonią, przytrzymaj PRAWY Shift małym palcem prawej dłoni (i odwrotnie!).',
    lessonIntroEn: 'To type an uppercase letter with your left hand, hold RIGHT Shift with your right pinky (and vice versa!).',
    newKeys: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
    focusCategories: ['drill', 'words', 'sentences'],
    requiredTypedChars: 155,
    targetAccuracy: 0.85,
  },
  {
    worldId: 7,
    missionIndex: 2,
    namePl: 'Wielkie Litery N–Z oraz Polskie Nagłówki',
    nameEn: 'Uppercase N–Z & Polish Capitals',
    subtitlePl: 'Pełny zakres wielkich liter i nazw własnych',
    subtitleEn: 'Full uppercase range and proper nouns',
    lessonIntroPl: 'Opanuj wielkie litery N–Z oraz wielkie znaki Ł, Ś, Ż w nazwach miast, kryptonimach i początkach zdań.',
    lessonIntroEn: 'Master uppercase N–Z and Polish capitals Ł, Ś, Ż in city names, callsigns, and sentence openings.',
    newKeys: ['N', 'O', 'P', 'R', 'S', 'T', 'U', 'W', 'Z', 'Ł', 'Ś', 'Ż'],
    focusCategories: ['words', 'diacritics', 'sentences'],
    requiredTypedChars: 160,
    targetAccuracy: 0.86,
  },
  {
    worldId: 7,
    missionIndex: 3,
    namePl: 'Sektor Cyfrowy Lewy: 1, 2, 3, 4, 5',
    nameEn: 'Left Numeric Sector: 1, 2, 3, 4, 5',
    subtitlePl: 'Górny rząd cyfr obsługiwany lewą dłonią',
    subtitleEn: 'Left-hand number row keys 1–5',
    lessonIntroPl: 'Sięgaj z rzędu domowego do cyfr: 1 (mały), 2 (serdeczny), 3 (środkowy), 4 i 5 (wskazujący).',
    lessonIntroEn: 'Reach from the home row to numbers: 1 (pinky), 2 (ring), 3 (middle), 4 and 5 (index).',
    newKeys: ['1', '2', '3', '4', '5'],
    focusCategories: ['drill', 'numbers_symbols', 'words'],
    requiredTypedChars: 160,
    targetAccuracy: 0.85,
  },
  {
    worldId: 7,
    missionIndex: 4,
    namePl: 'Sektor Cyfrowy Prawy: 6, 7, 8, 9, 0',
    nameEn: 'Right Numeric Sector: 6, 7, 8, 9, 0',
    subtitlePl: 'Górny rząd cyfr obsługiwany prawą dłonią',
    subtitleEn: 'Right-hand number row keys 6–0',
    lessonIntroPl: 'Prawa dłoń obsługuje cyfry: 6 i 7 (wskazujący), 8 (środkowy), 9 (serdeczny) oraz 0 (mały palec).',
    lessonIntroEn: 'Your right hand controls numbers: 6 and 7 (index), 8 (middle), 9 (ring), and 0 (pinky).',
    newKeys: ['6', '7', '8', '9', '0'],
    focusCategories: ['drill', 'numbers_symbols', 'words'],
    requiredTypedChars: 165,
    targetAccuracy: 0.85,
  },
  {
    worldId: 7,
    missionIndex: 5,
    namePl: 'Interpunkcja Bojowa: - : ! ?',
    nameEn: 'Tactical Punctuation: - : ! ?',
    subtitlePl: 'Myślnik, dwukropek, wykrzyknik i znak zapytania',
    subtitleEn: 'Hyphen, colon, exclamation, and question mark',
    lessonIntroPl: 'Dodajemy znaki interpunkcyjne niezbędne w raportach taktycznych i pełnych zdaniach.',
    lessonIntroEn: 'Adding punctuation marks essential for tactical reports and complete sentences.',
    newKeys: ['-', ':', '!', '?'],
    focusCategories: ['numbers_symbols', 'sentences'],
    requiredTypedChars: 170,
    targetAccuracy: 0.86,
  },
  {
    worldId: 7,
    missionIndex: 6,
    namePl: 'BOSS: Żelazny Nadzorca Fabryki',
    nameEn: 'BOSS: Iron Foundry Overseer',
    subtitlePl: 'Kody alfanumeryczne, wielkie litery i interpunkcja',
    subtitleEn: 'Alphanumeric codes, capitals, and punctuation',
    lessonIntroPl: 'Żelazny Nadzorca pancerzem odpiera zwykłe ataki! Wpisuj kody sektorów i komendy bojowe bez błędów.',
    lessonIntroEn: 'The Iron Overseer shrugs off unpowered shots! Enter sector codes and combat commands accurately.',
    newKeys: [],
    focusCategories: ['numbers_symbols', 'sentences', 'diacritics'],
    requiredTypedChars: 185,
    targetAccuracy: 0.87,
  },

  // WORLD 8: Final Fortress (Full sentences, accuracy, fluency)
  {
    worldId: 8,
    missionIndex: 1,
    namePl: 'Meldunki Obronne Twierdzy',
    nameEn: 'Fortress Defense Dispatches',
    subtitlePl: 'Pełne zdania z wysoką celnością',
    subtitleEn: 'Complete sentences with high accuracy',
    lessonIntroPl: 'Wpisuj pełne zdania taktyczne. Utrzymuj spokój i precyzję powyżej 88%.',
    lessonIntroEn: 'Type complete tactical sentences. Maintain calm focus and precision above 88%.',
    newKeys: [],
    focusCategories: ['sentences', 'diacritics'],
    requiredTypedChars: 180,
    targetAccuracy: 0.88,
  },
  {
    worldId: 8,
    missionIndex: 2,
    namePl: 'Kodeks Stratega: Przysłowia i Maksymy',
    nameEn: 'Strategist Codex: Proverbs & Maxims',
    subtitlePl: 'Bogate słownictwo i polskie znaki w zdaniach',
    subtitleEn: 'Rich vocabulary and diacritics in full sentences',
    lessonIntroPl: 'Pisz klasyczne maksymy strategiczne i przysłowia wykorzystujące wszystkie strefy klawiatury.',
    lessonIntroEn: 'Type classic strategic maxims and proverbs utilizing every zone of the keyboard.',
    newKeys: [],
    focusCategories: ['sentences', 'diacritics', 'words'],
    requiredTypedChars: 190,
    targetAccuracy: 0.88,
  },
  {
    worldId: 8,
    missionIndex: 3,
    namePl: 'Telemetria Rdzenia КeyFort',
    nameEn: 'KeyFort Core Telemetry',
    subtitlePl: 'Zdania z liczbami, symbolami i nazwami własnymi',
    subtitleEn: 'Sentences combining numbers, symbols, and proper nouns',
    lessonIntroPl: 'Łącz płynne pisanie zdań z precyzyjnym wprowadzaniem danych liczbowych i raportów.',
    lessonIntroEn: 'Combine fluent sentence typing with accurate numeric telemetry and status reports.',
    newKeys: [],
    focusCategories: ['sentences', 'numbers_symbols'],
    requiredTypedChars: 195,
    targetAccuracy: 0.88,
  },
  {
    worldId: 8,
    missionIndex: 4,
    namePl: 'Adaptacyjny Trening Precyzji',
    nameEn: 'Adaptive Precision Drill',
    subtitlePl: 'Skupienie na Twoich najtrudniejszych znakach',
    subtitleEn: 'Targeting your most challenging characters',
    lessonIntroPl: 'Silnik adaptacyjny dobiera sekwencje i zdania wzmacniające Twoje najsłabsze klawisze przed finałem.',
    lessonIntroEn: 'The adaptive engine selects sequences and sentences reinforcing your weakest keys before the finale.',
    newKeys: [],
    focusCategories: ['sentences', 'diacritics', 'bigrams'],
    requiredTypedChars: 205,
    targetAccuracy: 0.89,
  },
  {
    worldId: 8,
    missionIndex: 5,
    namePl: 'Oblężenie Wewnętrznego Bastionu',
    nameEn: 'Siege of the Inner Bastion',
    subtitlePl: 'Przedostatnia próba szybkości i spokoju',
    subtitleEn: 'Penultimate test of composure and fluency',
    lessonIntroPl: 'Elitarne fale wszystkich typów wrogów szturmują Twierdzę! Utrzymuj wysokie kombo i wspieraj wieże.',
    lessonIntroEn: 'Elite waves of all enemy types storm the Fortress! Sustain high combos and empower your towers.',
    newKeys: [],
    focusCategories: ['sentences', 'numbers_symbols', 'diacritics'],
    requiredTypedChars: 215,
    targetAccuracy: 0.89,
  },
  {
    worldId: 8,
    missionIndex: 6,
    namePl: 'FINAŁ: Imperator KeyFort Omega',
    nameEn: 'FINALE: Emperor KeyFort Omega',
    subtitlePl: 'Wielki finał kampanii — Mistrz Klawiatury!',
    subtitleEn: 'Grand Campaign Finale — Master of the Keyboard!',
    lessonIntroPl: 'Imperator KeyFort Omega prowadzi wielofazowy szturm! Wykorzystaj wszystkie 6 typów wież i pełną biegłość pisania bezwzrokowego!',
    lessonIntroEn: 'Emperor KeyFort Omega leads a multi-phase assault! Command all 6 tower types and unleash your full touch-typing mastery!',
    newKeys: [],
    focusCategories: ['sentences', 'numbers_symbols', 'diacritics'],
    requiredTypedChars: 230,
    targetAccuracy: 0.9,
  },
];

function buildWavesForMission(worldId: number, missionIndex: number, globalIndex: number): WaveDefinition[] {
  const isBoss = missionIndex === 6;
  const totalWaves = isBoss ? 5 : 3 + Math.floor((missionIndex - 1) / 2); // 3 to 5 waves per mission keeps missions snappy (3-6 mins)
  const hpMultiplierBase = 0.85 + (globalIndex - 1) * 0.055;
  const waves: WaveDefinition[] = [];

  for (let w = 1; w <= totalWaves; w++) {
    const waveScale = hpMultiplierBase * (1 + (w - 1) * 0.14);
    const groups: WaveSpawnGroup[] = [];

    // Primary group: Scouts or Swarms
    if (worldId === 1) {
      groups.push({
        enemyType: 'scout',
        count: 5 + w * 2 + missionIndex,
        intervalSec: 1.35,
        delayBeforeSec: 0.5,
        hpScale: waveScale,
      });
      if (w >= 2 || missionIndex >= 3) {
        groups.push({
          enemyType: 'tank',
          count: 1 + Math.floor(w / 2),
          intervalSec: 2.8,
          delayBeforeSec: 2.0,
          hpScale: waveScale,
        });
      }
    } else if (worldId === 2) {
      groups.push({
        enemyType: w % 2 === 1 ? 'scout' : 'swarm',
        count: 7 + w * 2 + missionIndex,
        intervalSec: 1.0,
        delayBeforeSec: 0.4,
        hpScale: waveScale,
      });
      if (w >= 2) {
        groups.push({
          enemyType: missionIndex >= 3 ? 'regenerator' : 'tank',
          count: 2 + Math.floor(w / 2),
          intervalSec: 2.5,
          delayBeforeSec: 2.0,
          hpScale: waveScale,
        });
      }
    } else if (worldId === 3) {
      groups.push({
        enemyType: 'shield',
        count: 4 + w + Math.floor(missionIndex / 2),
        intervalSec: 1.6,
        delayBeforeSec: 0.5,
        hpScale: waveScale,
      });
      if (missionIndex >= 2 && w >= 2) {
        groups.push({
          enemyType: 'ghost',
          count: 2 + w,
          intervalSec: 1.9,
          delayBeforeSec: 1.8,
          hpScale: waveScale,
        });
      } else {
        groups.push({
          enemyType: 'swarm',
          count: 8 + w * 2,
          intervalSec: 0.85,
          delayBeforeSec: 1.5,
          hpScale: waveScale,
        });
      }
    } else if (worldId === 4) {
      groups.push({
        enemyType: 'splitter',
        count: 3 + w + Math.floor(missionIndex / 2),
        intervalSec: 1.9,
        delayBeforeSec: 0.5,
        hpScale: waveScale,
      });
      groups.push({
        enemyType: w % 2 === 0 ? 'tank' : 'shield',
        count: 3 + w,
        intervalSec: 2.1,
        delayBeforeSec: 2.0,
        hpScale: waveScale,
      });
    } else {
      // Worlds 5..8: rich tactical mix
      const pool: EnemyType[] = ['scout', 'swarm', 'shield', 'tank', 'ghost', 'splitter', 'regenerator'];
      const primary = pool[(globalIndex + w) % pool.length];
      const secondary = pool[(globalIndex + w + 2) % pool.length];
      groups.push({
        enemyType: primary,
        count: primary === 'swarm' ? 12 + w * 3 : 6 + w * 2,
        intervalSec: primary === 'swarm' ? 0.75 : 1.35,
        delayBeforeSec: 0.5,
        hpScale: waveScale,
      });
      groups.push({
        enemyType: secondary,
        count: secondary === 'tank' ? 3 + Math.floor(w / 2) : 5 + w,
        intervalSec: 1.8,
        delayBeforeSec: 2.0,
        hpScale: waveScale,
      });
    }

    if (isBoss && w === totalWaves) {
      groups.push({
        enemyType: 'boss',
        count: 1,
        intervalSec: 4.0,
        delayBeforeSec: 3.0,
        hpScale: 0.85 + worldId * 0.25,
        bossWorldId: worldId,
      });
    }

    waves.push({
      waveNumber: w,
      groups,
      bonusGold: 45 + w * 12 + worldId * 6,
      isBossWave: isBoss && w === totalWaves,
    });
  }

  return waves;
}

const THEME_BY_WORLD: Record<number, string> = {
  1: 'green_valley',
  2: 'dark_forest',
  3: 'mountain_pass',
  4: 'desert_outpost',
  5: 'frozen_islands',
  6: 'ancient_ruins',
  7: 'industrial_city',
  8: 'final_fortress',
};

export const MISSIONS_DATA: MissionDefinition[] = (() => {
  const cumulativeKeys = new Set<string>();
  const result: MissionDefinition[] = [];

  MISSION_SPECS.forEach((spec, idx) => {
    const globalIndex = idx + 1;
    for (const k of spec.newKeys) {
      cumulativeKeys.add(k);
    }
    const allowedKeys = Array.from(cumulativeKeys);
    const themePrefix = THEME_BY_WORLD[spec.worldId];
    const mapVariant = spec.missionIndex % 2 === 1 ? '1' : '2';
    const mapId = `${themePrefix}_${mapVariant}`;

    result.push({
      id: `w${spec.worldId}_m${spec.missionIndex}`,
      worldId: spec.worldId,
      missionIndex: spec.missionIndex,
      globalIndex,
      namePl: spec.namePl,
      nameEn: spec.nameEn,
      subtitlePl: spec.subtitlePl,
      subtitleEn: spec.subtitleEn,
      lessonIntroPl: spec.lessonIntroPl,
      lessonIntroEn: spec.lessonIntroEn,
      mapId,
      newKeys: [...spec.newKeys],
      allowedKeys,
      focusCategories: spec.focusCategories,
      requiredTypedChars: spec.requiredTypedChars,
      targetAccuracy: spec.targetAccuracy,
      startingGold: 240 + spec.worldId * 25 + (spec.missionIndex === 6 ? 60 : 0),
      startingLives: 20,
      waves: buildWavesForMission(spec.worldId, spec.missionIndex, globalIndex),
      isBossMission: spec.missionIndex === 6,
    });
  });

  return result;
})();

export function getMissionById(missionId: string): MissionDefinition | undefined {
  return MISSIONS_DATA.find((m) => m.id === missionId);
}

export function getMissionsByWorld(worldId: number): MissionDefinition[] {
  return MISSIONS_DATA.filter((m) => m.worldId === worldId);
}

/**
 * Curated bank of authentic Polish and English words, syllables, diacritic words,
 * alphanumeric codes, and complete sentences.
 * The AdaptiveLearningEngine strictly filters every candidate against mission.allowedKeys
 * so no unlearned character can EVER appear!
 */
export const REAL_WORDS_PL: string[] = [
  // Home row words (a, s, d, f, g, h, j, k, l)
  'las', 'sala', 'fala', 'dala', 'lada', 'kasa', 'lalka', 'skala', 'flaga', 'hak', 'hala', 'kajak',
  'klasa', 'gad', 'sad', 'lak', 'kask', 'fasada', 'alga', 'saga', 'gala', 'daga', 'gafa', 'halka', 'laska', 'jad',
  // Home + Top row: + e, i
  'aleja', 'ile', 'klej', 'lej', 'kij', 'idea', 'lek', 'elf', 'figa', 'siedli', 'dali', 'jaki', 'sklej', 'lili',
  // Home + Top row: + r, u
  'mur', 'kura', 'rura', 'furia', 'iskra', 'kruk', 'druk', 'kier', 'ser', 'dar', 'gra', 'kra', 'figura', 'ulga', 'drugi',
  // Home + Top row: + w, o
  'woda', 'oko', 'pole', 'droga', 'krowa', 'sowa', 'worek', 'wioska', 'skok', 'krok', 'wrogowie', 'osada', 'odwaga', 'wojsko',
  // Home + Top row: + t, y, q, p
  'fort', 'wiatr', 'laser', 'radar', 'pilot', 'stal', 'port', 'krew', 'trop', 'atak', 'tytan',
  'reaktor', 'sektor', 'system', 'eskorta', 'orbita', 'rakieta', 'pasek', 'piasek', 'stopa', 'wyspa', 'grupa',
  'lupa', 'kopia', 'patrol', 'ekipa', 'kropka', 'potok', 'optyka', 'sterta', 'krytyk', 'lot', 'kot', 'tor', 'styl', 'gryf',
  // Lower row additions: + v, m, c, b, n, x, z
  'most', 'smok', 'alarm', 'impuls', 'rama', 'mapa', 'motor', 'armia', 'plama', 'forma', 'rytm', 'tama', 'dym', 'prom', 'kompas',
  'moc', 'cel', 'ocena', 'taca', 'praca', 'owoc', 'ulica', 'stolica', 'chmura', 'tarcica',
  'baza', 'noc', 'brama', 'pocisk', 'pancerz', 'kanon', 'snajper', 'obrona', 'niebo', 'energia', 'bunkier', 'antena', 'turbina',
  'twierdza', 'bastion', 'granit', 'pustynia', 'oaza', 'burza', 'piorun', 'komenda', 'wektor', 'matryca', 'legion', 'granica',
  'zamek', 'zwiad', 'tarcza', 'zapas', 'zegar', 'zbroja', 'zwrot', 'zrzut', 'szczyt', 'maszyna', 'rzeka',
  // Polish diacritics: + ą, ę
  'głębia', 'tętent', 'potęga', 'prąd', 'kąt', 'rząd', 'sąd', 'mąka', 'ręka', 'pętla', 'wędka', 'zęby', 'kępka', 'męstwo', 'zwycięstwo', 'piętro', 'księga', 'obręcz',
  // Polish diacritics: + ł, ó
  'wąwóz', 'błysk', 'węzeł', 'łuk', 'strzała', 'król', 'wódz', 'wróg', 'bój', 'stój', 'góra', 'skóra', 'pióro', 'młot',
  'złoto', 'słowo', 'głowa', 'chłód', 'obłok', 'płot', 'szkło', 'oddział', 'sygnał', 'kryształ', 'skład', 'błąd', 'łąka',
  // Polish diacritics: + ś, ć
  'pięść', 'część', 'szybkość', 'celność', 'mądrość', 'święty', 'ćwicz', 'światło', 'świt', 'ślad', 'kość', 'gość', 'liść', 'wieść', 'nić', 'sieć', 'być', 'iść', 'środek', 'pościg',
  // Polish diacritics: + ń, ż, ź
  'żółw', 'źródło', 'śnieżyca', 'płomień', 'gałąź', 'dźwięk', 'żołnierz', 'potężny', 'księżyc', 'życie', 'żelazo',
  'źrebię', 'bądź', 'weź', 'wieża', 'straż', 'mróz', 'śnieg', 'ogień', 'cień', 'koń', 'dłoń', 'broń', 'przystań', 'kamień',
  'pierścień', 'żagiel', 'żar', 'żwir', 'ścieżka', 'źdźbło', 'źrenica', 'groźba', 'kuźnia', 'przyjaźń', 'więź', 'dźwig', 'łódź', 'miedź',
  // Capitalized words
  'KeyFort', 'Polska', 'Warszawa', 'Kraków', 'Gdańsk', 'Wrocław', 'Poznań', 'Omega', 'Alfa', 'Tytan', 'Bastion', 'Cytadela',
];

export const REAL_WORDS_EN: string[] = [
  // Home row words
  'ash', 'all', 'ask', 'add', 'dad', 'fall', 'flask', 'glad', 'hall', 'half', 'jagged', 'lass', 'salad', 'shall', 'flag', 'glass',
  // Home + Top row
  'fire', 'fort', 'gate', 'gear', 'guard', 'hero', 'laser', 'light', 'order', 'power', 'pulse', 'quick', 'radar', 'ridge', 'route',
  'shield', 'spire', 'steel', 'storm', 'surge', 'target', 'tower', 'trail', 'valor', 'watch', 'water', 'world',
  // Full 3-row words
  'armor', 'beacon', 'blast', 'bunker', 'cannon', 'castle', 'charge', 'citadel', 'combat', 'command', 'crystal', 'cyber',
  'defend', 'desert', 'drone', 'energy', 'falcon', 'forest', 'freeze', 'frost', 'matrix', 'missile', 'mortar', 'nexus',
  'orbital', 'outpost', 'plasma', 'quartz', 'reactor', 'rocket', 'sniper', 'spark', 'tactic', 'tesla', 'turret', 'valley', 'victory',
  // Capitalized
  'KeyFort', 'Omega', 'Alpha', 'Sentinel', 'Vanguard', 'Bastion', 'Citadel', 'Apex',
];

export const SYLLABLES_BANK: string[] = [
  'fa', 'ja', 'da', 'ka', 'sa', 'la', 'ha', 'ga', 'fe', 'je', 'de', 'ke', 'se', 'le', 're', 'we',
  'fi', 'ji', 'di', 'ki', 'si', 'li', 'ri', 'wi', 'fo', 'jo', 'do', 'ko', 'so', 'lo', 'ro', 'wo',
  'fu', 'ju', 'du', 'ku', 'su', 'lu', 'ru', 'wu', 'ta', 'te', 'ti', 'to', 'tu', 'pa', 'pe', 'po',
  'ba', 'be', 'bi', 'bo', 'na', 'ne', 'ni', 'no', 'ma', 'me', 'mi', 'mo', 'ca', 'ce', 'za', 'ze',
  'cza', 'sze', 'rze', 'pro', 'sta', 'kra', 'gro', 'tra', 'bra', 'wro', 'zro', 'prz', 'str',
];

export const ALPHANUMERIC_CODES: string[] = [
  'MK-1', 'MK-2', 'Sektor-07', 'Baza-12', 'Kod: 480', 'Fala-10', 'EMP-35', 'Moc: 100!', 'Alarm: 99?',
  'Tytan-01', 'Omega-8', 'Radar: 24', 'Wektor-360', 'Punkt-50', 'Strefa-14', 'Cel: 720', 'Puls-64',
];

export const SENTENCES_PL: string[] = [
  // Home row grammatical phrases
  'fala gasi las',
  'klasa bada las',
  'kajak i fala',
  // Home + Top row grammatical sentences (no bottom row needed)
  'stalowy fort stoi wysoko',
  'eskorta pilnuje starego fortu',
  'patrol pilnuje drogi i portu',
  'wiatr wieje prosto w pole',
  'reaktor ratuje stary sektor',
  // Full 3-row grammatical Polish sentences (naturally diacritic-free for World 5)
  'reaktor zasila nasz sektor obrony',
  'snajper celuje prosto w pancerz wroga',
  'zwiadowca obserwuje daleki horyzont',
  'patrol pilnuje bramy oraz muru twierdzy',
  'silny wiatr wieje prosto z zachodu',
  'zimny front niesie lodowaty wiatr',
  'celny pocisk rozbija tarcze tytana',
  'radar wykrywa szybkie drony w lesie',
  'skieruj laser prosto w centrum grupy',
  'spokojna reka i precyzja daja sukces',
  // Full Polish sentences with diacritics (World 6)
  'strzelaj celnie i chroń rdzeń twierdzy',
  'wieża mrozu spowalnia szybkie roje wrogów',
  'reaktor energii zasila całą linię obrony',
  'potężna wieża mrozu spowalnia wrogów',
  'żołnierze dzielnie bronią wąskiego wąwozu',
  'błyskawica uderza w ciężki pancerz wroga',
  'celność i szybkość budują najwyższą moc',
  'wśród starożytnych ruin płonie jasne źródło',
  // Full sentences with capitals, numbers, and punctuation (World 7 & 8)
  'Spokój i precyzja budują najwyższe kombo!',
  'Zbuduj Wieżę Tesli, aby rozbić tarcze wroga.',
  'Żołnierze bronią wąwozu przed potężną burzą.',
  'Sektor 04 zgłasza gotowość bojową: moc 100%!',
  'Każdy bezbłędny znak wzmacnia pancerz bazy.',
  'Czy snajper namierzył już głównego Tytana?',
  'Pisz bezwzrokowo, patrz na ekran i zwyciężaj!',
  'Oddział Alfa-4 zabezpieczył północny most.',
  'Twierdza KeyFort utrzymuje stabilną barierę: 95%!',
];

export const SENTENCES_EN: string[] = [
  'type with accuracy to power the defense grid',
  'frost towers slow down fast enemy swarms',
  'the energy reactor boosts every nearby turret',
  'Calm focus and precision build the highest combo!',
  'Deploy a Tesla Tower to shatter enemy shields.',
  'Sector 07 reports full readiness: power at 100%!',
  'Sniper railguns eliminate heavy tanks from afar.',
  'Has the orbital laser locked onto the Boss yet?',
  'Keep your fingers on the home row and defend!',
];
