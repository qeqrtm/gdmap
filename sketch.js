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
// Utility: multiply projection * modelview (column-major arrays)
// -----------------------------
function multMat4(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

// -----------------------------
// Convert world (x,y,z) to screen pixels reliably (WEBGL)
// -----------------------------
function worldToScreen(x, y, z) {
  const renderer = (typeof this !== 'undefined' && this._renderer) ? this._renderer : (p5 && p5.instance && p5.instance._renderer ? p5.instance._renderer : null);
  if (!renderer || !renderer.uPMatrix || !renderer.uMVMatrix) {
    return { x: NaN, y: NaN, z: Infinity };
  }

  const pMat = renderer.uPMatrix.mat4;
  const mvMat = renderer.uMVMatrix.mat4;

  const mvp = multMat4(pMat, mvMat);

  const nx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
  const ny = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
  const nz = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14];
  const nw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];

  if (!isFinite(nw) || Math.abs(nw) < 1e-8) {
    return { x: NaN, y: NaN, z: Infinity };
  }

  const ndcX = nx / nw;
  const ndcY = ny / nw;
  const ndcZ = nz / nw; // depth

  const sx = (ndcX * 0.5 + 0.5) * width;
  const sy = (-ndcY * 0.5 + 0.5) * height;

  return { x: sx, y: sy, z: ndcZ };
}

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

function drawPolygon(points) {
  beginShape();
  for (let p of points) vertex(p.x, p.y, p.z);
  endShape(CLOSE);
}

class Label {
  constructor(address, name, type, level, location) {
    this.address = address;
    this.name = name;
    this.type = type;
    this.level = level;
    this.x = location.x;
    this.y = location.y;
    this.z = location.z;
    this.icon = null;
    this._screen = { x: 0, y: 0, visible: false };

    if (type) {
      if (iconCache[type]) {
        this.icon = iconCache[type];
      } else {
        try {
          this.icon = loadImage('data/' + type + '.png',
            img => { iconCache[type] = img; this.icon = img; },
            err => { console.warn('Label icon not found for type:', type); }
          );
        } catch (e) {
          console.warn('loadImage failed for label type', type, e);
        }
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
    push();
    translate(this.x, this.y, this.z);
    rotateY(-angleY);
    scale(1 / zoom);
    noStroke();
    fill(this.clr.r, this.clr.g, this.clr.b);
    textSize(17);
    textAlign(CENTER, TOP);
    if (this.icon && this.icon.width) {
      imageMode(CENTER);
      image(this.icon, 0, 0, this.icon.width / 1.5, this.icon.height / 1.5);
      text(this.name, 0, (this.icon.height / 1.5) - 6);
    } else {
      text(this.name, 0, -6);
    }
    pop();
  }
}

// -----------------------------
// preload - load JSON and icons mentioned in labels
// -----------------------------
function preload() {
  font = loadFont("data/YandexSansText-Bold.ttf");
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

  try {
    let arr = (json_labels_root && (json_labels_root.labels || json_labels_root)) || [];
    let types = {};
    for (let i = 0; i < arr.length; i++) {
      let t = arr[i].type;
      if (t && !types[t]) {
        types[t] = true;
        iconCache[t] = loadImage('data/' + t + '.png',
          img => { iconCache[t] = img; },
          err => { delete iconCache[t]; console.warn('Missing icon for type (expected):', 'data/' + t + '.png'); }
        );
      }
    }
  } catch (e) {
    console.warn('Failed to pre-load icons from labels.json', e);
  }
}

// -----------------------------
// JSON readers
// -----------------------------
function safeArr(root, key) {
  if (!root) return [];
  if (root[key]) return root[key];
  if (Array.isArray(root)) return root;
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

// Similarly, define the functions for other data (like fields, governments, etc.)
function read_json_parkings() {
  let arr = safeArr(json_parkings_root, 'parkings');
  for (let pk of arr) {
    let pts = (pk.points || []).map(p => new Point(p[0], p[1], p[2]));
    parkings.push(new Parking(pts));
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

// -----------------------------
// window resize
// -----------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
