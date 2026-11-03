// SmsWeather: reads the current conditions from Open-Meteo for the chosen place and drives the WeatherSky background so the sky
// matches the real weather, time of day, sun and moon. The page content itself (Panchang) is untouched; only the Weather and
// Temperature fields in Sun Telemetry are filled here.
(function () {
  var URL_BASE = "https://api.open-meteo.com/v1/forecast";
  var $ = function (id) { return document.getElementById(id); };
  var model = null, sky = null, refreshTimer = 0, tickTimer = 0, lastLoc = null;

  // WMO weather code -> label and how the sky should look
  function describe(code, cc) {
    var d = { label: "Clear", cloud: 0.05, rain: 0, snow: 0, fog: 0, storm: 0 };
    var set = function (label, o) { d.label = label; for (var k in o) d[k] = o[k]; };
    if (code === 0) set("Sunny", { cloud: 0.04 });
    else if (code === 1) set("Mostly clear", { cloud: 0.2 });
    else if (code === 2) set("Partly cloudy", { cloud: 0.48 });
    else if (code === 3) set("Overcast", { cloud: 0.92 });
    else if (code === 45 || code === 48) set("Fog", { cloud: 0.55, fog: 0.85 });
    else if (code >= 51 && code <= 55) set("Drizzle", { cloud: 0.8, rain: 0.25 + (code - 51) * 0.1 });
    else if (code === 56 || code === 57) set("Freezing drizzle", { cloud: 0.85, rain: 0.3, snow: 0.1 });
    else if (code === 61) set("Light rain", { cloud: 0.85, rain: 0.4 });
    else if (code === 63) set("Rain", { cloud: 0.92, rain: 0.68 });
    else if (code === 65) set("Heavy rain", { cloud: 1, rain: 0.98 });
    else if (code === 66 || code === 67) set("Freezing rain", { cloud: 0.95, rain: 0.7, snow: 0.1 });
    else if (code === 71) set("Light snow", { cloud: 0.8, snow: 0.35 });
    else if (code === 73) set("Snow", { cloud: 0.9, snow: 0.65 });
    else if (code === 75) set("Heavy snow", { cloud: 1, snow: 0.95 });
    else if (code === 77) set("Snow grains", { cloud: 0.85, snow: 0.4 });
    else if (code === 80) set("Light showers", { cloud: 0.8, rain: 0.45 });
    else if (code === 81) set("Showers", { cloud: 0.9, rain: 0.72 });
    else if (code === 82) set("Violent showers", { cloud: 1, rain: 1 });
    else if (code === 85) set("Snow showers", { cloud: 0.85, snow: 0.5 });
    else if (code === 86) set("Heavy snow showers", { cloud: 1, snow: 0.85 });
    else if (code === 95) set("Thunderstorm", { cloud: 1, rain: 0.8, storm: 1 });
    else if (code === 96 || code === 99) set("Thunderstorm with hail", { cloud: 1, rain: 1, storm: 1 });
    if (typeof cc === "number" && d.cloud < 0.9 && !d.fog) d.cloud = Math.max(d.cloud, Math.min(1, cc / 100) * 0.85);
    return d;
  }

  function minOf(s) { var m = /T(\d\d):(\d\d)/.exec(s || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function localNowMinutes(tz) {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      var h = 0, mi = 0; parts.forEach(function (p) { if (p.type === "hour") h = (+p.value) % 24; if (p.type === "minute") mi = +p.value; });
      return h * 60 + mi;
    } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }

  async function fetchModel(lat, lon) {
    var q = "?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,is_day,weather_code,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&forecast_days=1&wind_speed_unit=kmh";
    var res = await fetch(URL_BASE + q);
    if (!res.ok) throw new Error("weather " + res.status);
    var raw = await res.json();
    var c = raw.current;
    return { tz: raw.timezone, temp: c.temperature_2m, code: c.weather_code, cloud: c.cloud_cover, wind: c.wind_speed_10m, sunrise: raw.daily.sunrise[0], sunset: raw.daily.sunset[0] };
  }

  function updateSky(snap) {
    if (!model || !sky) return;
    var d = describe(model.code, model.cloud);
    var now = localNowMinutes(model.tz), sr = minOf(model.sunrise), ss = minOf(model.sunset);
    if (sr == null || ss == null) { sr = 360; ss = 1080; }
    var elev, cx, cy, prog;
    if (now >= sr && now <= ss) {
      prog = (now - sr) / (ss - sr); elev = Math.sin(Math.PI * prog); cx = 0.12 + 0.76 * prog; cy = 0.775 + 0.045 * elev;
    } else {
      var len = (1440 - ss) + sr, since = now >= ss ? now - ss : now + 1440 - ss;
      prog = Math.min(1, since / len); elev = -Math.sin(Math.PI * prog); cx = 0.12 + 0.76 * prog; cy = 0.775 + 0.045 * Math.abs(elev);
    }
    var moon = window.__panchangMoon;
    sky.set({
      cloud: d.cloud, rain: d.rain, snow: d.snow, fog: d.fog, storm: d.storm,
      elev: elev, celX: cx, celY: cy, wind: Math.min(1, 0.12 + (model.wind || 0) / 45),
      moonFrac: moon && typeof moon.frac === "number" ? moon.frac : 0.6, moonWaxing: moon ? !!moon.waxing : true
    });
    if (snap) sky.snap();
    document.body.dataset.skyKind = (d.rain > 0.2 || d.snow > 0.2) ? "rain" : d.cloud > 0.6 ? "cloud" : "clear";
    document.body.dataset.skyDay = elev >= 0 ? "1" : "0";
  }

  function mountSky() {
    if (sky || !window.WeatherSky) return;
    var cv = $("wxSky"); if (!cv) return;
    sky = window.WeatherSky.mount(cv, {});
  }

  async function load(lat, lon) {
    mountSky();
    lastLoc = { lat: lat, lon: lon };
    var out = { kind: "clear", tempC: null, tzName: null };
    try {
      model = await fetchModel(lat, lon);
      var first = !sky || !sky._seen;
      updateSky(first);
      if (sky) sky._seen = true;
      var d = describe(model.code, model.cloud);
      var pill = $("weatherPill"); if (pill) pill.textContent = "Weather: " + d.label;
      out = { kind: (d.rain > 0.2 || d.snow > 0.2 || d.storm) ? "rain" : d.cloud >= 0.55 ? "cloudy" : "clear", tempC: model.temp, tzName: model.tz };
    } catch (e) {
      if (sky) { var h = new Date().getHours(); var day = h >= 6 && h < 18; sky.set({ cloud: 0.2, rain: 0, snow: 0, fog: 0, storm: 0, elev: day ? 0.7 : -0.7, celX: 0.6, celY: 0.4 }); sky.snap(); }
    }
    clearInterval(tickTimer);
    tickTimer = setInterval(function () { if (!document.hidden) updateSky(false); }, 60000);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { if (lastLoc) load(lastLoc.lat, lastLoc.lon); }, 15 * 60 * 1000);
    return out;
  }

  window.SmsWeather = { load: load, describe: describe, refreshSky: function () { updateSky(false); }, sky: function () { return sky; } };
})();
