const defaultTripData = {
  trip: {
    title: "Spain 2026",
    subtitle: "Thomas and Charlene",
    travelers: 2,
    startDate: "2026-08-10",
    endDate: "2026-08-19",
    timezone: "Europe/Madrid",
    homeBase: "Minneapolis"
  },
  prep: {
    people: [
      { id: "tom", name: "Tom" },
      { id: "charley", name: "Charley" }
    ],
    packing: [],
    todos: [],
    bucketList: []
  },
  places: [],
  items: []
};

const state = {
  data: null,
  prep: null,
  customItems: [],
  supabase: null,
  session: null,
  role: null,
  canEdit: false,
  readOnly: false,
  filters: {
    city: "all",
    type: "all",
    date: "all",
    wishlistOnly: false,
    upcomingOnly: false
  },
  mobileNav: {
    view: "home",
    date: null,
    prepList: null,
    person: null,
    city: null
  }
};

const routeMapItems = new Map();
let routeMapCounter = 0;

const els = {
  title: document.querySelector("#trip-title"),
  subtitle: document.querySelector("#trip-subtitle") || { textContent: "" },
  dateRange: document.querySelector("#date-range") || { textContent: "" },
  routeSummary: document.querySelector("#route-summary") || { textContent: "" },
  nextItem: document.querySelector("#next-item") || { textContent: "" },
  mobileNav: document.querySelector("#mobile-nav"),
  mobileContent: document.querySelector("#mobile-content"),
  cityFilter: document.querySelector("#city-filter"),
  typeFilter: document.querySelector("#type-filter"),
  dateFilter: document.querySelector("#date-filter"),
  wishlistFilter: document.querySelector("#wishlist-filter"),
  upcomingFilter: document.querySelector("#upcoming-filter"),
  statusMessage: document.querySelector("#status-message"),
  timeline: document.querySelector("#timeline"),
  packingPanel: document.querySelector("#packing-panel"),
  packingLists: document.querySelector("#packing-lists"),
  packingForm: document.querySelector("#packing-form"),
  packingPerson: document.querySelector("#packing-person"),
  packingText: document.querySelector("#packing-text"),
  todoPanel: document.querySelector("#todo-panel"),
  todoLists: document.querySelector("#todo-lists"),
  todoForm: document.querySelector("#todo-form"),
  todoPerson: document.querySelector("#todo-person"),
  todoText: document.querySelector("#todo-text"),
  bucketList: document.querySelector("#bucket-list"),
  bucketForm: document.querySelector("#bucket-form"),
  bucketCity: document.querySelector("#bucket-city"),
  bucketText: document.querySelector("#bucket-text"),
  syncStatus: document.querySelector("#sync-status"),
  signinForm: document.querySelector("#signin-form"),
  signinEmail: document.querySelector("#signin-email"),
  signinPassword: document.querySelector("#signin-password"),
  signoutButton: document.querySelector("#signout-button")
};

const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const longFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

init();

async function init() {
  state.data = structuredCloneSafe(defaultTripData);
  normalizeData(state.data);
  loadPrepState();
  await initSupabaseSync();
  applyVisibilityMode();
  bindFilters();
  bindMobileNav();
  bindPrepForms();
  bindAuthControls();
  populateStaticSections();
  render();
}

function normalizeData(data) {
  data.items = (data.items || []).map((item) => ({
    ...item,
    type: item.type || "stop",
    status: item.status || "planned",
    city: item.city || "Unassigned",
    sortDate: parseDate(item.start)
  }));
}

function bindFilters() {
  if (!els.cityFilter || !els.typeFilter || !els.dateFilter) return;
  els.cityFilter.addEventListener("change", () => {
    state.filters.city = els.cityFilter.value;
    render();
  });
  els.typeFilter.addEventListener("change", () => {
    state.filters.type = els.typeFilter.value;
    render();
  });
  els.dateFilter.addEventListener("change", () => {
    state.filters.date = els.dateFilter.value;
    render();
  });
  els.wishlistFilter.addEventListener("change", () => {
    state.filters.wishlistOnly = els.wishlistFilter.checked;
    render();
  });
  els.upcomingFilter.addEventListener("change", () => {
    state.filters.upcomingOnly = els.upcomingFilter.checked;
    render();
  });
}

function bindMobileNav() {
  els.mobileNav?.addEventListener("click", handleMobileNavClick);
  els.mobileContent?.addEventListener("click", handleMobileNavClick);
}

function bindPrepForms() {
  els.packingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.readOnly) return;
    addPrepItem("packing", { person: els.packingPerson.value, text: els.packingText.value });
    els.packingText.value = "";
  });

  els.todoForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.readOnly) return;
    addPrepItem("todos", { person: els.todoPerson.value, text: els.todoText.value });
    els.todoText.value = "";
  });

  els.bucketForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.readOnly) return;
    addPrepItem("bucketList", { city: els.bucketCity.value, text: els.bucketText.value });
    els.bucketText.value = "";
  });
}

function bindAuthControls() {
  els.signinForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.supabase) {
      showStatus("Supabase is not configured yet.");
      return;
    }
    const email = els.signinEmail.value.trim();
    const password = els.signinPassword.value;
    if (!email || !password) return;
    setSyncStatus("Signing in...");
    const { error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSyncStatus(`Sign-in failed: ${error.message}`);
      return;
    }
    els.signinPassword.value = "";
  });

  els.signoutButton?.addEventListener("click", async () => {
    if (!state.supabase) return;
    await state.supabase.auth.signOut();
  });
}

function populateStaticSections() {
  const { trip, items } = state.data;
  els.title.textContent = trip.title;
  els.subtitle.textContent = `${trip.subtitle || "Trip"} · ${trip.travelers || 1} travelers · ${trip.timezone || "local time"}`;
  els.dateRange.textContent = `${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`;
  els.routeSummary.textContent = buildRouteSummary(items);
  els.nextItem.textContent = findNextItem(items)?.title || "Trip complete";

  populateSelect(els.cityFilter, "All cities", unique(items.map((item) => item.city).filter(Boolean)));
  populateSelect(els.dateFilter, "All dates", unique(items.map((item) => dateKey(item.start)).filter(Boolean)), formatDate);
  populatePersonSelects();
  populateBucketCitySelect();
  renderPrepLists();
}

function populateSelect(select, label, values, labeler = (value) => value) {
  if (!select) return;
  select.innerHTML = "";
  select.append(new Option(label, "all"));
  values.forEach((value) => select.append(new Option(labeler(value), value)));
}

function render() {
  const filtered = filteredItems();
  renderTimeline(groupByDate(filtered));
  renderMobileNavigation();
}

function filteredItems() {
  const now = new Date();
  return allItineraryItems()
    .filter((item) => state.filters.city === "all" || item.city === state.filters.city)
    .filter((item) => state.filters.type === "all" || item.type === state.filters.type)
    .filter((item) => state.filters.date === "all" || dateKey(item.start) === state.filters.date)
    .filter((item) => !state.filters.wishlistOnly || item.type === "wishlist" || item.status === "wishlist")
    .filter((item) => !state.filters.upcomingOnly || parseDate(item.end || item.start) >= startOfToday(now))
    .sort(compareItems);
}

function allItineraryItems() {
  return [...(state.data.items || []), ...(state.customItems || [])];
}

function renderTimeline(groups) {
  els.timeline.innerHTML = "";
  const dates = Object.keys(groups).sort();
  if (!dates.length) {
    els.timeline.append(emptyState("No items match these filters."));
  } else {
    dates.forEach((date) => {
      const group = document.createElement("article");
      group.className = "day-group";

      const header = document.createElement("header");
      header.className = "day-header";
      header.innerHTML = `<h2>${escapeHtml(longFormatter.format(parseDate(date)))}</h2><span class="day-count">${groups[date].length} items</span>`;
      group.append(header);

      const list = document.createElement("div");
      list.className = "item-list";
      groups[date].forEach((item) => list.append(renderItem(item)));
      group.append(list);
      els.timeline.append(group);
    });
  }

  if (state.canEdit) els.timeline.append(renderTripItemCreatePanel());
}

function handleMobileNavClick(event) {
  const control = event.target.closest("[data-mobile-view]");
  if (!control) return;
  event.preventDefault();
  state.mobileNav = {
    view: control.dataset.mobileView,
    date: control.dataset.mobileDate || null,
    prepList: control.dataset.mobilePrepList || null,
    person: control.dataset.mobilePerson || null,
    city: control.dataset.mobileCity || null
  };
  renderMobileNavigation();
  els.mobileNav?.scrollIntoView({ block: "start" });
}

function renderMobileNavigation() {
  if (!els.mobileNav || !els.mobileContent) return;
  renderMobileBreadcrumbs();
  els.mobileContent.innerHTML = "";

  const { view } = state.mobileNav;
  if (view === "prep") renderMobilePrep();
  else if (view === "schedule") renderMobileSchedule();
  else if (view === "day") renderMobileDay();
  else if (view === "bucket") renderMobileBucket();
  else if (view === "bucketCity") renderMobileBucketCity();
  else renderMobileHome();
}

function renderMobileBreadcrumbs() {
  const trail = [{ label: "Home", view: "home" }];
  const { view, date, prepList, person, city } = state.mobileNav;
  if (["prep"].includes(view)) trail.push({ label: "Pre-Departure", view: "prep" });
  if (view === "schedule" || view === "day") trail.push({ label: "Daily Schedule", view: "schedule" });
  if (view === "day" && date) trail.push({ label: formatMobileDate(date), view: "day", date });
  if (view === "bucket" || view === "bucketCity") trail.push({ label: "What Else To Do?", view: "bucket" });
  if (view === "bucketCity" && city) trail.push({ label: city, view: "bucketCity", city });
  if (view === "prep" && prepList) {
    const label = prepList === "todos" ? "To-Do" : `${personName(person)} Packing`;
    trail.push({ label, view: "prep", prepList, person });
  }

  els.mobileNav.innerHTML = "";
  const crumbs = document.createElement("div");
  crumbs.className = "breadcrumbs";
  trail.forEach((crumb, index) => {
    const isLast = index === trail.length - 1;
    const crumbEl = document.createElement(isLast ? "span" : "button");
    crumbEl.className = isLast ? "breadcrumb current" : "breadcrumb";
    crumbEl.textContent = crumb.label;
    if (!isLast) applyMobileDataset(crumbEl, crumb);
    crumbs.append(crumbEl);
    if (!isLast) {
      const sep = document.createElement("span");
      sep.className = "breadcrumb-separator";
      sep.textContent = ">";
      crumbs.append(sep);
    }
  });
  els.mobileNav.append(crumbs);
  if (state.session) {
    const auth = document.createElement("div");
    auth.className = "mobile-auth-row";
    const role = document.createElement("span");
    role.textContent = state.canEdit ? "Traveler" : "Guest";
    auth.append(role);
    auth.append(button("Sign out", async () => {
      if (state.supabase) await state.supabase.auth.signOut();
    }));
    els.mobileNav.append(auth);
  }
}

function renderMobileHome() {
  const group = mobileButtonGroup();
  group.append(
    mobileNavButton("Pre-Departure", { view: "prep" }),
    mobileNavButton("Daily Schedule", { view: "schedule" }),
    mobileNavButton("What Else To Do?", { view: "bucket" })
  );
  els.mobileContent.append(group);
}

function renderMobilePrep() {
  const group = mobileButtonGroup();
  group.append(mobileNavButton("To-Do", { view: "prep", prepList: "todos" }));
  personOptions()
    .filter((person) => person.id !== "shared")
    .forEach((person) => group.append(mobileNavButton(`${person.name} Packing`, {
      view: "prep",
      prepList: "packing",
      person: person.id
    })));
  els.mobileContent.append(group);

  const { prepList, person } = state.mobileNav;
  if (!prepList) return;
  const title = prepList === "todos" ? "To-Do" : `${personName(person)} Packing`;
  const items = mobilePrepItems(prepList, person);
  els.mobileContent.append(renderTaskSection(title, items, prepList));
  if (state.canEdit) els.mobileContent.append(renderMobilePrepForm(prepList, person));
}

function renderMobileSchedule() {
  const groups = groupByDate(allItineraryItems().sort(compareItems));
  const dates = Object.keys(groups).sort();
  const group = mobileButtonGroup();
  dates.forEach((date) => {
    group.append(mobileNavButton(formatMobileDate(date), { view: "day", date }, `${groups[date].length} items`));
  });
  els.mobileContent.append(group);
}

function renderMobileDay() {
  const date = state.mobileNav.date;
  const items = allItineraryItems()
    .filter((item) => dateKey(item.start) === date)
    .sort(compareItems);
  if (!items.length) {
    els.mobileContent.append(emptyState("No itinerary items for this date."));
    return;
  }
  const group = document.createElement("article");
  group.className = "day-group mobile-day-detail";
  const list = document.createElement("div");
  list.className = "item-list";
  items.forEach((item) => list.append(renderItem(item)));
  group.append(list);
  els.mobileContent.append(group);
}

function renderMobileBucket() {
  const group = mobileButtonGroup();
  orderedBucketCities().forEach((city) => {
    const count = state.prep.bucketList.filter((item) => item.city === city).length;
    group.append(mobileNavButton(city, { view: "bucketCity", city }, `${count} ideas`));
  });
  els.mobileContent.append(group);
}

function renderMobileBucketCity() {
  const city = state.mobileNav.city;
  const items = state.prep.bucketList.filter((item) => item.city === city);
  els.mobileContent.append(renderTaskSection(city || "Ideas", items, "bucketList"));
  if (state.canEdit) els.mobileContent.append(renderMobilePrepForm("bucketList", null, city));
}

function renderMobilePrepForm(listName, person, city) {
  const form = document.createElement("form");
  form.className = "add-form mobile-add-form";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = listName === "bucketList" ? "Add city idea" : `Add ${listName === "todos" ? "to-do" : "packing"} item`;
  input.setAttribute("aria-label", input.placeholder);
  const submit = document.createElement("button");
  submit.className = "icon-button";
  submit.type = "submit";
  submit.textContent = "Add";
  form.append(input, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (listName === "bucketList") addPrepItem(listName, { city, text });
    else addPrepItem(listName, { person: listName === "todos" ? "shared" : person, text });
    input.value = "";
  });
  return form;
}

function mobilePrepItems(listName, person) {
  const cutoffPassed = beforeCutoffPassed();
  const source = listName === "todos" ? state.prep.todos : state.prep.packing.filter((item) => item.person === person);
  return cutoffPassed ? source.filter((item) => !item.done) : source;
}

function mobileButtonGroup() {
  const group = document.createElement("div");
  group.className = "mobile-button-group";
  return group;
}

function mobileNavButton(label, target, meta = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mobile-nav-button";
  btn.innerHTML = `<span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}`;
  applyMobileDataset(btn, target);
  return btn;
}

function applyMobileDataset(element, target) {
  element.dataset.mobileView = target.view;
  if (target.date) element.dataset.mobileDate = target.date;
  if (target.prepList) element.dataset.mobilePrepList = target.prepList;
  if (target.person) element.dataset.mobilePerson = target.person;
  if (target.city) element.dataset.mobileCity = target.city;
}

function formatMobileDate(date) {
  const formatted = formatter.format(parseDate(date));
  const [weekday, rest] = formatted.split(", ");
  return `${weekday} ${rest || ""}`.trim();
}

function personName(id) {
  return personOptions().find((person) => person.id === id)?.name || "Shared";
}

function renderItem(item) {
  const card = document.createElement("article");
  card.className = "item-card";

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = formatTimeRange(item);

  const main = document.createElement("div");
  main.className = "item-main";

  const top = document.createElement("div");
  top.className = "item-top";
  top.innerHTML = `
    <div>
      <h3 class="item-title">${escapeHtml(item.title)}</h3>
    </div>
  `;

  const expandButton = button("Details", () => {
    card.classList.toggle("expanded");
    expandButton.textContent = card.classList.contains("expanded") ? "Hide" : "Details";
    if (card.classList.contains("expanded")) initVisibleRouteMaps(card);
  });
  top.append(expandButton);

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = summaryText(item);

  const details = document.createElement("div");
  details.className = "details";
  details.append(renderDetails(item));

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const suppressGenericTransportActions = item.type === "transport" && ["flight", "train"].includes(item.mode);
  const hasDistinctRoute = item.type === "transport" && item.origin && item.destination && !sameTransportEndpoint(item);
  const query = item.mapQuery || item.address || item.destination || item.city || item.title;
  if (!suppressGenericTransportActions) {
    actions.append(linkButton("Map", mapUrlForItem(item, query)));
  }
  if (!suppressGenericTransportActions && hasDistinctRoute) {
    actions.append(linkButton("Route", osmDirectionsUrl(item.origin, item.destination)));
  }
  if (!suppressGenericTransportActions && item.address) {
    actions.append(button("Copy address", () => copyText(item.address)));
  } else if (!suppressGenericTransportActions && hasDistinctRoute) {
    actions.append(button("Copy route", () => copyText(`${item.origin || ""} to ${item.destination || ""}`.trim())));
  }
  details.append(actions);

  main.append(top, summary, details);
  card.append(time, main);
  return card;
}

function renderDetails(item) {
  const wrapper = document.createElement("div");
  const details = [
    ["City", item.city],
    ["Operator", item.operator],
    ["Origin", item.origin],
    ["Destination", item.destination],
    ["Address", item.address],
    ["Phone", item.phone],
    ["Confirmation", item.confirmationNumber],
    ["Priority", item.priority],
    ["Starts", formatDateTime(item.start)],
    ["Ends", formatDateTime(item.end)]
  ].filter(([, value]) => value);

  if (details.length) {
    const grid = document.createElement("div");
    grid.className = "detail-grid";
    details.forEach(([label, value]) => {
      const detail = document.createElement("div");
      detail.className = "detail";
      detail.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong>`;
      grid.append(detail);
    });
    wrapper.append(grid);
  }

  if (item.notes?.length) {
    const notes = document.createElement("ul");
    notes.className = "notes";
    item.notes.forEach((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      notes.append(li);
    });
    wrapper.append(notes);
  }

  if (item.type === "transport" && item.originGeo && item.destinationGeo && !sameGeo(item.originGeo, item.destinationGeo)) {
    wrapper.append(renderRouteMap(item));
  }

  if (item.links?.length) {
    const links = document.createElement("div");
    links.className = "link-list";
    item.links.forEach((link) => links.append(linkButton(link.label || "Link", link.url)));
    wrapper.append(links);
  }

  if (state.canEdit) {
    wrapper.append(renderItemEditDisclosure(item));
  }

  return wrapper;
}

function renderRouteMap(item) {
  const map = document.createElement("div");
  map.className = "route-map";
  map.dataset.routePending = "true";
  const mapId = `route-map-${routeMapCounter++}`;
  routeMapItems.set(mapId, item);

  map.innerHTML = `
    <div class="route-map-title">
      <span>${escapeHtml(item.mode || "route")} map</span>
      <small>${escapeHtml(routeMapDescription(item))}</small>
    </div>
    <div id="${mapId}" class="route-map-canvas" role="img" aria-label="${escapeHtml(item.origin)} to ${escapeHtml(item.destination)}"></div>
    <p class="route-map-note"></p>
    <div class="route-map-actions">
      <a href="${osmGeoUrl(item.originGeo)}" target="_blank" rel="noreferrer">Origin</a>
      <a href="${osmGeoUrl(item.destinationGeo)}" target="_blank" rel="noreferrer">Destination</a>
    </div>
  `;
  setTimeout(() => initVisibleRouteMaps(map), 0);
  return map;
}

function initVisibleRouteMaps(root = document) {
  root.querySelectorAll(".route-map[data-route-pending='true']").forEach((wrapper) => {
    const canvas = wrapper.querySelector(".route-map-canvas");
    const note = wrapper.querySelector(".route-map-note");
    if (!canvas || !canvas.offsetParent) return;
    if (!window.L) {
      note.textContent = "Interactive map tiles could not load. Use the origin and destination links below.";
      return;
    }

    const item = routeMapItems.get(canvas.id);
    if (!item) return;
    wrapper.dataset.routePending = "false";

    const leafletMap = L.map(canvas, {
      attributionControl: false,
      scrollWheelZoom: false
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(leafletMap);
    L.control.attribution({ prefix: false }).addTo(leafletMap);

    drawRouteMap(leafletMap, item, note);
    setTimeout(() => leafletMap.invalidateSize(), 80);
  });
}

async function drawRouteMap(leafletMap, item, note) {
  const fallbackCoords = routeCoordinates(item);
  const draw = (coords, className = routeClassName(item)) => {
    const line = L.polyline(coords, {
      className,
      color: routeColor(item),
      weight: item.mode === "flight" ? 5 : 4,
      opacity: 0.88
    }).addTo(leafletMap);
    L.circleMarker(coords[0], routeMarkerOptions("start")).addTo(leafletMap).bindTooltip(item.originGeo.label || item.origin);
    L.circleMarker(coords[coords.length - 1], routeMarkerOptions("end")).addTo(leafletMap).bindTooltip(item.destinationGeo.label || item.destination);
    leafletMap.fitBounds(line.getBounds(), { padding: [18, 18] });
  };

  if (item.routingProfile === "driving") {
    try {
      const coords = await fetchDrivingRoute(item);
      draw(coords, "route-driving");
      note.textContent = "Driving line uses OSRM routing on OpenStreetMap road data.";
      return;
    } catch {
      note.textContent = "Driving route service was unavailable; showing the direct endpoint line instead.";
    }
  } else {
    note.textContent = routeMapDescription(item);
  }

  draw(fallbackCoords);
}

function routeMapDescription(item) {
  if (item.routingProfile === "driving") return "OSM road route when available";
  if (item.mode === "flight") return "approximate great-circle flight path";
  if (item.mode === "train") return item.routeNote || "approximate rail corridor";
  return "endpoint route";
}

function routeCoordinates(item) {
  if (item.routeWaypoints?.length) return item.routeWaypoints.map((point) => [point.lat, point.lon]);
  if (item.mode === "flight") return greatCircleCoordinates(item.originGeo, item.destinationGeo, 48);
  return [[item.originGeo.lat, item.originGeo.lon], [item.destinationGeo.lat, item.destinationGeo.lon]];
}

function sameGeo(a, b) {
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lon - b.lon) < 0.0001;
}

function sameTransportEndpoint(item) {
  if (item.originGeo && item.destinationGeo) return sameGeo(item.originGeo, item.destinationGeo);
  return String(item.origin || "").trim().toLowerCase() === String(item.destination || "").trim().toLowerCase();
}

function mapUrlForItem(item, query) {
  if (item.type === "transport" && item.originGeo) return osmGeoUrl(item.originGeo);
  return osmUrl(query);
}

async function fetchDrivingRoute(item) {
  const endpoints = [item.originGeo, item.destinationGeo]
    .map((point) => `${point.lon},${point.lat}`)
    .join(";");
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${endpoints}?overview=full&geometries=geojson`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`OSRM ${response.status}`);
  const data = await response.json();
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords?.length) throw new Error("No OSRM geometry");
  return coords.map(([lon, lat]) => [lat, lon]);
}

function greatCircleCoordinates(origin, destination, steps) {
  const lat1 = toRad(origin.lat);
  const lon1 = toRad(origin.lon);
  const lat2 = toRad(destination.lat);
  const lon2 = toRad(destination.lon);
  const distance = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));

  if (!distance) return [[origin.lat, origin.lon], [destination.lat, destination.lon]];

  return Array.from({ length: steps + 1 }, (_, index) => {
    const fraction = index / steps;
    const a = Math.sin((1 - fraction) * distance) / Math.sin(distance);
    const b = Math.sin(fraction * distance) / Math.sin(distance);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    return [toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))];
  });
}

function routeClassName(item) {
  if (item.mode === "flight") return "route-flight";
  if (item.mode === "train") return "route-train";
  if (item.routingProfile === "driving" || item.mode === "car") return "route-driving";
  return "route-default";
}

function routeColor(item) {
  if (item.mode === "flight") return "#d5262f";
  if (item.mode === "train") return "#b0522b";
  if (item.routingProfile === "driving" || item.mode === "car") return "#1f6f78";
  return "#687243";
}

function routeMarkerOptions(kind) {
  return {
    radius: 6,
    color: kind === "start" ? "#15535b" : "#b0522b",
    fillColor: "#fffdf8",
    fillOpacity: 1,
    weight: 3
  };
}

async function initSupabaseSync() {
  const config = supabaseConfig();
  state.readOnly = true;
  applyReadOnlyUi();

  if (!config.url || !config.anonKey || !window.supabase?.createClient) {
    setSyncStatus("Local-only. Supabase is not configured yet.");
    state.readOnly = false;
    applyReadOnlyUi();
    return;
  }

  state.supabase = window.supabase.createClient(config.url, config.anonKey);

  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  if (state.session) await loadMembershipRole();
  state.readOnly = !state.canEdit;
  applyReadOnlyUi();
  updateAuthUi();
  if (state.session) await loadRemoteTripDataAndPrep();
  else {
    resetPrepToSeed();
    setSyncStatus("Sign in to view the trip.");
  }

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.role = null;
    state.canEdit = false;
  if (session) await loadMembershipRole();
  state.readOnly = !state.canEdit;
  applyReadOnlyUi();
  applyVisibilityMode();
  updateAuthUi();
  if (session) await loadRemoteTripDataAndPrep();
  else {
    resetPrepToSeed();
    setSyncStatus("Signed out. Sign in to view the trip.");
  }
    renderPrepLists();
    render();
  });
}

async function loadRemoteTripDataAndPrep() {
  await loadRemoteTripItems();
  await loadRemotePrepState();
  populateStaticSections();
  render();
}

async function loadRemoteTripItems() {
  if (!state.supabase || !state.session) return;
  const { data, error } = await state.supabase
    .from("trip_items")
    .select("payload")
    .eq("trip_slug", supabaseConfig().tripSlug)
    .order("sort_start", { ascending: true });

  if (error) {
    setSyncStatus(`Trip itinerary unavailable: ${error.message}`);
    state.data.items = [];
    return;
  }

  state.data.items = (data || []).map((row) => row.payload).filter(Boolean);
  normalizeData(state.data);
}

function supabaseConfig() {
  return {
    url: window.TRIP_SUPABASE_CONFIG?.url || "",
    anonKey: window.TRIP_SUPABASE_CONFIG?.anonKey || "",
    tripSlug: window.TRIP_SUPABASE_CONFIG?.tripSlug || "spain-2026"
  };
}

async function loadMembershipRole() {
  const { data, error } = await state.supabase
    .from("trip_members")
    .select("role")
    .eq("trip_slug", supabaseConfig().tripSlug)
    .single();

  if (error) {
    state.role = null;
    state.canEdit = false;
    setSyncStatus(`Membership unavailable: ${error.message}`);
    return;
  }

  state.role = data?.role || "guest";
  state.canEdit = ["owner", "editor"].includes(state.role);
}

async function loadRemotePrepState() {
  const { data, error } = await state.supabase
    .from("trip_list_items")
    .select("*")
    .eq("trip_slug", supabaseConfig().tripSlug)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    setSyncStatus(`Sync unavailable: ${error.message}`);
    return;
  }

  if (!data.length && state.canEdit) {
    await seedRemotePrepState();
    setSyncStatus("Signed in. Seeded shared trip lists from local defaults.");
    return;
  }

  state.prep = mergePrepState(structuredCloneSafe(state.data.prep || defaultPrepState()), rowsToPrepState(data || []));
  savePrepState();
  await loadRemoteCustomItems();
  setSyncStatus(state.canEdit ? "Signed in. Shared trip lists are synced." : "Signed in as guest. View-only access.");
}

async function loadRemoteCustomItems() {
  if (!state.supabase || !state.session) return;
  const { data, error } = await state.supabase
    .from("trip_itinerary_items")
    .select("*")
    .eq("trip_slug", supabaseConfig().tripSlug)
    .order("start_at", { ascending: true });

  if (error) {
    setSyncStatus(`Itinerary sync unavailable: ${error.message}`);
    return;
  }

  state.customItems = (data || []).map(rowToCustomItem);
  saveCustomItems();
}

async function seedRemotePrepState() {
  const rows = prepRows();
  if (!rows.length) return;
  const { error } = await state.supabase.from("trip_list_items").upsert(rows);
  if (error) setSyncStatus(`Could not seed shared lists: ${error.message}`);
}

function rowsToPrepState(rows) {
  return {
    people: state.data.prep?.people || defaultPrepState().people,
    packing: rows.filter((row) => row.list_name === "packing").map(rowToPrepItem),
    todos: rows.filter((row) => row.list_name === "todos").map(rowToPrepItem),
    bucketList: rows.filter((row) => row.list_name === "bucketList").map(rowToPrepItem)
  };
}

function rowToPrepItem(row) {
  return {
    id: row.id,
    person: row.person,
    city: row.city,
    text: row.text,
    done: row.done,
    isPublic: row.is_public
  };
}

function prepRows() {
  return [
    ...state.prep.packing.map((item, index) => prepRow(item, "packing", index)),
    ...state.prep.todos.map((item, index) => prepRow(item, "todos", index)),
    ...state.prep.bucketList.map((item, index) => prepRow(item, "bucketList", index))
  ];
}

function prepRow(item, listName, index = 0) {
  return {
    id: item.id,
    trip_slug: supabaseConfig().tripSlug,
    list_name: listName,
    person: listName === "bucketList" ? null : item.person,
    city: listName === "bucketList" ? item.city : null,
    text: item.text,
    done: Boolean(item.done),
    is_public: Boolean(item.isPublic ?? listName === "bucketList"),
    sort_order: index
  };
}

async function syncPrepItem(listName, item) {
  if (!state.supabase || !state.session || state.readOnly) return;
  const { error } = await state.supabase.from("trip_list_items").upsert(prepRow(item, listName, prepItemIndex(listName, item.id)));
  if (error) setSyncStatus(`Sync failed: ${error.message}`);
}

async function deleteRemotePrepItem(id) {
  if (!state.supabase || !state.session || state.readOnly) return;
  const { error } = await state.supabase.from("trip_list_items").delete().eq("id", id).eq("trip_slug", supabaseConfig().tripSlug);
  if (error) setSyncStatus(`Delete sync failed: ${error.message}`);
}

async function syncTripItem(item) {
  if (!state.supabase || !state.session || state.readOnly) return false;
  const { error } = await state.supabase.from("trip_items").upsert(tripItemRow(item));
  if (error) {
    setSyncStatus(`Itinerary sync failed: ${error.message}`);
    return false;
  }
  setSyncStatus("Itinerary item saved.");
  return true;
}

async function deleteRemoteTripItem(id) {
  if (!state.supabase || !state.session || state.readOnly) return false;
  const { error } = await state.supabase.from("trip_items").delete().eq("id", id).eq("trip_slug", supabaseConfig().tripSlug);
  if (error) {
    setSyncStatus(`Itinerary delete failed: ${error.message}`);
    return false;
  }
  setSyncStatus("Itinerary item deleted.");
  return true;
}

function tripItemRow(item) {
  return {
    id: item.id,
    trip_slug: supabaseConfig().tripSlug,
    sort_start: item.start,
    payload: item
  };
}

function prepItemIndex(listName, id) {
  return state.prep[listName].findIndex((item) => item.id === id);
}

function updateAuthUi() {
  const signedIn = Boolean(state.session);
  if (els.signinForm) els.signinForm.hidden = signedIn || !state.supabase;
  if (els.signoutButton) els.signoutButton.hidden = !signedIn;
}

function applyReadOnlyUi() {
  [els.packingForm, els.todoForm, els.bucketForm].forEach((el) => {
    if (el) el.hidden = state.readOnly;
  });
}

function applyVisibilityMode() {
  const configured = Boolean(state.supabase);
  const signedIn = Boolean(state.session);
  const locked = configured && !signedIn;
  document.body.classList.toggle("is-private-locked", locked);
  document.body.classList.toggle("is-guest-view", signedIn && !state.canEdit);

  const mainColumn = document.querySelector(".main-column");
  if (mainColumn) mainColumn.hidden = locked;

  document.querySelectorAll("[data-private-content]").forEach((el) => {
    el.hidden = configured && !signedIn;
  });

  document.querySelectorAll("[data-share-content]").forEach((el) => {
    el.hidden = configured && !signedIn;
  });
}

function setSyncStatus(message) {
  if (els.syncStatus) els.syncStatus.textContent = message;
}

function loadPrepState() {
  const seeded = structuredCloneSafe(state.data.prep || defaultPrepState());
  const saved = readLocalJson(prepStorageKey());
  state.prep = mergePrepState(seeded, saved);
  state.customItems = readLocalJson(customItemsStorageKey()) || [];
}

function resetPrepToSeed() {
  state.prep = structuredCloneSafe(state.data.prep || defaultPrepState());
  state.customItems = [];
}

function saveCustomItems() {
  localStorage.setItem(customItemsStorageKey(), JSON.stringify(state.customItems));
}

function customItemsStorageKey() {
  return `trip-custom-items-${state.data.trip?.title || "trip"}`;
}

function defaultPrepState() {
  return {
    people: [
      { id: "tom", name: "Tom" },
      { id: "charley", name: "Charley" }
    ],
    packing: [],
    todos: [],
    bucketList: []
  };
}

function mergePrepState(seeded, saved) {
  if (!saved) return seeded;
  return {
    people: seeded.people?.length ? seeded.people : defaultPrepState().people,
    packing: mergeItems(seeded.packing, saved.packing),
    todos: mergeItems(seeded.todos, saved.todos),
    bucketList: mergeItems(seeded.bucketList, saved.bucketList)
  };
}

function mergeItems(seedItems = [], savedItems = []) {
  const items = new Map();
  seedItems.forEach((item) => items.set(item.id, item));
  savedItems.forEach((item) => items.set(item.id, item));
  return [...items.values()];
}

function savePrepState() {
  localStorage.setItem(prepStorageKey(), JSON.stringify(state.prep));
}

function prepStorageKey() {
  return `trip-prep-${state.data.trip?.title || "trip"}`;
}

function populatePersonSelects() {
  const people = personOptions();
  [els.packingPerson, els.todoPerson].forEach((select) => {
    if (!select) return;
    select.innerHTML = "";
    people.forEach((person) => select.append(new Option(person.name, person.id)));
  });
}

function populateBucketCitySelect() {
  if (!els.bucketCity) return;
  els.bucketCity.innerHTML = "";
  const cities = orderedBucketCities();
  cities.forEach((city) => els.bucketCity.append(new Option(city, city)));
}

function personOptions() {
  const people = state.prep.people || defaultPrepState().people;
  return [...people, { id: "shared", name: "Shared" }];
}

function renderPrepLists() {
  renderBeforeTaskPanel(els.packingPanel, els.packingLists, state.prep.packing, "packing");
  renderBeforeTaskPanel(els.todoPanel, els.todoLists, state.prep.todos, "todos");
  renderCityBucketList();
}

function renderBeforeTaskPanel(panel, container, items, listName) {
  if (!panel || !container) return;
  const cutoffPassed = beforeCutoffPassed();
  const visibleItems = cutoffPassed ? items.filter((item) => !item.done) : items;
  panel.hidden = cutoffPassed && visibleItems.length === 0;
  renderPersonTaskList(container, visibleItems, listName);
}

function renderPersonTaskList(container, items, listName) {
  if (!container) return;
  container.innerHTML = "";
  personOptions().forEach((person) => {
    const personItems = items.filter((item) => item.person === person.id);
    container.append(renderTaskSection(person.name, personItems, listName));
  });
}

function renderCityBucketList() {
  if (!els.bucketList) return;
  els.bucketList.innerHTML = "";
  const cities = orderedBucketCities();
  cities.forEach((city) => {
    const cityItems = state.prep.bucketList.filter((item) => item.city === city);
    els.bucketList.append(renderTaskSection(city, cityItems, "bucketList"));
  });
}

function orderedBucketCities() {
  const cities = unique([
    ...state.data.items.map((item) => item.city).filter(Boolean),
    ...state.prep.bucketList.map((item) => item.city).filter(Boolean)
  ]).filter((city) => !["Minneapolis", "Philadelphia"].includes(city));

  return cities.sort((a, b) => destinationSortKey(a) - destinationSortKey(b) || a.localeCompare(b));
}

function destinationSortKey(city) {
  if (city === "Madrid") return parseDate("2026-08-17T14:00:00").getTime();
  const first = state.data.items
    .filter((item) => item.city === city && item.type !== "transport")
    .sort(compareItems)[0] || state.data.items
      .filter((item) => item.city === city)
      .sort(compareItems)[0];
  return first ? parseDate(first.start).getTime() : Number.MAX_SAFE_INTEGER;
}

function beforeCutoffPassed() {
  return new Date() >= new Date("2026-08-10T20:30:00-04:00");
}

function renderTaskSection(title, items, listName) {
  const section = document.createElement("section");
  section.className = "task-section";
  const doneCount = items.filter((item) => item.done).length;
  section.innerHTML = `<h3>${escapeHtml(title)} <span>${doneCount}/${items.length}</span></h3>`;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "task-empty";
    empty.textContent = "Nothing yet";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "task-list";
  items.forEach((item) => list.append(renderTaskItem(item, listName)));
  section.append(list);
  return section;
}

function renderTaskItem(item, listName) {
  const li = document.createElement("li");
  li.className = item.done ? "task-item done" : "task-item";

  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(item.done);
  checkbox.disabled = state.readOnly;
  checkbox.addEventListener("change", () => updatePrepItem(listName, item.id, { done: checkbox.checked }));
  const text = document.createElement("span");
  text.textContent = item.text;
  label.append(checkbox, text);

  li.append(label);
  if (listName === "bucketList" && state.canEdit) {
    li.append(renderBucketInsertControls(item));
  }
  if (!state.readOnly) {
    const remove = button("Remove", () => removePrepItem(listName, item.id));
    remove.classList.add("danger");
    li.append(remove);
  }
  return li;
}

function addPrepItem(listName, values) {
  const text = values.text?.trim();
  if (!text) return;
  const item = {
    id: `${listName}-${Date.now()}`,
    text,
    done: false
  };
  if (listName === "bucketList") item.city = values.city;
  else item.person = values.person;
  state.prep[listName].push(item);
  savePrepState();
  syncPrepItem(listName, item);
  renderPrepLists();
  renderMobileNavigation();
}

function renderBucketInsertControls(item) {
  return button("Add", () => scheduleBucketItem(item));
}

function scheduleBucketItem(item) {
  if (!state.canEdit) return;
  const start = defaultBucketStart(item.city);
  const custom = {
    id: `itinerary-${Date.now()}`,
    source: "custom",
    type: "stop",
    status: "planned",
    title: item.text,
    city: item.city,
    start,
    end: start,
    summary: `Scheduled from the ${item.city} bucket list.`,
    notes: []
  };
  state.customItems.push(custom);
  saveCustomItems();
  syncCustomItem(custom);
  removePrepItem("bucketList", item.id);
  render();
}

function defaultBucketStart(city) {
  const defaults = {
    Carrizo: "2026-08-12T10:00",
    Leon: "2026-08-12T10:00",
    Sestao: "2026-08-14T10:00",
    Bilbao: "2026-08-14T10:00",
    Zaragoza: "2026-08-16T10:00",
    Madrid: "2026-08-18T10:00"
  };
  return defaults[city] || `${state.data.trip?.startDate || "2026-08-10"}T10:00`;
}

function updatePrepItem(listName, id, changes) {
  let updated = null;
  state.prep[listName] = state.prep[listName].map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...changes };
    return updated;
  });
  savePrepState();
  if (updated) syncPrepItem(listName, updated);
  renderPrepLists();
  renderMobileNavigation();
}

function removePrepItem(listName, id) {
  state.prep[listName] = state.prep[listName].filter((item) => item.id !== id);
  savePrepState();
  deleteRemotePrepItem(id);
  renderPrepLists();
  renderMobileNavigation();
}

function renderTripItemCreatePanel() {
  const panel = document.createElement("article");
  panel.className = "item-card itinerary-create-card";
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = "New";
  const main = document.createElement("div");
  main.className = "item-main";
  const heading = document.createElement("div");
  heading.className = "item-top";
  heading.innerHTML = `<div><h3 class="item-title">Add itinerary item</h3></div>`;
  const reveal = button("Add", () => {
    panel.classList.add("editing");
    reveal.hidden = true;
    form.hidden = false;
    form.elements.title.focus();
  });
  heading.append(reveal);
  const form = renderTripItemForm(newTripItemDraft(), {
    submitLabel: "Add",
    onSubmit: async (draft) => {
      const saved = await syncTripItem(draft);
      if (saved) {
        state.data.items.push(draft);
        normalizeData(state.data);
      }
      populateStaticSections();
      render();
    }
  });
  form.hidden = true;
  main.append(heading, form);
  panel.append(time, main);
  return panel;
}

function renderItemEditDisclosure(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "edit-disclosure";
  const editButton = button("Edit", () => {
    editButton.hidden = true;
    editor.hidden = false;
    wrapper.classList.add("editing");
    editor.querySelector("input, select, textarea")?.focus();
  });
  const editor = item.source === "custom" ? renderCustomItemEditor(item) : renderTripItemEditor(item);
  editor.hidden = true;
  wrapper.append(editButton, editor);
  return wrapper;
}

function renderTripItemEditor(item) {
  return renderTripItemForm(item, {
    submitLabel: "Save itinerary",
    deleteLabel: "Delete itinerary item",
    onSubmit: async (draft) => {
      const saved = await syncTripItem(draft);
      if (saved) {
        state.data.items = state.data.items.map((existing) => existing.id === item.id ? draft : existing);
        normalizeData(state.data);
        populateStaticSections();
        render();
      }
    },
    onDelete: async () => {
      if (!confirm(`Delete "${item.title}" from the base itinerary?`)) return;
      const deleted = await deleteRemoteTripItem(item.id);
      if (deleted) {
        state.data.items = state.data.items.filter((existing) => existing.id !== item.id);
        populateStaticSections();
        render();
      }
    }
  });
}

function renderTripItemForm(item, options) {
  const form = document.createElement("form");
  form.className = "trip-item-form";
  form.innerHTML = `
    <label><span>Title</span><input name="title" type="text" value="${escapeHtml(item.title || "")}" required></label>
    <label><span>City</span><input name="city" type="text" value="${escapeHtml(item.city || "")}" required></label>
    <label><span>Type</span><select name="type"></select></label>
    <label><span>Mode</span><select name="mode"></select></label>
    <label><span>Start</span><input name="start" type="datetime-local" value="${escapeHtml(toDateTimeLocalValue(item.start))}" required></label>
    <label><span>End</span><input name="end" type="datetime-local" value="${escapeHtml(toDateTimeLocalValue(item.end))}"></label>
    <label><span>Status</span><select name="status"></select></label>
    <label><span>Operator</span><input name="operator" type="text" value="${escapeHtml(item.operator || "")}"></label>
    <label><span>Origin</span><input name="origin" type="text" value="${escapeHtml(item.origin || "")}"></label>
    <label><span>Destination</span><input name="destination" type="text" value="${escapeHtml(item.destination || "")}"></label>
    <label><span>Address</span><input name="address" type="text" value="${escapeHtml(item.address || "")}"></label>
    <label><span>Map query</span><input name="mapQuery" type="text" value="${escapeHtml(item.mapQuery || "")}"></label>
    <label><span>Display note</span><input name="displayTimeNote" type="text" value="${escapeHtml(item.displayTimeNote || "")}"></label>
    <label><span>Priority</span><input name="priority" type="text" value="${escapeHtml(item.priority || "")}"></label>
    <label class="wide"><span>Summary</span><textarea name="summary" rows="2">${escapeHtml(item.summary || "")}</textarea></label>
    <label class="wide"><span>Notes</span><textarea name="notes" rows="5">${escapeHtml((item.notes || []).join("\n"))}</textarea></label>
    <div class="form-actions wide">
      <button class="icon-button" type="submit">${escapeHtml(options.submitLabel || "Save")}</button>
    </div>
  `;

  setSelectOptions(form.elements.type, ["transport", "lodging", "stop", "wishlist"], item.type || "stop");
  setSelectOptions(form.elements.mode, ["", "flight", "train", "car", "walk", "transit"], item.mode || "");
  setSelectOptions(form.elements.status, ["confirmed", "planned", "wishlist"], item.status || "planned");

  if (options.onDelete) {
    const deleteButton = button(options.deleteLabel || "Delete", options.onDelete);
    deleteButton.classList.add("danger");
    form.querySelector(".form-actions").append(deleteButton);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onSubmit(tripItemFromForm(item, form));
  });

  return form;
}

function tripItemFromForm(original, form) {
  const draft = { ...original };
  draft.id = original.id || `trip-${Date.now()}`;
  draft.title = form.elements.title.value.trim();
  draft.city = form.elements.city.value.trim();
  draft.type = form.elements.type.value;
  draft.status = form.elements.status.value;
  draft.start = form.elements.start.value;
  draft.end = form.elements.end.value || "";
  draft.summary = form.elements.summary.value.trim();
  draft.notes = form.elements.notes.value.split(/\r?\n/).map((note) => note.trim()).filter(Boolean);
  setOptionalField(draft, "mode", form.elements.mode.value);
  setOptionalField(draft, "operator", form.elements.operator.value);
  setOptionalField(draft, "origin", form.elements.origin.value);
  setOptionalField(draft, "destination", form.elements.destination.value);
  setOptionalField(draft, "address", form.elements.address.value);
  setOptionalField(draft, "mapQuery", form.elements.mapQuery.value);
  setOptionalField(draft, "displayTimeNote", form.elements.displayTimeNote.value);
  setOptionalField(draft, "priority", form.elements.priority.value);
  return draft;
}

function newTripItemDraft() {
  const startDate = state.filters.date !== "all" ? state.filters.date : state.data.trip?.startDate || "2026-08-10";
  const start = `${startDate}T10:00`;
  return {
    id: `trip-${Date.now()}`,
    type: "stop",
    status: "planned",
    title: "",
    city: state.filters.city !== "all" ? state.filters.city : "",
    start,
    end: addMinutesToLocalInput(start, 60),
    summary: "",
    notes: []
  };
}

function setOptionalField(target, key, value) {
  const trimmed = String(value || "").trim();
  if (trimmed) target[key] = trimmed;
  else delete target[key];
}

function setSelectOptions(select, values, selected) {
  select.innerHTML = "";
  values.forEach((value) => select.append(new Option(value || "None", value)));
  select.value = selected;
}

function renderCustomItemEditor(item) {
  const form = document.createElement("form");
  form.className = "custom-item-form";
  form.innerHTML = `
    <input name="title" type="text" value="${escapeHtml(item.title)}" aria-label="Title">
    <select name="city" aria-label="City"></select>
    <input name="start" type="datetime-local" value="${escapeHtml(toDateTimeLocalValue(item.start))}" aria-label="Start">
    <input name="duration" type="number" min="15" step="15" value="${customDurationMinutes(item)}" aria-label="Duration in minutes">
    <button class="icon-button" type="submit">Save</button>
    <button class="icon-button danger" type="button">Delete</button>
  `;
  const citySelect = form.elements.city;
  orderedBucketCities().forEach((city) => citySelect.append(new Option(city, city)));
  citySelect.value = item.city;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateCustomItem(item.id, {
      title: form.elements.title.value.trim() || item.title,
      city: form.elements.city.value,
      start: form.elements.start.value,
      end: addMinutesToLocalInput(form.elements.start.value, Number(form.elements.duration.value || 120))
    });
  });
  form.querySelector("button[type='button']").addEventListener("click", () => removeCustomItem(item.id));
  return form;
}

function updateCustomItem(id, changes) {
  let updated = null;
  state.customItems = state.customItems.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...changes };
    return updated;
  });
  saveCustomItems();
  if (updated) syncCustomItem(updated);
  render();
}

function removeCustomItem(id) {
  state.customItems = state.customItems.filter((item) => item.id !== id);
  saveCustomItems();
  deleteRemoteCustomItem(id);
  render();
}

function rowToCustomItem(row) {
  return {
    id: row.id,
    source: "custom",
    type: row.item_type || "stop",
    status: row.status || "planned",
    title: row.title,
    city: row.city,
    start: row.start_at,
    end: row.end_at,
    summary: row.summary || "",
    notes: row.notes || []
  };
}

function customItemRow(item) {
  return {
    id: item.id,
    trip_slug: supabaseConfig().tripSlug,
    item_type: item.type || "stop",
    status: item.status || "planned",
    title: item.title,
    city: item.city,
    start_at: item.start,
    end_at: item.end,
    summary: item.summary || "",
    notes: item.notes || []
  };
}

async function syncCustomItem(item) {
  if (!state.supabase || !state.session || !state.canEdit) return;
  const { error } = await state.supabase.from("trip_itinerary_items").upsert(customItemRow(item));
  if (error) setSyncStatus(`Itinerary sync failed: ${error.message}`);
}

async function deleteRemoteCustomItem(id) {
  if (!state.supabase || !state.session || !state.canEdit) return;
  const { error } = await state.supabase.from("trip_itinerary_items").delete().eq("id", id).eq("trip_slug", supabaseConfig().tripSlug);
  if (error) setSyncStatus(`Itinerary delete failed: ${error.message}`);
}

function addMinutesToLocalInput(value, minutes) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(date.getMinutes() + minutes);
  return toDateTimeLocalValue(date);
}

function toDateTimeLocalValue(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function customDurationMinutes(item) {
  const minutes = Math.round((parseDate(item.end) - parseDate(item.start)) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 120;
}

function readLocalJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function groupByDate(items) {
  return items.reduce((groups, item) => {
    const key = dateKey(item.start);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

function routeSvgPoints(origin, destination) {
  const width = 360;
  const height = 150;
  const pad = 42;
  const samePoint = Math.abs(origin.lat - destination.lat) < 0.0001 && Math.abs(origin.lon - destination.lon) < 0.0001;
  if (samePoint) {
    return {
      samePoint,
      a: { x: width / 2, y: height / 2, labelX: width / 2 - 42, labelY: height / 2 - 38 },
      b: { x: width / 2, y: height / 2, labelX: width / 2 - 42, labelY: height / 2 + 50 }
    };
  }

  const minLon = Math.min(origin.lon, destination.lon);
  const maxLon = Math.max(origin.lon, destination.lon);
  const minLat = Math.min(origin.lat, destination.lat);
  const maxLat = Math.max(origin.lat, destination.lat);
  const lonSpan = maxLon - minLon || 1;
  const latSpan = maxLat - minLat || 1;

  const project = (point, isEnd) => {
    const x = pad + ((point.lon - minLon) / lonSpan) * (width - pad * 2);
    const y = pad + ((maxLat - point.lat) / latSpan) * (height - pad * 2);
    return {
      x: Math.round(x),
      y: Math.round(y),
      labelX: Math.round(Math.min(Math.max(x + (isEnd ? -86 : 12), 10), width - 120)),
      labelY: Math.round(Math.min(Math.max(y + (isEnd ? 26 : -14), 20), height - 12))
    };
  };

  return {
    samePoint,
    a: project(origin, false),
    b: project(destination, true)
  };
}

function buildRouteSummary(items) {
  const ordered = items.filter((item) => item.type === "transport").sort(compareItems);
  if (!ordered.length) return "No transport yet";
  const first = ordered[0].origin || ordered[0].city;
  const last = ordered[ordered.length - 1].destination || ordered[ordered.length - 1].city;
  return `${first} to ${last}`;
}

function findNextItem(items) {
  const now = new Date();
  return items
    .filter((item) => parseDate(item.end || item.start) >= startOfToday(now))
    .sort(compareItems)[0];
}

function button(label, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-button";
  btn.textContent = label;
  btn.addEventListener("click", handler);
  return btn;
}

function linkButton(label, href) {
  const a = document.createElement("a");
  a.className = "icon-button";
  a.href = href;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = label;
  return a;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showStatus("Copied to clipboard.");
  } catch {
    showStatus(text);
  }
}

function showStatus(message) {
  els.statusMessage.textContent = message;
  els.statusMessage.hidden = false;
}

function emptyState(message) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = message;
  return div;
}

function formatDate(value) {
  if (!value) return "";
  return formatter.format(parseDate(value));
}

function formatDateTime(value) {
  if (!value) return "";
  const date = parseDate(value);
  if (isDateOnly(value)) return longFormatter.format(date);
  return `${longFormatter.format(date)} at ${timeFormatter.format(date)}`;
}

function summaryText(item) {
  const summary = item.summary || "";
  const duration = travelDurationLabel(item);
  const clockChange = clockChangeLabel(item);
  const prefix = [duration, clockChange].filter(Boolean).join("; ");
  if (!prefix) return summary;
  if (!summary) return prefix;
  return `${prefix}, ${lowerFirst(summary)}`;
}

function travelDurationLabel(item) {
  if (item.type !== "transport" || !item.start || !item.end || sameTransportEndpoint(item)) return "";
  if (isDateOnly(item.start) || isDateOnly(item.end)) return "";
  const minutes = Number.isFinite(item.durationMinutes)
    ? item.durationMinutes
    : Math.round((parseDate(item.end) - parseDate(item.start)) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const pieces = [];
  if (hours) pieces.push(`${hours} hr`);
  if (mins) pieces.push(`${mins} min`);
  const noun = item.mode === "flight" ? "flight" : item.mode === "train" ? "ride" : item.mode === "car" ? "drive" : "trip";
  return `~${pieces.join(" ")} ${noun}`;
}

function clockChangeLabel(item) {
  if (item.type !== "transport" || item.mode !== "flight" || !item.clockChangeHours) return "";
  const hours = Math.abs(item.clockChangeHours);
  const unit = hours === 1 ? "hr" : "hrs";
  return item.clockChangeHours > 0 ? `clock +${hours} ${unit}` : `clock -${hours} ${unit}`;
}

function lowerFirst(value) {
  if (!value) return "";
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function formatTimeRange(item) {
  if (!item.start) return "Anytime";
  if (isDateOnly(item.start)) return item.displayTimeNote ? `All day (${item.displayTimeNote})` : "All day";
  const start = timeFormatter.format(parseDate(item.start));
  const note = item.displayTimeNote ? ` (${item.displayTimeNote})` : "";
  if (!item.end || isDateOnly(item.end)) return `${start}${note}`;
  if (dateKey(item.end) !== dateKey(item.start)) return `${start} -> ${formatDate(item.end)} ${timeFormatter.format(parseDate(item.end))}${note}`;
  return `${start} - ${timeFormatter.format(parseDate(item.end))}${note}`;
}

function dateKey(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function parseDate(value) {
  if (!value) return new Date(NaN);
  if (isDateOnly(value)) return new Date(`${value}T12:00:00`);
  return new Date(value);
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compareItems(a, b) {
  return parseDate(a.start) - parseDate(b.start) || String(a.title).localeCompare(String(b.title));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function startOfToday(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function osmUrl(query) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query || "Spain")}`;
}

function osmDirectionsUrl(origin, destination) {
  return `https://www.openstreetmap.org/directions?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}`;
}

function osmGeoUrl(point) {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(point.lat)}&mlon=${encodeURIComponent(point.lon)}#map=12/${encodeURIComponent(point.lat)}/${encodeURIComponent(point.lon)}`;
}

function toRad(value) {
  return value * Math.PI / 180;
}

function toDeg(value) {
  return value * 180 / Math.PI;
}

function escapeSvg(value) {
  return escapeHtml(value).replaceAll("&quot;", "'");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
