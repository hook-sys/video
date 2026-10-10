// Curated icon catalog for promo motion graphics (source: Lucide, ISC license).
//
// Chosen for what product/marketing videos actually need to show: commerce,
// money, delivery, SaaS/UI, data, security, people, communication and the
// common verticals (health, education, travel, food, property, work…), plus the
// arrows/status marks that carry motion. Directional and "-off/-x" variants are
// mostly left out: rotation and state are animated, not drawn.
//
// To grow the library: add Lucide names here and run `npm run icons:build`.
// A name may appear in more than one category; it is stored once.

export const CATEGORIES = {
  commerce: [
    "shopping-cart", "shopping-bag", "shopping-basket", "store", "handbag", "paper-bag", "tag", "tags",
    "ticket-percent", "percent", "badge-percent", "gift", "receipt", "receipt-text", "barcode", "scan-barcode",
    "qr-code", "scan-qr-code", "package-search", "star", "star-half", "heart", "shirt", "sport-shoe", "gem",
    "crown", "megaphone", "badge-dollar-sign", "sparkles", "shopping-cart", "heart-plus", "store",
  ],
  payments: [
    "credit-card", "wallet", "wallet-cards", "wallet-minimal", "banknote", "coins", "piggy-bank", "landmark",
    "vault", "hand-coins", "dollar-sign", "euro", "pound-sterling", "japanese-yen", "indian-rupee", "bitcoin",
    "circle-dollar-sign", "badge-dollar-sign", "receipt", "calculator", "credit-card-reader", "smartphone-nfc", "nfc",
    "scale", "chart-candlestick", "trending-up", "trending-down", "arrow-right-left", "repeat", "banknote-arrow-up",
    "banknote-arrow-down", "circle-percent", "gavel",
  ],
  delivery: [
    "truck", "truck-electric", "package", "package-open", "package-check", "package-plus", "boxes", "box",
    "container", "warehouse", "forklift", "ship", "ship-cargo", "plane", "plane-takeoff", "plane-landing",
    "map", "map-pin", "map-pinned", "map-pin-check-inside", "map-pin-house", "route", "navigation", "locate-fixed",
    "signpost", "milestone", "door-closed-package", "house", "mailbox", "clock", "timer", "van", "bike", "scooter",
    "motorbike", "hand-platter", "earth", "globe", "compass", "caravan", "fuel",
  ],
  saas_ui: [
    "layout-dashboard", "layout-grid", "layout-list", "layout-template", "layout-panel-top", "app-window",
    "app-window-mac", "panel-left-open", "kanban", "square-kanban", "table", "list", "list-checks", "list-todo",
    "list-filter", "sliders-horizontal", "settings", "cog", "toggle-right", "toggle-left", "search", "funnel",
    "menu", "ellipsis", "grip-vertical", "mouse-pointer", "mouse-pointer-click", "pointer", "hand", "text-cursor-input",
    "form", "square-pen", "pencil", "eraser", "copy", "clipboard", "clipboard-list", "clipboard-check", "save",
    "download", "upload", "share", "share-2", "external-link", "link", "link-2", "refresh-cw", "rotate-ccw",
    "undo", "redo", "maximize", "minimize", "expand", "shrink", "zoom-in", "zoom-out", "plus", "minus", "x",
    "check", "circle-plus", "square-plus", "trash", "archive", "inbox", "bell", "bell-ring", "bell-dot",
    "bookmark", "pin", "eye", "eye-off", "calendar", "calendar-check", "calendar-clock", "calendar-days", "calendar-plus",
    "blocks", "puzzle", "component", "layers", "workflow", "git-branch", "webhook", "plug", "plug-zap", "bot",
    "wand-sparkles", "sparkle", "command", "keyboard", "toggle-right",
  ],
  devices: [
    "monitor", "laptop", "laptop-minimal", "tablet", "smartphone", "tablet-smartphone", "monitor-smartphone",
    "watch", "tv", "tv-minimal", "headphones", "headset", "speaker", "printer", "camera", "webcam", "mouse",
    "keyboard", "gamepad", "cpu", "microchip", "hard-drive", "server", "database", "router", "wifi", "bluetooth",
    "battery-charging", "battery-full", "smartphone-charging", "usb", "cable", "projector", "scan", "touchpad",
  ],
  cloud_dev: [
    "cloud", "cloud-upload", "cloud-download", "cloud-cog", "cloud-check", "cloud-sync", "server", "server-cog",
    "database", "database-zap", "database-backup", "hard-drive-upload", "code", "code-xml", "braces", "terminal",
    "square-terminal", "file-code", "bug", "git-branch", "git-merge", "git-pull-request", "git-commit-horizontal",
    "network", "globe", "globe-lock", "binary", "brain-circuit", "circuit-board", "cpu", "rocket",
    "container", "layers", "variable", "regex", "activity", "gauge",
  ],
  data_analytics: [
    "chart-line", "chart-column", "chart-column-increasing", "chart-bar", "chart-bar-increasing", "chart-pie",
    "chart-area", "chart-spline", "chart-scatter", "chart-network", "chart-no-axes-combined", "chart-gantt",
    "trending-up", "trending-down", "activity", "gauge", "target", "goal", "sigma", "percent", "hash",
    "calculator", "table", "file-spreadsheet", "file-chart-column", "presentation", "square-activity",
    "arrow-up-right", "arrow-down-right", "chart-candlestick", "funnel", "radar",
  ],
  security: [
    "shield", "shield-check", "shield-alert", "shield-lock", "shield-user", "shield-half", "shield-plus", "lock",
    "lock-open", "lock-keyhole", "key", "key-round", "fingerprint-pattern", "scan-face", "scan-eye", "eye",
    "eye-off", "id-card", "badge-check", "user-lock", "file-lock", "folder-lock", "globe-lock", "cctv", "siren",
    "triangle-alert", "octagon-alert", "circle-alert", "ban", "bug", "vault", "door-closed-locked", "earth-lock",
  ],
  people: [
    "user", "users", "user-round", "users-round", "user-plus", "user-check", "user-x", "user-cog", "user-pen",
    "user-search", "user-star", "circle-user", "circle-user-round", "contact", "contact-round", "id-card",
    "id-card-lanyard", "baby", "person-standing", "accessibility", "hand-heart", "handshake", "heart-handshake",
    "face-slightly-smiling", "face-grinning", "face-slightly-frowning", "face-neutral", "thumbs-up", "thumbs-down", "hand-helping", "group", "user-round-check",
    "user-round-plus", "square-user", "venus", "mars",
  ],
  communication: [
    "mail", "mail-open", "mails", "mail-check", "send", "send-horizontal", "inbox", "message-circle",
    "message-square", "messages-square", "message-circle-more", "message-square-text", "message-circle-heart",
    "message-square-quote", "phone", "phone-call", "phone-incoming", "phone-outgoing", "video", "mic", "voicemail",
    "at-sign", "megaphone", "radio", "rss", "bell", "bell-ring", "speech", "languages", "quote", "reply",
    "forward", "share-2", "mic-vocal", "cast", "satellite-dish", "newspaper", "captions", "hash",
  ],
  media_creative: [
    "image", "images", "camera", "video", "film", "clapperboard", "play", "circle-play", "pause", "music",
    "headphones", "mic-vocal", "audio-lines", "palette", "paintbrush", "brush", "pen-tool", "pencil-ruler",
    "shapes", "type", "crop", "scissors", "wand", "wand-sparkles", "sparkles", "aperture", "focus", "frame",
    "layers", "square-play", "gallery-horizontal", "swatch-book", "spray-can",
    "drafting-compass", "highlighter", "sticker", "mic-vocal",
  ],
  files_docs: [
    "file", "file-text", "files", "file-check", "file-plus", "file-search", "file-pen-line", "file-pen",
    "file-image", "file-video-camera", "file-spreadsheet", "file-chart-pie", "file-archive", "file-lock",
    "folder", "folder-open", "folders", "folder-check", "folder-plus", "folder-sync", "folder-kanban",
    "clipboard", "clipboard-check", "clipboard-list", "notebook", "notebook-pen", "notepad-text", "book",
    "book-open", "library", "scroll", "scroll-text", "sticky-note", "signature", "stamp", "paperclip", "printer",
    "archive", "newspaper",
  ],
  status_feedback: [
    "check", "check-check", "circle-check", "circle-check-big", "square-check", "badge-check", "x", "circle-x",
    "circle-alert", "triangle-alert", "info", "circle-question-mark", "loader", "loader-circle", "hourglass",
    "clock", "timer", "zap", "flame", "sparkles", "star", "award", "trophy", "medal", "crown", "party-popper",
    "thumbs-up", "heart", "flag", "bell", "circle-dot", "target", "lightbulb", "rocket", "gauge", "infinity",
  ],
  arrows_flow: [
    "arrow-right", "arrow-left", "arrow-up", "arrow-down", "arrow-up-right", "arrow-down-right", "arrow-right-left",
    "arrow-up-down", "arrow-big-right", "arrow-big-up", "chevron-right", "chevrons-right", "chevron-up",
    "move-right", "move", "corner-down-right", "redo-2", "refresh-cw", "rotate-cw", "repeat", "repeat-2",
    "shuffle", "merge", "split", "git-fork", "workflow", "route", "waypoints", "iteration-cw", "undo-2",
    "trending-up", "circle-arrow-right", "square-arrow-right", "log-in", "log-out", "import", "fast-forward",
    "skip-forward", "step-forward", "orbit", "spline", "network", "share-2",
  ],
  time_planning: [
    "clock", "clock-3", "alarm-clock", "timer", "timer-reset", "hourglass", "calendar", "calendar-days",
    "calendar-check", "calendar-clock", "calendar-range", "calendar-sync", "rotate-ccw-clock", "watch", "sunrise", "sunset",
    "list-todo", "list-checks", "kanban", "milestone", "goal", "flag", "target", "chart-gantt", "gauge",
  ],
  business_work: [
    "briefcase", "briefcase-business", "building", "building-complex", "factory", "landmark", "store", "presentation",
    "handshake", "lightbulb", "target", "trophy", "award", "chart-line", "users", "network", "workflow",
    "scale", "gavel", "file-pen-line", "signature", "badge", "id-card", "clipboard-list", "calendar", "mail",
    "phone", "globe", "rocket", "puzzle", "brain", "graduation-cap", "hard-hat", "wrench", "hammer", "toolbox",
    "construction", "podium", "megaphone", "newspaper",
  ],
  health: [
    "heart-pulse", "activity", "stethoscope", "pill", "pill-bottle", "syringe", "thermometer", "hospital",
    "ambulance", "cross", "bandage", "brain", "dna", "microscope", "test-tube", "flask-conical", "beaker",
    "hand-heart", "heart", "apple", "dumbbell", "bike", "footprints", "bed", "baby", "ear", "eye", "bone",
    "scan-heart", "virus", "shield-plus", "tablets", "salad", "biceps-flexed", "weight",
  ],
  education: [
    "graduation-cap", "school", "book", "book-open", "book-open-text", "library", "notebook", "notebook-pen",
    "pencil", "pen", "ruler", "backpack", "presentation", "lectern", "lightbulb", "brain", "puzzle", "atom",
    "calculator", "globe", "languages", "award", "medal", "trophy", "university", "microscope", "telescope",
    "palette", "music", "shapes", "sigma", "pi",
  ],
  travel_places: [
    "plane", "plane-takeoff", "luggage", "baggage-claim", "map", "map-pin", "compass", "globe", "earth",
    "hotel", "bed-double", "tent", "mountain", "mountain-snow", "tree-palm", "umbrella", "sun", "car", "car-front",
    "bus", "train-front", "tram-front", "ship", "sailboat", "ticket", "tickets-plane", "camera", "castle",
    "landmark", "ferris-wheel", "church", "mosque", "navigation", "fuel", "parking-meter",
  ],
  food_drink: [
    "utensils", "utensils-crossed", "chef-hat", "cooking-pot", "soup", "pizza", "hamburger", "sandwich", "salad",
    "coffee", "cup-soda", "wine", "beer", "martini", "ice-cream-cone", "cake", "cookie", "croissant", "apple",
    "carrot", "cherry", "citrus", "banana", "grape", "egg", "fish", "beef", "drumstick", "milk", "wheat",
    "leafy-green", "donut", "popcorn", "candy", "concierge-bell", "refrigerator", "microwave",
  ],
  home_property: [
    "house", "houses", "building", "building-complex", "hotel", "warehouse", "key", "key-round", "door-open",
    "door-closed", "sofa", "armchair", "bed", "bath", "lamp", "lamp-desk", "fence", "trees", "house-plug",
    "house-wifi", "lightbulb", "plug", "fan", "air-vent", "heater", "washing-machine", "paint-roller", "hammer",
    "wrench", "drill", "ruler", "land-plot", "flower", "shovel",
  ],
  energy_nature: [
    "sun", "moon", "cloud", "cloud-sun", "cloud-rain", "cloud-lightning", "snowflake", "wind", "droplet",
    "droplets", "waves-horizontal", "flame", "zap", "leaf", "sprout", "tree-deciduous", "tree-pine", "trees", "flower",
    "flower-2", "recycle", "solar-panel", "battery", "battery-charging", "plug-zap", "wind-arrow-down", "globe",
    "earth", "mountain", "rainbow", "thermometer", "sunrise", "factory", "atom", "ev-charger", "fuel",
  ],
  transport: [
    "car", "car-front", "car-taxi-front", "bus", "bus-front", "truck", "van", "bike", "scooter", "motorbike",
    "train-front", "tram-front", "plane", "helicopter", "ship", "sailboat", "rocket", "drone", "tractor",
    "forklift", "fuel", "ev-charger", "parking-meter", "traffic-cone", "road", "route", "navigation", "signpost",
    "map-pin", "circle-parking",
  ],
  sports_fun: [
    "trophy", "medal", "award", "dumbbell", "bike", "volleyball", "goal", "target", "flag", "timer", "gamepad",
    "gamepad-2", "dices", "puzzle", "joystick", "party-popper", "gift", "ticket", "music", "guitar", "piano",
    "drum", "headphones", "popcorn", "clapperboard", "film", "tent", "kayak", "fishing-rod", "footprints",
  ],
  nature_animals: [
    "paw-print", "dog", "cat", "bird", "fish", "rabbit", "squirrel", "turtle", "snail", "bug", "feather", "egg",
    "bone", "shell", "flower", "leaf", "sprout", "clover", "shrub",
  ],
  shapes_marks: [
    "circle", "square", "triangle", "hexagon", "pentagon", "octagon", "diamond", "star", "heart", "sparkle",
    "sparkles", "badge", "circle-dot", "dot", "cuboid", "cylinder", "cone", "pyramid", "torus", "box", "boxes",
    "orbit", "infinity", "asterisk", "hash", "at-sign", "ampersand", "plus", "minus", "equal", "percent",
    "squircle", "shapes", "blend", "contrast", "ratio", "grid-2x2", "grid-3x3",
  ],
};
