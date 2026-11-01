export type SportIcon =
  | "activity"
  | "anchor"
  | "award"
  | "circle"
  | "compass"
  | "disc"
  | "droplet"
  | "grid"
  | "map"
  | "monitor"
  | "music"
  | "shield"
  | "sun"
  | "target"
  | "users"
  | "wind";

export const sportCategories = [
  "Team sports",
  "Racket sports",
  "Combat sports",
  "Athletics",
  "Fitness",
  "Aquatic sports",
  "Outdoor & adventure",
  "Precision sports",
  "Winter sports",
  "Motorsports",
  "Dance",
  "Esports",
] as const;

export type SportCategory = (typeof sportCategories)[number];
export type SportRole = "playing" | "following" | "coaching" | "organising";

export type CatalogueSport = {
  id: string;
  name: string;
  category: SportCategory;
  aliases: string[];
  icon: SportIcon;
  popular?: boolean;
  parentId?: string;
  scoreFormat?: string;
  metrics?: SportMetric[];
};

export type SportMetric = {
  id: string;
  label: string;
  unit?: string;
};

const entry = (
  id: string,
  name: string,
  category: SportCategory,
  aliases: string[],
  icon: SportIcon,
  options: Pick<CatalogueSport, "popular" | "parentId" | "scoreFormat" | "metrics"> = {},
): CatalogueSport => ({ id, name, category, aliases, icon, ...options });

export const sportsCatalogue: CatalogueSport[] = [
  entry("football", "Football", "Team sports", ["soccer", "association football"], "activity", { popular: true }),
  entry("futsal", "Futsal", "Team sports", ["indoor football", "five-a-side"], "activity", { popular: true, parentId: "football" }),
  entry("cricket", "Cricket", "Team sports", ["tape ball", "tape-ball cricket"], "target", { popular: true, scoreFormat: "Runs, wickets, and overs", metrics: [{ id: "runs", label: "Runs" }, { id: "wickets", label: "Wickets" }, { id: "overs", label: "Overs" }] }),
  entry("field-hockey", "Field hockey", "Team sports", ["hockey", "grass hockey"], "activity", { popular: true }),
  entry("ice-hockey", "Ice hockey", "Winter sports", ["hockey on ice"], "activity"),
  entry("basketball", "Basketball", "Team sports", ["hoops", "3x3 basketball"], "circle", { popular: true }),
  entry("volleyball", "Volleyball", "Team sports", ["indoor volleyball"], "activity", { popular: true }),
  entry("beach-volleyball", "Beach volleyball", "Team sports", ["beach volley"], "sun", { parentId: "volleyball" }),
  entry("kabaddi", "Kabaddi", "Team sports", ["circle kabaddi", "standard kabaddi"], "users", { popular: true }),
  entry("rugby-union", "Rugby union", "Team sports", ["rugby", "union rugby"], "activity"),
  entry("rugby-league", "Rugby league", "Team sports", ["league rugby"], "activity"),
  entry("rugby-sevens", "Rugby sevens", "Team sports", ["sevens rugby", "7s rugby"], "activity", { parentId: "rugby-union" }),
  entry("american-football", "American football", "Team sports", ["gridiron", "us football"], "shield"),
  entry("canadian-football", "Canadian football", "Team sports", ["canadian gridiron"], "shield"),
  entry("australian-rules-football", "Australian rules football", "Team sports", ["aussie rules", "afl"], "activity"),
  entry("gaelic-football", "Gaelic football", "Team sports", ["irish football"], "activity"),
  entry("hurling", "Hurling", "Team sports", ["irish hurling"], "activity"),
  entry("handball", "Handball", "Team sports", ["team handball", "indoor handball"], "activity"),
  entry("beach-handball", "Beach handball", "Team sports", ["sand handball"], "sun", { parentId: "handball" }),
  entry("baseball", "Baseball", "Team sports", ["hardball"], "target"),
  entry("softball", "Softball", "Team sports", ["fastpitch", "slowpitch"], "target", { parentId: "baseball" }),
  entry("rounders", "Rounders", "Team sports", ["british rounders"], "target", { parentId: "baseball" }),
  entry("netball", "Netball", "Team sports", ["women's netball"], "activity"),
  entry("korfball", "Korfball", "Team sports", ["korf ball"], "activity"),
  entry("ultimate", "Ultimate", "Team sports", ["ultimate frisbee", "ultimate flying disc"], "disc"),
  entry("dodgeball", "Dodgeball", "Team sports", ["dodge ball"], "target"),
  entry("floorball", "Floorball", "Team sports", ["innebandy", "unihockey"], "activity"),
  entry("lacrosse", "Lacrosse", "Team sports", ["field lacrosse"], "activity"),
  entry("water-polo", "Water polo", "Aquatic sports", ["waterpolo"], "droplet"),
  entry("dragon-boat", "Dragon boat", "Aquatic sports", ["dragon boating", "dragonboat"], "anchor"),
  entry("sepak-takraw", "Sepak takraw", "Team sports", ["kick volleyball", "sepak"], "activity"),
  entry("polo", "Polo", "Team sports", ["equestrian polo"], "award"),
  entry("polo-canoe", "Canoe polo", "Aquatic sports", ["kayak polo"], "anchor"),
  entry("bossaball", "Bossaball", "Team sports", ["bossa ball"], "activity"),
  entry("pickleball", "Pickleball", "Racket sports", ["pickle ball"], "circle", { popular: true }),
  entry("badminton", "Badminton", "Racket sports", ["shuttle", "shuttlecock"], "activity", { popular: true }),
  entry("tennis", "Tennis", "Racket sports", ["lawn tennis"], "circle", { popular: true, scoreFormat: "Sets and games", metrics: [{ id: "sets", label: "Sets" }, { id: "games", label: "Games" }] }),
  entry("table-tennis", "Table tennis", "Racket sports", ["ping pong", "ping-pong"], "circle", { popular: true }),
  entry("squash", "Squash", "Racket sports", ["squash racquets"], "circle", { popular: true }),
  entry("padel", "Padel", "Racket sports", ["paddle tennis", "pádel"], "circle"),
  entry("racquetball", "Racquetball", "Racket sports", ["racquet ball"], "circle"),
  entry("platform-tennis", "Platform tennis", "Racket sports", ["paddle tennis platform"], "circle", { parentId: "tennis" }),
  entry("real-tennis", "Real tennis", "Racket sports", ["court tennis", "royal tennis"], "circle", { parentId: "tennis" }),
  entry("soft-tennis", "Soft tennis", "Racket sports", ["japanese soft tennis"], "circle", { parentId: "tennis" }),
  entry("crossminton", "Crossminton", "Racket sports", ["speed badminton", "speedminton"], "activity", { parentId: "badminton" }),
  entry("fencing", "Fencing", "Combat sports", ["sabre", "saber", "épée", "epee", "foil fencing"], "shield"),
  entry("boxing", "Boxing", "Combat sports", ["western boxing", "pugilism"], "shield", { popular: true, scoreFormat: "Rounds and judges' scorecards", metrics: [{ id: "rounds", label: "Rounds" }] }),
  entry("wrestling", "Wrestling", "Combat sports", ["freestyle wrestling", "greco-roman wrestling", "kushti", "pehlwani"], "users", { popular: true }),
  entry("kabaddi-wrestling", "Traditional wrestling", "Combat sports", ["dangal", "kushti wrestling"], "users"),
  entry("judo", "Judo", "Combat sports", ["kodokan judo"], "shield"),
  entry("karate", "Karate", "Combat sports", ["karate-do", "karate kata"], "shield"),
  entry("taekwondo", "Taekwondo", "Combat sports", ["tae kwon do", "tkd"], "shield"),
  entry("muay-thai", "Muay Thai", "Combat sports", ["thai boxing", "thaiboxing"], "shield"),
  entry("kickboxing", "Kickboxing", "Combat sports", ["kick boxing"], "shield"),
  entry("mixed-martial-arts", "Mixed martial arts", "Combat sports", ["mma", "cage fighting"], "shield"),
  entry("brazilian-jiu-jitsu", "Brazilian jiu-jitsu", "Combat sports", ["bjj", "brazilian jiu jitsu"], "shield"),
  entry("jiu-jitsu", "Jujutsu", "Combat sports", ["jujitsu", "japanese jiu-jitsu"], "shield"),
  entry("sambo", "Sambo", "Combat sports", ["combat sambo", "sport sambo"], "shield"),
  entry("savate", "Savate", "Combat sports", ["french boxing", "boxe française"], "shield"),
  entry("sumo", "Sumo", "Combat sports", ["sumo wrestling"], "users"),
  entry("arm-wrestling", "Arm wrestling", "Combat sports", ["armwrestling"], "activity"),
  entry("wushu", "Wushu", "Combat sports", ["kung fu sport", "sanda"], "shield"),
  entry("capoeira", "Capoeira", "Combat sports", ["capoeira regional"], "activity"),
  entry("kendo", "Kendo", "Combat sports", ["japanese fencing"], "shield"),
  entry("athletics", "Athletics", "Athletics", ["track and field", "track & field"], "activity", { popular: true }),
  entry("running", "Running", "Athletics", ["road running", "jogging"], "activity", { popular: true, scoreFormat: "Time over a course distance", metrics: [{ id: "distance", label: "Distance", unit: "km" }, { id: "duration", label: "Duration", unit: "min" }, { id: "pace", label: "Pace", unit: "min/km" }] }),
  entry("trail-running", "Trail running", "Outdoor & adventure", ["fell running"], "map", { parentId: "running" }),
  entry("marathon", "Marathon", "Athletics", ["road marathon"], "activity", { parentId: "running" }),
  entry("race-walking", "Race walking", "Athletics", ["speed walking"], "activity"),
  entry("sprint", "Sprint", "Athletics", ["track sprinting"], "activity", { parentId: "athletics" }),
  entry("middle-distance-running", "Middle-distance running", "Athletics", ["800m running", "1500m running"], "activity", { parentId: "athletics" }),
  entry("long-distance-running", "Long-distance running", "Athletics", ["distance running"], "activity", { parentId: "athletics" }),
  entry("hurdles", "Hurdles", "Athletics", ["hurdling"], "activity", { parentId: "athletics" }),
  entry("steeplechase", "Steeplechase", "Athletics", ["3000m steeplechase"], "activity", { parentId: "athletics" }),
  entry("relay-running", "Relay running", "Athletics", ["track relay"], "activity", { parentId: "athletics" }),
  entry("high-jump", "High jump", "Athletics", ["highjump"], "activity", { parentId: "athletics" }),
  entry("long-jump", "Long jump", "Athletics", ["longjump"], "activity", { parentId: "athletics" }),
  entry("triple-jump", "Triple jump", "Athletics", ["hop step jump"], "activity", { parentId: "athletics" }),
  entry("pole-vault", "Pole vault", "Athletics", ["polevault"], "activity", { parentId: "athletics" }),
  entry("shot-put", "Shot put", "Athletics", ["shotput"], "target", { parentId: "athletics" }),
  entry("discus", "Discus throw", "Athletics", ["discus"], "target", { parentId: "athletics" }),
  entry("javelin", "Javelin throw", "Athletics", ["javelin"], "target", { parentId: "athletics" }),
  entry("hammer-throw", "Hammer throw", "Athletics", ["hammer"], "target", { parentId: "athletics" }),
  entry("decathlon", "Decathlon", "Athletics", ["men's combined events"], "award"),
  entry("heptathlon", "Heptathlon", "Athletics", ["women's combined events"], "award"),
  entry("weightlifting", "Weightlifting", "Fitness", ["olympic weightlifting", "olympic lifting"], "activity", { popular: true, scoreFormat: "Best snatch and clean & jerk totals", metrics: [{ id: "weight", label: "Load", unit: "kg" }, { id: "repetitions", label: "Repetitions" }] }),
  entry("powerlifting", "Powerlifting", "Fitness", ["power lifting"], "activity"),
  entry("bodybuilding", "Bodybuilding", "Fitness", ["body building"], "activity"),
  entry("fitness-training", "Fitness training", "Fitness", ["gym training", "strength training", "functional training"], "activity", { popular: true }),
  entry("crossfit", "CrossFit", "Fitness", ["crossfit training"], "activity"),
  entry("calisthenics", "Calisthenics", "Fitness", ["bodyweight training", "street workout"], "activity"),
  entry("aerobics", "Aerobics", "Fitness", ["aerobic exercise"], "activity"),
  entry("pilates", "Pilates", "Fitness", ["mat pilates"], "activity"),
  entry("yoga", "Yoga", "Fitness", ["yoga practice"], "activity"),
  entry("climbing-fitness", "Climbing", "Outdoor & adventure", ["sport climbing", "rock climbing"], "map"),
  entry("swimming", "Swimming", "Aquatic sports", ["pool swimming"], "droplet", { popular: true }),
  entry("artistic-swimming", "Artistic swimming", "Aquatic sports", ["synchronized swimming", "synchronised swimming"], "droplet", { parentId: "swimming" }),
  entry("diving", "Diving", "Aquatic sports", ["springboard diving", "platform diving"], "droplet"),
  entry("high-diving", "High diving", "Aquatic sports", ["cliff diving"], "droplet", { parentId: "diving" }),
  entry("rowing", "Rowing", "Aquatic sports", ["crew", "sculling"], "anchor"),
  entry("canoe-sprint", "Canoe sprint", "Aquatic sports", ["flatwater canoe"], "anchor"),
  entry("canoe-slalom", "Canoe slalom", "Outdoor & adventure", ["whitewater canoe"], "anchor"),
  entry("kayaking", "Kayaking", "Aquatic sports", ["kayak", "sea kayaking"], "anchor"),
  entry("sailing", "Sailing", "Aquatic sports", ["yachting"], "anchor"),
  entry("surfing", "Surfing", "Aquatic sports", ["shortboard surfing", "longboard surfing"], "wind"),
  entry("windsurfing", "Windsurfing", "Aquatic sports", ["wind surfing"], "wind"),
  entry("kitesurfing", "Kitesurfing", "Aquatic sports", ["kiteboarding", "kite surfing"], "wind"),
  entry("stand-up-paddleboarding", "Stand-up paddleboarding", "Aquatic sports", ["sup", "paddleboarding"], "anchor"),
  entry("open-water-swimming", "Open-water swimming", "Aquatic sports", ["open water swim"], "droplet", { parentId: "swimming" }),
  entry("triathlon", "Triathlon", "Athletics", ["ironman triathlon"], "award"),
  entry("duathlon", "Duathlon", "Athletics", ["run bike run"], "award"),
  entry("orienteering", "Orienteering", "Outdoor & adventure", ["foot orienteering"], "compass"),
  entry("hiking", "Hiking", "Outdoor & adventure", ["trekking", "rambling"], "map"),
  entry("mountaineering", "Mountaineering", "Outdoor & adventure", ["alpinism"], "map"),
  entry("bouldering", "Bouldering", "Outdoor & adventure", ["indoor bouldering"], "map", { parentId: "climbing-fitness" }),
  entry("parkour", "Parkour", "Outdoor & adventure", ["free running", "freerunning"], "activity"),
  entry("cycling", "Cycling", "Outdoor & adventure", ["bicycling", "road cycling"], "activity", { popular: true }),
  entry("mountain-biking", "Mountain biking", "Outdoor & adventure", ["mtb", "mountain bike"], "map", { parentId: "cycling" }),
  entry("bmx", "BMX", "Outdoor & adventure", ["bmx racing", "bmx freestyle"], "activity", { parentId: "cycling" }),
  entry("skateboarding", "Skateboarding", "Outdoor & adventure", ["skate board"], "activity"),
  entry("roller-skating", "Roller skating", "Outdoor & adventure", ["inline skating", "rollerblading"], "activity"),
  entry("scootering", "Scootering", "Outdoor & adventure", ["scooter freestyle"], "activity"),
  entry("archery", "Archery", "Precision sports", ["target archery"], "target", { scoreFormat: "Points by target face and distance", metrics: [{ id: "score", label: "Score", unit: "points" }, { id: "distance", label: "Distance", unit: "m" }] }),
  entry("shooting-sport", "Shooting", "Precision sports", ["sport shooting", "rifle shooting", "pistol shooting"], "target"),
  entry("snooker", "Snooker", "Precision sports", [], "circle", { popular: true }),
  entry("pool", "Pool", "Precision sports", ["billiards", "pocket billiards", "8-ball", "nine-ball"], "circle", { popular: true }),
  entry("carom", "Carom billiards", "Precision sports", ["carom"], "circle"),
  entry("darts", "Darts", "Precision sports", ["dart"], "target"),
  entry("golf", "Golf", "Precision sports", ["mini golf", "putt putt"], "target"),
  entry("bowling", "Bowling", "Precision sports", ["ten-pin bowling"], "target"),
  entry("lawn-bowls", "Lawn bowls", "Precision sports", ["bowls"], "target"),
  entry("curling", "Curling", "Winter sports", ["ice curling"], "target"),
  entry("figure-skating", "Figure skating", "Winter sports", ["ice skating"], "activity"),
  entry("speed-skating", "Speed skating", "Winter sports", ["long track speed skating"], "activity"),
  entry("short-track-speed-skating", "Short track speed skating", "Winter sports", ["short track"], "activity", { parentId: "speed-skating" }),
  entry("alpine-skiing", "Alpine skiing", "Winter sports", ["downhill skiing"], "activity"),
  entry("cross-country-skiing", "Cross-country skiing", "Winter sports", ["nordic skiing"], "activity"),
  entry("freestyle-skiing", "Freestyle skiing", "Winter sports", ["ski freestyle"], "activity"),
  entry("snowboarding", "Snowboarding", "Winter sports", ["snow board"], "activity"),
  entry("biathlon", "Biathlon", "Winter sports", ["ski biathlon"], "award"),
  entry("bobsleigh", "Bobsleigh", "Winter sports", ["bobsled"], "activity"),
  entry("skeleton", "Skeleton", "Winter sports", ["skeleton sled"], "activity"),
  entry("luge", "Luge", "Winter sports", ["sledge"], "activity"),
  entry("speedway", "Speedway", "Motorsports", ["motorcycle speedway"], "activity"),
  entry("motogp", "MotoGP", "Motorsports", ["motorcycle grand prix", "motorbike racing"], "activity"),
  entry("motocross", "Motocross", "Motorsports", ["mx", "dirt bike racing"], "activity"),
  entry("formula-racing", "Formula racing", "Motorsports", ["formula 1", "f1", "formula one"], "activity"),
  entry("rally", "Rally", "Motorsports", ["rally racing", "rallying"], "map"),
  entry("karting", "Karting", "Motorsports", ["go-kart racing", "go kart"], "activity"),
  entry("endurance-racing", "Endurance racing", "Motorsports", ["sports car racing", "le mans"], "activity"),
  entry("drag-racing", "Drag racing", "Motorsports", ["drag racing"], "activity"),
  entry("drifting", "Drifting", "Motorsports", ["drift racing"], "activity"),
  entry("breakdancing", "Breaking", "Dance", ["breakdance", "break dancing"], "music"),
  entry("ballet", "Ballet", "Dance", ["classical ballet"], "music"),
  entry("ballroom-dance", "Ballroom dance", "Dance", ["ballroom", "dancesport"], "music"),
  entry("hip-hop-dance", "Hip-hop dance", "Dance", ["hip hop dance", "street dance"], "music"),
  entry("contemporary-dance", "Contemporary dance", "Dance", ["modern dance"], "music"),
  entry("salsa", "Salsa", "Dance", ["salsa dancing"], "music"),
  entry("wushu-dance", "Dance sport", "Dance", ["competitive dance"], "music"),
  entry("esports", "Esports", "Esports", ["electronic sports", "competitive gaming"], "monitor"),
  entry("sim-racing", "Sim racing", "Esports", ["simulator racing", "virtual motorsport"], "monitor"),
  entry("chess", "Chess", "Precision sports", ["rapid chess", "blitz chess"], "grid"),
  entry("snooker-pool", "Cue sports", "Precision sports", ["cue sport", "billiard sports"], "circle"),
];

export type SportInterest = { sportId: string; role: SportRole };

export function normalizeSportTerm(term: string): string {
  return term.trim().toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findSport(term: string): CatalogueSport | undefined {
  const normalized = normalizeSportTerm(term);
  if (!normalized) return undefined;
  return sportsCatalogue.find((sport) =>
    [sport.id.replace(/-/g, " "), sport.name, ...sport.aliases]
      .some((candidate) => normalizeSportTerm(candidate) === normalized),
  );
}

export function searchSports(text = "", category?: SportCategory): CatalogueSport[] {
  const terms = normalizeSportTerm(text).split(/\s+/).filter(Boolean);
  return sportsCatalogue
    .filter((sport) => {
      if (category && sport.category !== category) return false;
      const haystack = normalizeSportTerm(`${sport.name} ${sport.id.replace(/-/g, " ")} ${sport.aliases.join(" ")}`);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function toggleSportRole(
  interests: SportInterest[],
  sportId: string,
  role: SportRole,
): SportInterest[] {
  const exists = interests.some((interest) => interest.sportId === sportId && interest.role === role);
  if (exists) return interests.filter((interest) => !(interest.sportId === sportId && interest.role === role));
  return [...interests, { sportId, role }];
}

export function getPopularSports(): CatalogueSport[] {
  return sportsCatalogue.filter((sport) => sport.popular).sort((left, right) => left.name.localeCompare(right.name));
}
