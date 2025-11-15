// main.js — полный перевод Processing -> p5.js (WEBGL)

// -----------------------------
// Global state
// -----------------------------
let zoom = 1;
let offsetX = 0;
let offsetZ = 0;

let angleX = Math.PI / 2;
let angleY = 0;

let isTouch = false;

// JSON roots (filled in preload)
let json_alleys_root, json_buildings_root, json_detalised_buildings_root;
let json_fields_root, json_governments_root, json_green_areas_root;
let json_hospitals_root, json_labels_root, json_parkings_root;
let json_railways_root, json_roads_root, json_underlays_root, json_waters_root;

// arrays of objects
let alleys = [];
let buildings = [];
let detalised_buildings = [];
let fields = [];
let governments = [];
let green_areas = [];
let hospitals = [];
let labels = [];
let parkings = [];
let railways = [];
let roads = [];
let underlays = [];
let waters = [];

// Icon cache for label types
let iconCache = {};

// -----------------------------
// Classes
// -----------------------------
class Point {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

class Detail {
  constructor(down_points, up_points) { this.down_points = down_points; this.up_points = up_points; }
}

class ExtendedDetail {
  constructor(points, clr) { this.points = points; this.clr = clr; }
}

class Area {
  constructor(name, points, r, g, b) { this.name = name; this.points = points; this.r = r; this.g = g; this.b = b; }
  show() {
    fill(this.r, this.g, this.b);
    beginShape();
    for (let p of this.points) vertex(p.x, p.y, p.z);
    endShape(CLOSE);
  }
}

class Area3D {
  constructor(address, name, details, r, g, b) { this.address = address; this.name = name; this.details = details; this.r = r; this.g = g; this.b = b; }
  show() {
    fill(this.r, this.g, this.b, 175);
    for (let det of this.details) {
      drawPolygon(det.down_points);
      drawPolygon(det.up_points);
      for (let i = 0; i < det.down_points.length; i++) {
        let p1 = det.down_points[i];
        let p2 = det.down_points[(i + 1) % det.down_points.length];
        let p3 = det.up_points[(i + 1) % det.up_points.length];
        let p4 = det.up_points[i];
        // QUAD -> two triangles
        beginShape(TRIANGLES);
        vertex(p1.x, p1.y, p1.z);
        vertex(p2.x, p2.y, p2.z);
        vertex(p3.x, p3.y, p3.z);
        vertex(p1.x, p1.y, p1.z);
        vertex(p3.x, p3.y, p3.z);
        vertex(p4.x, p4.y, p4.z);
        endShape();
      }
    }
  }
}

class DetalisedArea3D {
  constructor(address, name, details) { this.address = address; this.name = name; this.details = details; }
  show() {
    for (let ed of this.details) {
      if (ed.clr) {
        if (ed.clr.a !== undefined) fill(ed.clr.r, ed.clr.g, ed.clr.b, ed.clr.a);
        else fill(ed.clr.r, ed.clr.g, ed.clr.b);
      }
      beginShape();
      for (let p of ed.points) vertex(p.x, p.y, p.z);
      endShape(CLOSE);
    }
  }
}

function drawPolygon(points) {
  beginShape();
  for (let p of points) vertex(p.x, p.y, p.z);
  endShape(CLOSE);
}

function drawPolyline(pts) {
  if (!pts || pts.length < 2) return;
  strokeWeight(1);
  beginShape(LINES);
  for (let i = 0; i < pts.length - 1; i++) {
    let p1 = pts[i], p2 = pts[i + 1];
    vertex(p1.x, p1.y - 1, p1.z);
    vertex(p2.x, p2.y - 1, p2.z);
  }
  endShape();
  noStroke();
}

class Railway { constructor(points) { this.points = points; } show() { stroke(67,80,109); strokeWeight(1); drawPolyline(this.points); noStroke(); } }
class Building extends Area3D { constructor(address, name, details) { super(address, name, details, 55, 68, 91); } }
class DetalisedBuilding extends DetalisedArea3D { constructor(address, name, details) { super(address, name, details); } }
class Hospital extends Area3D { constructor(address, name, details) { super(address, name, details, 71, 66, 81); } }
class Government extends Area3D { constructor(address, name, details) { super(address, name, details, 54, 64, 96); } }
class GreenArea extends Area { constructor(name, points) { super(name, points, 28, 68, 64); } }
class Field extends Area { constructor(address, name, points) { super(name, points, 42, 85, 80); } }
class Water extends Area { constructor(name, points) { super(name, points, 0, 21, 97); } }
class Road extends Area { constructor(name, points) { super(name, points, 83, 102, 143); } }
class Parking extends Area { constructor(points) { super("", points, 38, 47, 66); } }
class Underlay extends Area { constructor(points) { super("", points, 43, 52, 85); } }
class Alley extends Area { constructor(name, points) { super(name, points, 68, 85, 125); } }

class Label {
  constructor(address, name, type, level, location) {
    this.address = address; this.name = name; this.type = type; this.level = level;
    this.x = location.x; this.y = location.y; this.z = location.z;
    this.icon = null;
    if (type) {
      if (iconCache[type]) this.icon = iconCache[type];
      else {
        // load image and store; loadImage is safe to call outside preload but may flash
        this.icon = loadImage('data/' + type + '.png', img => { iconCache[type] = img; }, err => { /* ignore */ });
      }
    }
    this.clr = this.colorForType(type);
  }
  colorForType(type) {
    switch (type) {
      case "bar": case "fastfood": case "cafe": case "restaurant": return {r:224,g:129,b:58};
      case "church": case "flag": case "police": case "school": case "synagogue": case "post": case "factory": return {r:142,g:145,b:149};
      case "museum": case "landmark": case "theater": return {r:16,g:127,b:116};
      case "hospital": return {r:233,g:121,b:107};
      case "spa": return {r:225,g:116,b:155};
      case "pharmacy": return {r:13,g:160,b:0};
      case "business": case "office": case "barbershop": case "sports": case "hotel": case "bank": return {r:112,g:123,b:230};
      case "shop": case "supermarket": case "hypermarket": case "clothes": case "furniture": case "plants": case "zoo": return {r:12,g:127,b:170};
      case "station": return {r:255,g:255,b:255};
      case "park": case "stadium": return {r:59,g:156,b:88};
      case "metro": return {r:83,g:178,b:62};
      default: return {r:255,g:255,b:255};
    }
  }
  show() {
    // transform to label position in world, then draw 2D-like icon+text without depth testing
    push();
    translate(this.x, this.y, this.z);
    rotateY(-angleY);
    rotateX(-angleX);
    scale(1/zoom);

    // disable depth test
    if (drawingContext && drawingContext.disable) drawingContext.disable(drawingContext.DEPTH_TEST);

    noStroke();
    fill(this.clr.r, this.clr.g, this.clr.b);
    textSize(17);
    textAlign(CENTER, TOP);

    if (zoom >= 2) {
      for (let dx = -0.25; dx <= 0.25; dx += 0.25) {
        for (let dy = -0.25; dy <= 0.25; dy += 0.25) {
          if (dx !== 0 || dy !== 0) {
            push(); translate(dx, dy, 0);
            if (this.icon) text(this.name, 0, this.icon.height - 15); else text(this.name, 0, -15);
            pop();
          }
        }
      }
      if (this.icon) text(this.name, 0, this.icon.height - 15); else text(this.name, 0, -15);
    }

    if (this.icon) {
      imageMode(CENTER);
      image(this.icon, 0, 0, this.icon.width / 1.5, this.icon.height / 1.5);
    }

    if (drawingContext && drawingContext.enable) drawingContext.enable(drawingContext.DEPTH_TEST);

    scale(zoom);
    pop();
  }
}

// -----------------------------
// preload - load JSON and icons referenced in labels
// -----------------------------
function preload() {
  font = loadFont("data/YandexSansText-Medium.ttf");
  // load JSONs
  json_alleys_root = loadJSON('data/alleys.json');
  json_buildings_root = loadJSON('data/buildings.json');
  json_detalised_buildings_root = loadJSON('data/detalised_buildings.json');
  json_fields_root = loadJSON('data/fields.json');
  json_governments_root = loadJSON('data/governments.json');
  json_green_areas_root = loadJSON('data/green_areas.json');
  json_hospitals_root = loadJSON('data/hospitals.json');
  json_labels_root = loadJSON('data/labels.json');
  json_parkings_root = loadJSON('data/parkings.json');
  json_railways_root = loadJSON('data/railways.json');
  json_roads_root = loadJSON('data/roads.json');
  json_underlays_root = loadJSON('data/underlays.json');
  json_waters_root = loadJSON('data/water.json');

  // pre-load icons mentioned in labels.json (if exists)
  try {
    let arr = (json_labels_root && (json_labels_root.labels || json_labels_root)) || [];
    let types = {};
    for (let i = 0; i < arr.length; i++) {
      let t = arr[i].type;
      if (t && !types[t]) {
        types[t] = true;
        // attempt to preload icon; if missing, loadImage will fail silently
        iconCache[t] = loadImage('data/' + t + '.png', img => { iconCache[t] = img; }, err => { delete iconCache[t]; });
      }
    }
  } catch (e) { /* ignore */ }
}

// -----------------------------
// setup
// -----------------------------
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  textFont(font);
  textSize(16);
  textAlign(CENTER, CENTER);
  // parse jsons into objects
  read_json_alleys();
  read_json_buildings();
  read_json_detalised_buildings();
  read_json_fields();
  read_json_governments();
  read_json_green_areas();
  read_json_hospitals();
  read_json_labels();
  read_json_parkings();
  read_json_railways();
  read_json_roads();
  read_json_underlays();
  read_json_waters();
}

// -----------------------------
// draw loop
// -----------------------------
function draw() {
  background(43, 52, 85);

  push();
  translate(0, 100, 0);
  scale(zoom);
  rotateX(angleX);
  rotateY(angleY);
  translate(offsetX, 0, offsetZ);

  drawUnderlays();
  drawGreenAreas();
  drawWaters();
  drawParkings();
  drawAlleys();
  drawRailways();
  drawRoads();
  drawFields();
  drawBuildings();
  drawDetalisedBuildings();
  drawHospitals();
  drawGovernments();

  pop();

  // draw labels last (their show disables depth test internally)
  for (let L of labels) {
    if (L.level <= zoom) L.show();
  }
}

// -----------------------------
// draw layer helpers
// -----------------------------
function drawUnderlays() { for (let u of underlays) u.show && u.show(); }
function drawGreenAreas() { for (let g of green_areas) g.show && g.show(); }
function drawWaters() { for (let w of waters) w.show && w.show(); }
function drawParkings() { for (let p of parkings) p.show && p.show(); }
function drawAlleys() { for (let a of alleys) a.show && a.show(); }
function drawRailways() { for (let r of railways) r.show && r.show(); }
function drawRoads() { for (let r of roads) r.show && r.show(); }
function drawFields() { for (let f of fields) f.show && f.show(); }
function drawBuildings() { for (let b of buildings) b.show && b.show(); }
function drawDetalisedBuildings() { for (let d of detalised_buildings) d.show && d.show(); }
function drawHospitals() { for (let h of hospitals) h.show && h.show(); }
function drawGovernments() { for (let g of governments) g.show && g.show(); }

// -----------------------------
// JSON readers
// (handles both root-array and root-object-with-key cases)
// -----------------------------
function safeArr(root, key) {
  if (!root) return [];
  if (root[key]) return root[key];
  if (Array.isArray(root)) return root;
  // if root is object with unknown shape, try to find first array value
  for (let k in root) if (Array.isArray(root[k])) return root[k];
  return [];
}

function read_json_alleys() {
  let arr = safeArr(json_alleys_root, 'alleys');
  for (let alley of arr) {
    let name = alley.name || "";
    let pts = alley.points || [];
    let points = pts.map(p => new Point(p[0], p[1], p[2]));
    alleys.push(new Alley(name, points));
  }
}

function read_json_buildings() {
  let arr = safeArr(json_buildings_root, 'buildings');
  for (let b of arr) {
    let address = b.address || "";
    let name = b.name || "";
    let json_details = b.details || [];
    let details = [];
    for (let det of json_details) {
      let down = (det.down_points || []).map(p => new Point(p[0], p[1] + 0.01, p[2]));
      let up = (det.up_points || []).map(p => new Point(p[0], p[1], p[2]));
      details.push(new Detail(down, up));
    }
    buildings.push(new Building(address, name, details));
  }
}

function read_json_detalised_buildings() {
  let arr = safeArr(json_detalised_buildings_root, 'detalised_buildings');
  for (let db of arr) {
    let address = db.address || "";
    let name = db.name || "";
    let json_details = db.details || [];
    let details = [];
    for (let det of json_details) {
      let pts = (det.points || []).map(p => new Point(p[0], p[1] + 0.01, p[2]));
      let colorArr = det.color || [100,100,100];
      let clr = { r: colorArr[0], g: colorArr[1], b: colorArr[2] };
      details.push(new ExtendedDetail(pts, clr));
    }
    detalised_buildings.push(new DetalisedBuilding(address, name, details));
  }
}

function read_json_fields() {
  let arr = safeArr(json_fields_root, 'fields');
  for (let f of arr) {
    let address = f.address || "";
    let name = f.name || "";
    let pts = (f.points || []).map(p => new Point(p[0], p[1], p[2]));
    fields.push(new Field(address, name, pts));
  }
}

function read_json_governments() {
  let arr = safeArr(json_governments_root, 'governments');
  for (let g of arr) {
    let address = g.address || "";
    let name = g.name || "";
    let details = [];
    for (let det of (g.details || [])) {
      let down = (det.down_points || []).map(p => new Point(p[0], p[1] + 0.01, p[2]));
      let up = (det.up_points || []).map(p => new Point(p[0], p[1], p[2]));
      details.push(new Detail(down, up));
    }
    governments.push(new Government(address, name, details));
  }
}

function read_json_green_areas() {
  let arr = safeArr(json_green_areas_root, 'green_areas');
  for (let ga of arr) {
    let name = ga.name || "";
    let pts = (ga.points || []).map(p => new Point(p[0], p[1], p[2]));
    green_areas.push(new GreenArea(name, pts));
  }
}

function read_json_hospitals() {
  let arr = safeArr(json_hospitals_root, 'hospitals');
  for (let h of arr) {
    let address = h.address || "";
    let name = h.name || "";
    let details = [];
    for (let det of (h.details || [])) {
      let down = (det.down_points || []).map(p => new Point(p[0], p[1] + 0.01, p[2]));
      let up = (det.up_points || []).map(p => new Point(p[0], p[1], p[2]));
      details.push(new Detail(down, up));
    }
    hospitals.push(new Hospital(address, name, details));
  }
}

function read_json_labels() {
  let arr = safeArr(json_labels_root, 'labels');
  for (let lb of arr) {
    let address = lb.address || "";
    let name = lb.name || "";
    let type = lb.type || "";
    let level = lb.level || 0;
    let p = lb.point || [0,0,0];
    labels.push(new Label(address, name, type, level, new Point(p[0], p[1], p[2])));
  }
}

function read_json_parkings() {
  let arr = safeArr(json_parkings_root, 'parkings');
  for (let pk of arr) {
    let pts = (pk.points || []).map(p => new Point(p[0], p[1], p[2]));
    parkings.push(new Parking(pts));
  }
}

function read_json_railways() {
  let arr = safeArr(json_railways_root, 'railways');
  for (let r of arr) {
    let pts = (r.points || []).map(p => new Point(p[0], p[1] - 0.006, p[2]));
    railways.push(new Railway(pts));
  }
}

function read_json_roads() {
  let arr = safeArr(json_roads_root, 'roads');
  for (let r of arr) {
    let pts = (r.points || []).map(p => new Point(p[0], p[1] - 0.005, p[2]));
    roads.push(new Road(r.name || "", pts));
  }
}

function read_json_underlays() {
  let arr = safeArr(json_underlays_root, 'underlays');
  for (let u of arr) {
    let pts = (u.points || []).map(p => new Point(p[0], p[1], p[2]));
    underlays.push(new Underlay(pts));
  }
}

function read_json_waters() {
  let arr = safeArr(json_waters_root, 'water');
  if (!arr || arr.length === 0) arr = safeArr(json_waters_root, 'waters');
  for (let w of arr) {
    let pts = (w.points || []).map(p => new Point(p[0], p[1] - 0.01, p[2]));
    waters.push(new Water(w.name || "", pts));
  }
}

// -----------------------------
// Input: mouse & touch
// -----------------------------

// DESKTOP: left drag = pan; CTRL + drag = rotate
function mouseDragged() {
  if (isTouch) return; // ignore mouse while touch active
  let dx = mouseX - pmouseX;
  let dy = mouseY - pmouseY;
  let sensitivity = 1.0 / zoom;
  if (keyIsDown(CONTROL)) {
    // rotate (same sign as original)
    angleY -= dx * 0.005;
    angleX -= dy * 0.005;
    angleX = constrain(angleX, Math.PI / 2, Math.PI / 1.25);
  } else {
    let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
    offsetX += (dy * sinY + dx * cosY) * sensitivity;
    offsetZ -= (dy * cosY - dx * sinY) * sensitivity;
  }
}

// mouseWheel: zoom and keep focus under cursor
function mouseWheel(event) {
  if (isTouch) return;
  let e = (event.delta > 0) ? 1 : -1;
  let oldZoom = zoom;
  let zoomSpeed = 0.05;
  zoom *= 1 - e * zoomSpeed;
  zoom = constrain(zoom, 0.1, 20.0);
  let deltaZoom = zoom - oldZoom;
  let normX = (mouseX - width / 2.0) / width;
  let normZ = (mouseY - height / 2.0) / height;
  let smoothingFactor = 1.0 / Math.pow(zoom, 1.5);
  let deltaX = -normX * deltaZoom * width * smoothingFactor;
  let deltaZ = -normZ * deltaZoom * height * smoothingFactor;
  let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
  let sensitivity = 1.0 / zoom;
  offsetX += (deltaZ * sinY + deltaX * cosY) * sensitivity;
  offsetZ -= (deltaZ * cosY - deltaX * sinY) * sensitivity;
  return false;
}

// TOUCH: 1 finger = pan; 2 fingers pinch = zoom; 2 fingers rotate = rotate
let touchMode = "none";
let startDist = 0;
let startZoom = 1;
let lastPanX = 0;
let lastPanZ = 0;
let startOffsetX = 0;
let startOffsetZ = 0;
let lastAngleBetween = 0;

function touchStarted() {
  isTouch = true;
  if (touches.length === 1) {
    touchMode = "pan";
    lastPanX = touches[0].x;
    lastPanZ = touches[0].y;
    startOffsetX = offsetX; startOffsetZ = offsetZ;
  } else if (touches.length === 2) {
    touchMode = "pinch";
    startDist = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
    startZoom = zoom;
    lastPanX = (touches[0].x + touches[1].x) / 2;
    lastPanZ = (touches[0].y + touches[1].y) / 2;
    startOffsetX = offsetX; startOffsetZ = offsetZ;
    lastAngleBetween = Math.atan2(touches[1].y - touches[0].y, touches[1].x - touches[0].x);
  }
  return false;
}

function touchMoved() {
  if (touchMode === "pan" && touches.length === 1) {
    let dx = touches[0].x - lastPanX;
    let dy = touches[0].y - lastPanZ;
    let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
    let sensitivity = 1.0 / zoom;
    offsetX = startOffsetX + (dy * sinY + dx * cosY) * sensitivity;
    offsetZ = startOffsetZ - (dy * cosY - dx * sinY) * sensitivity;
  } else if (touches.length === 2) {
    // pinch zoom
    let d = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
    zoom = startZoom * (d / startDist);
    zoom = constrain(zoom, 0.1, 20.0);

    // two-finger pan (midpoint)
    let cx = (touches[0].x + touches[1].x) / 2;
    let cz = (touches[0].y + touches[1].y) / 2;
    let dx = cx - lastPanX;
    let dy = cz - lastPanZ;
    let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
    let sensitivity = 1.0 / zoom;
    offsetX = startOffsetX + (dy * sinY + dx * cosY) * sensitivity;
    offsetZ = startOffsetZ - (dy * cosY - dx * sinY) * sensitivity;

    // rotation between fingers -> rotate around Y (like ctrl+mouse)
    let newAngleBetween = Math.atan2(touches[1].y - touches[0].y, touches[1].x - touches[0].x);
    let deltaAngle = newAngleBetween - lastAngleBetween;
    angleY += deltaAngle * 1.2; // scale sensitivity
    lastAngleBetween = newAngleBetween;
  }
  return false;
}

function touchEnded() {
  if (touches.length === 0) {
    isTouch = false;
    touchMode = "none";
  } else if (touches.length === 1) {
    // if one finger left, switch to pan start from current
    touchMode = "pan";
    lastPanX = touches[0].x; lastPanZ = touches[0].y;
    startOffsetX = offsetX; startOffsetZ = offsetZ;
  }
  return false;
}

// -----------------------------
// window resize
// -----------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
