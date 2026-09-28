"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import "./style.css";
import plazaMapUrl from "./assets/postal-plaza-v3.png";
import gardenMapUrl from "./assets/garden-market-v3.png";
import windmillMapUrl from "./assets/windmill-route-v3.png";
import forestMapUrl from "./assets/forest-canopy-v2.png";
import forestMooncapUrl from "./assets/forest-mooncap-grove-v1.png";
import forestBridgeUrl from "./assets/forest-canopy-bridge-v1.png";
import beachMapUrl from "./assets/coral-cove-v2.png";
import beachTidepoolUrl from "./assets/coral-tidepool-boardwalk-v1.png";
import beachLighthouseUrl from "./assets/coral-lighthouse-pier-v1.png";
import spaceMapUrl from "./assets/cosmic-station-v1.png";
import spaceCargoUrl from "./assets/cosmic-cargo-dock-v1.png";
import spaceObservatoryUrl from "./assets/cosmic-observatory-ring-v1.png";
import leafCapUrl from "./assets/shop/leaf-cap.png";
import coralGogglesUrl from "./assets/shop/coral-goggles.png";
import orbitHaloUrl from "./assets/shop/orbit-halo.png";
import mossRunnerUrl from "./assets/shop/moss-runner.png";
import tideRiderUrl from "./assets/shop/tide-rider.png";
import nebulaGlideUrl from "./assets/shop/nebula-glide.png";
import firefliesUrl from "./assets/shop/fireflies.png";
import bubblePopUrl from "./assets/shop/bubble-pop.png";
import stardustUrl from "./assets/shop/stardust.png";

type Point = { x: number; y: number };
type DistrictPoint = Point & { district: number; name: string };
type Box = Point & { width: number; height: number };
type Hazard = Point & { district: number; type: "carrot" | "bird"; axis: "x" | "y"; range: number; speed: number; phase: number };
type RouteLayout = { id: string; parcels: DistrictPoint[]; deliveryStops: DistrictPoint[]; rfCoins: DistrictPoint[]; hazards: Hazard[]; powerBuff: DistrictPoint | null };
type Phase = "ready" | "playing" | "finished";
type RouteRank = "C" | "B" | "A" | "S";
type Hud = { time: number; score: number; rf: number; combo: number; hearts: number; deliveries: number; carrying: boolean; boost: number; powerTime: number; message: string };
type CosmeticCategory = "headgear" | "scooter" | "trail";
type EquippedCosmetics = { headgear: string | null; scooter: string; trail: string | null };
type Cosmetic = { id: string; name: string; category: CosmeticCategory; price: number; image: string; rarity: "C" | "R" | "E" | "L" };

const VIEW = { width: 480, height: 320 };
const WORLD = { width: 960, height: 640 };
const ISO = { originX: 197.5, originY: 76.25, width: VIEW.width, height: VIEW.height };
const TILE = 32;
const PLAYER_RADIUS = 12;
const START: Point = { x: 480, y: 350 };
const ROUTE_SECONDS = 5 * 60;
const DELIVERY_GOAL = 5;
const COIN_BOOST_RESTORE = 18;
const POWER_BUFF_SPAWN_RATE = .18;
const POWER_BUFF_DURATION = 12;
const RANK_REWARDS: Record<RouteRank, number> = { C: 25, B: 50, A: 80, S: 120 };
const cosmetics: Cosmetic[] = [
  { id: "leaf-cap", name: "LEAF CAP", category: "headgear", price: 90, image: leafCapUrl, rarity: "C" },
  { id: "coral-goggles", name: "CORAL GOGGLES", category: "headgear", price: 120, image: coralGogglesUrl, rarity: "R" },
  { id: "orbit-halo", name: "ORBIT HALO", category: "headgear", price: 160, image: orbitHaloUrl, rarity: "E" },
  { id: "moss-runner", name: "MOSS RUNNER", category: "scooter", price: 180, image: mossRunnerUrl, rarity: "R" },
  { id: "tide-rider", name: "TIDE RIDER", category: "scooter", price: 220, image: tideRiderUrl, rarity: "E" },
  { id: "nebula-glide", name: "NEBULA GLIDE", category: "scooter", price: 280, image: nebulaGlideUrl, rarity: "L" },
  { id: "fireflies", name: "FIREFLIES", category: "trail", price: 140, image: firefliesUrl, rarity: "C" },
  { id: "bubble-pop", name: "BUBBLE POP", category: "trail", price: 160, image: bubblePopUrl, rarity: "R" },
  { id: "stardust", name: "STARDUST", category: "trail", price: 240, image: stardustUrl, rarity: "E" },
];
const movementKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"]);

const houses = [
  { x: 90, y: 262, color: "#ff7c62", roof: "#d94e58", name: "Sky Post Office" },
] as const;

const mapOptions = [
  { name: "POSTAL ROUTE", caption: "PLAZA · MARKET · MILL", scenes: [
    { name: "POSTAL PLAZA", image: plazaMapUrl }, { name: "BLOOM MARKET", image: gardenMapUrl }, { name: "WINDMILL ROUTE", image: windmillMapUrl },
  ] },
  { name: "FOREST CANOPY", caption: "ROOTS · GROVE · BRIDGE", scenes: [
    { name: "ROOTWOOD CLEARING", image: forestMapUrl }, { name: "MOONCAP GROVE", image: forestMooncapUrl }, { name: "CANOPY BRIDGE", image: forestBridgeUrl },
  ] },
  { name: "CORAL COVE", caption: "MARINA · REEF · LIGHTHOUSE", scenes: [
    { name: "MARINA DECK", image: beachMapUrl }, { name: "TIDEPOOL WALK", image: beachTidepoolUrl }, { name: "LIGHTHOUSE PIER", image: beachLighthouseUrl },
  ] },
  { name: "COSMIC STATION", caption: "ORBIT · CARGO · OBSERVATORY", scenes: [
    { name: "ORBITAL COURTYARD", image: spaceMapUrl }, { name: "NEBULA CARGO", image: spaceCargoUrl }, { name: "OBSERVATORY RING", image: spaceObservatoryUrl },
  ] },
] as const;
const districtNames = mapOptions[0].scenes.map(scene => scene.name);
const targetOrder = [0, 1, 2, 3, 4];
const ponds: Box[] = [];
const flowerBoxes: Box[] = [];
const obstacles: Box[] = [
  ...ponds,
];
const trees: Point[] = [];

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
const rankRoute = (secondsLeft: number, completed: boolean): { rank: RouteRank; reward: number } => {
  if (!completed) return { rank: "C", reward: 0 };
  const rank: RouteRank = secondsLeft >= 180 ? "S" : secondsLeft >= 120 ? "A" : secondsLeft >= 60 ? "B" : "C";
  return { rank, reward: RANK_REWARDS[rank] };
};
const project = (point: Point): Point => ({ x: ISO.originX + (point.x - point.y) * .25, y: ISO.originY + (point.x + point.y) * .125 });
const unproject = (point: Point): Point => {
  const difference = (point.x - ISO.originX) / .25, sum = (point.y - ISO.originY) / .125;
  return { x: (difference + sum) / 2, y: (sum - difference) / 2 };
};

function diamond(ctx: CanvasRenderingContext2D, center: Point, width: number, height: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(center.x, center.y - height / 2); ctx.lineTo(center.x + width / 2, center.y);
  ctx.lineTo(center.x, center.y + height / 2); ctx.lineTo(center.x - width / 2, center.y); ctx.closePath(); ctx.fill();
}

function pointHitsBox(point: Point, box: Box, radius = PLAYER_RADIUS) {
  const x = clamp(point.x, box.x, box.x + box.width);
  const y = clamp(point.y, box.y, box.y + box.height);
  return Math.hypot(point.x - x, point.y - y) < radius;
}

function walkable(point: Point, district = 0) {
  const screen = project(point);
  return screen.x >= 48 && screen.x <= 432 && screen.y >= 86 && screen.y <= 270 &&
    (district !== 0 || !obstacles.some(box => pointHitsBox(point, box)));
}

const randomBetween = (low: number, high: number) => low + Math.random() * (high - low);

function randomSafePoint(district: number, used: Point[], minimumDistance = 52, bounds = { x1: 150, x2: 810, y1: 120, y2: 520 }): Point {
  for (let attempt = 0; attempt < 240; attempt++) {
    const point = { x: Math.round(randomBetween(bounds.x1, bounds.x2)), y: Math.round(randomBetween(bounds.y1, bounds.y2)) };
    const screen = project(point);
    if (screen.x < 72 || screen.x > 408 || screen.y < 104 || screen.y > 250 || !walkable(point, district)) continue;
    if (used.every(other => distance(point, other) >= minimumDistance)) { used.push(point); return point; }
  }
  const fallback = { x: Math.round(randomBetween(250, 710)), y: Math.round(randomBetween(210, 430)) };
  used.push(fallback); return fallback;
}

function randomSafeScreenPoint(district: number, used: Point[], minimumDistance: number, bounds: { x1: number; x2: number; y1: number; y2: number }): Point {
  for (let attempt = 0; attempt < 80; attempt++) {
    const point = unproject({ x: randomBetween(bounds.x1, bounds.x2), y: randomBetween(bounds.y1, bounds.y2) });
    point.x = Math.round(point.x); point.y = Math.round(point.y);
    if (!walkable(point, district) || !used.every(other => distance(point, other) >= minimumDistance)) continue;
    used.push(point); return point;
  }
  return randomSafePoint(district, used, minimumDistance);
}

function createRouteLayout(selectedMap: number): RouteLayout {
  const scenes = mapOptions[selectedMap].scenes;
  const used = scenes.map(() => [] as Point[]);
  const point = (district: number, name: string, minimumDistance = 52, bounds?: { x1: number; x2: number; y1: number; y2: number }): DistrictPoint =>
    ({ ...randomSafePoint(district, used[district], minimumDistance, bounds), district, name });
  const randomScene = (except = -1) => {
    const choices = scenes.map((_, index) => index).filter(index => index !== except);
    return choices[Math.floor(Math.random() * choices.length)] ?? 0;
  };
  const parcels: DistrictPoint[] = [point(0, `${scenes[0].name} Parcel 1`, 54, { x1: 300, x2: 650, y1: 145, y2: 345 })];
  const deliveryStops: DistrictPoint[] = [point(1, `${scenes[1].name} Drop 1`, 60)];
  for (let index = 1; index < DELIVERY_GOAL; index++) {
    const parcelScene = randomScene();
    const destinationScene = randomScene(parcelScene);
    parcels.push(point(parcelScene, `${scenes[parcelScene].name} Parcel ${index + 1}`, 52));
    deliveryStops.push(point(destinationScene, `${scenes[destinationScene].name} Drop ${index + 1}`, 58));
  }
  const rfCoins: DistrictPoint[] = [];
  for (let district = 0; district < scenes.length; district++) for (let index = 0; index < 10; index++) {
    const column = index % 5, row = Math.floor(index / 5);
    const at = randomSafeScreenPoint(district, used[district], 34, {
      x1: 76 + column * 66, x2: 112 + column * 66,
      y1: 106 + row * 92, y2: 136 + row * 92,
    });
    rfCoins.push({ ...at, district, name: `${scenes[district].name} RF ${index + 1}` });
  }
  const hazards: Hazard[] = [];
  for (let district = 0; district < scenes.length; district++) {
    const hazardCount = 5 + Math.floor(Math.random() * 4);
    const bandStep = 292 / (hazardCount - 1);
    for (let index = 0; index < hazardCount; index++) {
      const bandCenter = 94 + index * bandStep;
      const at = randomSafeScreenPoint(district, used[district], 36, { x1: bandCenter - 16, x2: bandCenter + 16, y1: 116, y2: 232 });
      hazards.push({ ...at, district, type: (district + index) % 2 ? "bird" : "carrot", axis: Math.random() < .5 ? "x" : "y",
        range: Math.round(randomBetween(80, 135)), speed: randomBetween(.00085, .00135), phase: randomBetween(0, Math.PI * 2) });
    }
  }
  const buffDistrict = Math.floor(Math.random() * scenes.length);
  const powerBuff = Math.random() < POWER_BUFF_SPAWN_RATE ? point(buffDistrict, "Star Core", 62) : null;
  return { id: Math.random().toString(36).slice(2, 10), parcels, deliveryStops, rfCoins, hazards, powerBuff };
}

function advance(position: Point, dx: number, dy: number, district = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let step = 0; step < steps; step++) {
    const next = { x: position.x + dx / steps, y: position.y + dy / steps };
    if (walkable(next, district)) Object.assign(position, next);
    else {
      if (walkable({ x: next.x, y: position.y }, district)) position.x = next.x;
      if (walkable({ x: position.x, y: next.y }, district)) position.y = next.y;
    }
  }
}

function onRoad(point: Point) {
  return Math.abs(point.y - 320) < 38 || Math.abs(point.x - 480) < 36 ||
    houses.some(house => Math.abs(point.x - house.x) < 32 && Math.abs(point.y - (house.y + 100)) < 100);
}

function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#fff8dc", size = 8, align: CanvasTextAlign = "left") {
  ctx.fillStyle = "#2b2540"; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align;
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

const tinyGlyphs: Record<string, readonly string[]> = {
  " ": ["000","000","000","000","000"], "#": ["101","111","101","111","101"],
  "0": ["111","101","101","101","111"], "1": ["010","110","010","010","111"],
  "2": ["110","001","111","100","111"], "3": ["110","001","111","001","110"],
  "4": ["101","101","111","001","001"], "5": ["111","100","110","001","110"],
  "6": ["011","100","111","101","111"], "7": ["111","001","010","010","010"],
  "8": ["111","101","111","101","111"], "9": ["111","101","111","001","110"],
  "D": ["110","101","101","101","110"], "E": ["111","100","110","100","111"],
  "F": ["111","100","110","100","100"], "I": ["111","010","010","010","111"],
  "N": ["101","111","111","111","101"], "R": ["110","101","110","101","101"],
};

function bitmapText(ctx: CanvasRenderingContext2D, text: string, centerX: number, top: number, scale = 2, color = "#292640") {
  const width = text.length * 4 * scale - scale;
  const left = Math.round(centerX - width / 2);
  ctx.fillStyle = color;
  [...text].forEach((character, index) => (tinyGlyphs[character] ?? tinyGlyphs[" "]).forEach((row, py) =>
    [...row].forEach((pixel, px) => { if (pixel === "1") ctx.fillRect(left + index * 4 * scale + px * scale, top + py * scale, scale, scale); })));
}

function drawSky(ctx: CanvasRenderingContext2D, now: number, reduced: boolean) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, "#4aa7e8"); gradient.addColorStop(.55, "#75c8ef"); gradient.addColorStop(1, "#d8f2ff");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = "#eafaff";
  for (let i = 0; i < 24; i++) {
    const x = (i * 83 + 17) % VIEW.width, y = (i * 47 + 11) % 155;
    const blink = reduced || (Math.floor(now / 360 + i) % 3) ? 1 : 2;
    ctx.fillRect(x, y, blink, blink);
  }
  const drift = reduced ? 0 : Math.sin(now / 1700) * 5;
  ctx.fillStyle = "rgba(255,255,255,.78)";
  [[55, 76, 56], [411, 108, 70], [252, 35, 42]].forEach(([x, y, w]) => {
    ctx.fillRect(x + drift, y, w, 7); ctx.fillRect(x + 9 + drift, y - 6, w - 20, 7);
  });
  [[42, 120, .7], [392, 62, .55], [275, 95, .4]].forEach(([x, y, scale], index) => {
    ctx.fillStyle = "#5aa064"; ctx.fillRect(x, y, 42 * scale, 6 * scale); ctx.fillStyle = "#6fc46e"; ctx.fillRect(x + 4, y - 4 * scale, 34 * scale, 5 * scale);
    ctx.fillStyle = "#80624f"; ctx.beginPath(); ctx.moveTo(x + 4, y + 6 * scale); ctx.lineTo(x + 38 * scale, y + 6 * scale); ctx.lineTo(x + 22 * scale, y + 25 * scale); ctx.fill();
    ctx.fillStyle = "#fff4d2"; ctx.fillRect(x + 16 * scale, y - 11 * scale, 12 * scale, 8 * scale); ctx.fillStyle = index === 1 ? "#ef7764" : "#e7a04a"; ctx.fillRect(x + 14 * scale, y - 14 * scale, 16 * scale, 4 * scale);
  });
}

function drawGround(ctx: CanvasRenderingContext2D) {
  const north = project({ x: 0, y: 0 }), east = project({ x: WORLD.width, y: 0 });
  const south = project({ x: WORLD.width, y: WORLD.height }), west = project({ x: 0, y: WORLD.height });
  ctx.fillStyle = "#694b62"; ctx.beginPath(); ctx.moveTo(west.x, west.y); ctx.lineTo(south.x, south.y); ctx.lineTo(south.x, south.y + 28); ctx.lineTo(west.x, west.y + 28); ctx.fill();
  ctx.fillStyle = "#4d3c59"; ctx.beginPath(); ctx.moveTo(east.x, east.y); ctx.lineTo(south.x, south.y); ctx.lineTo(south.x, south.y + 28); ctx.lineTo(east.x, east.y + 28); ctx.fill();
  for (let y = 0; y < WORLD.height; y += TILE) for (let x = 0; x < WORLD.width; x += TILE) {
    const center = { x: x + TILE / 2, y: y + TILE / 2 }, at = project(center);
    const plaza = center.x > 170 && center.x < 790 && center.y > 145 && center.y < 535;
    const road = onRoad(center), seed = ((x / TILE) * 13 + (y / TILE) * 7) % 7;
    const surface = plaza ? (seed < 2 ? "#d9cfb8" : seed < 5 ? "#e8dfc9" : "#cfc6b2") : road ? (seed === 0 ? "#e6c47f" : "#f0d497") : (seed < 2 ? "#60a95f" : "#70bc67");
    diamond(ctx, at, TILE, TILE / 2, surface);
    ctx.strokeStyle = plaza ? "rgba(105,91,91,.23)" : road ? "rgba(139,91,76,.16)" : "rgba(37,105,75,.13)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(at.x, at.y - 8); ctx.lineTo(at.x + 16, at.y); ctx.lineTo(at.x, at.y + 8); ctx.stroke();
    if (plaza && seed === 1) { ctx.strokeStyle = "#a99f92"; ctx.beginPath(); ctx.moveTo(at.x - 7, at.y + 2); ctx.lineTo(at.x - 2, at.y); ctx.lineTo(at.x + 1, at.y + 3); ctx.stroke(); }
    if (!plaza && !road && seed === 0) { ctx.fillStyle = "#fff2a8"; ctx.fillRect(at.x - 1, at.y - 2, 2, 2); ctx.fillStyle = "#3f8c58"; ctx.fillRect(at.x - 1, at.y, 1, 3); }
  }
  ctx.fillStyle = "#5f8f50"; for (let i = 0; i < 26; i++) { const p = project({ x: 12 + i * 37, y: WORLD.height - 7 }); ctx.fillRect(p.x, p.y, 2, 11 + i % 3 * 4); }
  ctx.strokeStyle = "#ffd89a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(north.x, north.y); ctx.lineTo(east.x, east.y); ctx.stroke();
}

function drawPond(ctx: CanvasRenderingContext2D, box: Box, now: number, reduced: boolean) {
  const center = project({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  diamond(ctx, center, (box.width + box.height) / 2 + 10, (box.width + box.height) / 4 + 5, "#317d9f");
  diamond(ctx, center, (box.width + box.height) / 2, (box.width + box.height) / 4, "#54c6d0");
  const shimmer = reduced ? 0 : Math.round(Math.sin(now / 330) * 4);
  ctx.fillStyle = "#b4f2e5"; ctx.fillRect(center.x - 24 + shimmer, center.y - 5, 22, 2); ctx.fillRect(center.x + 6 - shimmer, center.y + 5, 18, 2);
  ctx.fillStyle = "#f7e66f"; ctx.fillRect(center.x + 14, center.y - 8, 10, 3); ctx.fillRect(center.x + 17, center.y - 11, 4, 9);
}

function drawTree(ctx: CanvasRenderingContext2D, tree: Point, variant: number) {
  const at = project(tree); diamond(ctx, { x: at.x + 5, y: at.y + 3 }, 31, 12, "rgba(42,33,64,.28)");
  ctx.fillStyle = "#694634"; ctx.fillRect(at.x - 3, at.y - 20, 7, 24); ctx.fillStyle = "#a46a45"; ctx.fillRect(at.x - 1, at.y - 20, 3, 19);
  const dark = variant % 3 === 0 ? "#2e7061" : variant % 3 === 1 ? "#4b7859" : "#4871a0";
  const light = variant % 3 === 0 ? "#57b06d" : variant % 3 === 1 ? "#83b85e" : "#79a9cc";
  ctx.fillStyle = dark; ctx.fillRect(at.x - 15, at.y - 43, 31, 24); ctx.fillRect(at.x - 10, at.y - 51, 21, 10);
  ctx.fillStyle = light; ctx.fillRect(at.x - 10, at.y - 46, 20, 13); ctx.fillRect(at.x - 5, at.y - 53, 12, 8);
  ctx.fillStyle = "#ffe06c"; ctx.fillRect(at.x + (variant % 2 ? 8 : -11), at.y - 39, 3, 3);
}

function drawTownProp(ctx: CanvasRenderingContext2D, point: Point, kind: "stall" | "sign" | "windmill" | "lamp" | "bench" | "fence", now: number, reduced: boolean) {
  const at = project(point), x = Math.round(at.x), y = Math.round(at.y);
  diamond(ctx, { x: x + 4, y: y + 2 }, kind === "windmill" ? 44 : 28, kind === "windmill" ? 15 : 9, "rgba(42,33,64,.24)");
  if (kind === "stall") {
    ctx.fillStyle = "#6e4055"; ctx.fillRect(x - 17, y - 23, 34, 23); ctx.fillStyle = "#ffe8a5"; ctx.fillRect(x - 20, y - 29, 40, 7);
    ctx.fillStyle = "#ef6974"; for (let i = -18; i < 19; i += 10) ctx.fillRect(x + i, y - 29, 6, 7);
    ctx.fillStyle = "#58a97d"; ctx.fillRect(x - 12, y - 14, 7, 5); ctx.fillStyle = "#ffcb55"; ctx.fillRect(x + 5, y - 14, 8, 5);
  } else if (kind === "sign") {
    ctx.fillStyle = "#754b3e"; ctx.fillRect(x - 2, y - 23, 4, 23); ctx.fillStyle = "#f4cc7b"; ctx.fillRect(x - 13, y - 27, 26, 11);
    ctx.fillStyle = "#7c4d55"; ctx.fillRect(x - 8, y - 23, 16, 2); ctx.fillRect(x + 5, y - 25, 3, 6);
  } else if (kind === "lamp") {
    ctx.fillStyle = "#273849"; ctx.fillRect(x - 2, y - 34, 5, 34); ctx.fillRect(x - 7, y - 37, 15, 5); ctx.fillRect(x - 5, y - 48, 11, 12);
    ctx.fillStyle = "#ffc85d"; ctx.fillRect(x - 3, y - 45, 7, 7); ctx.fillStyle = "#fff3a5"; ctx.fillRect(x - 2, y - 44, 3, 4);
  } else if (kind === "bench") {
    ctx.fillStyle = "#694535"; ctx.fillRect(x - 18, y - 12, 36, 6); ctx.fillRect(x - 16, y - 5, 32, 5); ctx.fillRect(x - 13, y, 4, 7); ctx.fillRect(x + 9, y, 4, 7);
    ctx.fillStyle = "#b87945"; ctx.fillRect(x - 16, y - 11, 32, 2); ctx.fillRect(x - 14, y - 4, 28, 2);
  } else if (kind === "fence") {
    ctx.fillStyle = "#754b36"; ctx.fillRect(x - 19, y - 13, 5, 17); ctx.fillRect(x + 14, y - 13, 5, 17); ctx.fillRect(x - 17, y - 9, 34, 4); ctx.fillRect(x - 17, y - 2, 34, 4);
    ctx.fillStyle = "#c98246"; ctx.fillRect(x - 17, y - 12, 2, 10); ctx.fillRect(x + 15, y - 12, 2, 10);
  } else {
    ctx.fillStyle = "#86604c"; ctx.fillRect(x - 8, y - 40, 16, 40); ctx.fillStyle = "#f3dfad"; ctx.fillRect(x - 6, y - 38, 12, 34);
    const angle = reduced ? 0 : now / 800; ctx.save(); ctx.translate(x, y - 39); ctx.rotate(angle);
    ctx.fillStyle = "#fff1c4"; ctx.fillRect(-3, -25, 6, 50); ctx.fillRect(-25, -3, 50, 6); ctx.fillStyle = "#e66f6f"; ctx.fillRect(-3, -25, 6, 8); ctx.fillRect(17, -3, 8, 6); ctx.restore();
    ctx.fillStyle = "#704455"; ctx.fillRect(x - 4, y - 43, 8, 8);
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, index: number, target: boolean, now: number, reduced: boolean) {
  const house = houses[index], at = project(house), x = Math.round(at.x), y = Math.round(at.y);
  if (target) {
    const pulse = reduced ? 2 : 2 + Math.round((Math.sin(now / 180) + 1) * 2);
    ctx.strokeStyle = "#fff36a"; ctx.lineWidth = 2; ctx.strokeRect(x - 34 - pulse, y - 58 - pulse, 68 + pulse * 2, 61 + pulse * 2);
    pixelText(ctx, "DELIVER!", x, y - 66, "#fff36a", 8, "center");
  }
  diamond(ctx, { x: x + 3, y: y + 3 }, 76, 24, "rgba(41,31,58,.3)");
  ctx.fillStyle = "#74465b"; ctx.fillRect(x - 31, y - 46, 62, 46);
  ctx.fillStyle = house.color; ctx.fillRect(x - 27, y - 44, 54, 41);
  ctx.fillStyle = house.roof; ctx.fillRect(x - 38, y - 56, 76, 13); ctx.fillRect(x - 29, y - 65, 58, 10);
  ctx.fillStyle = "rgba(255,225,165,.42)"; for (let rx = x - 31; rx < x + 30; rx += 12) { ctx.fillRect(rx, y - 62, 8, 3); ctx.fillRect(rx - 5, y - 52, 8, 3); }
  ctx.fillStyle = "#fff0b4"; ctx.fillRect(x - 20, y - 31, 12, 12); ctx.fillRect(x + 9, y - 31, 12, 12);
  ctx.fillStyle = "#62a9c3"; ctx.fillRect(x - 17, y - 28, 7, 7); ctx.fillRect(x + 12, y - 28, 7, 7);
  ctx.fillStyle = "#53384a"; ctx.fillRect(x - 7, y - 22, 14, 22); ctx.fillStyle = "#34273b"; ctx.fillRect(x - 4, y - 19, 8, 17);
  ctx.fillStyle = target ? "#fff36a" : "#e7b95e"; ctx.fillRect(x + 3, y - 11, 2, 2);
  ctx.fillStyle = "#5a3d48"; ctx.fillRect(x + 25, y - 51, 7, 18); ctx.fillStyle = "#f4d48a"; ctx.fillRect(x + 26, y - 49, 5, 7);
  ctx.fillStyle = "#fff1c0"; ctx.fillRect(x - 24, y - 43, 48, 4); ctx.fillStyle = house.roof; for (let ax = x - 23; ax < x + 22; ax += 12) ctx.fillRect(ax, y - 43, 7, 9);
  ctx.fillStyle = "#4d8257"; ctx.fillRect(x - 28, y - 13, 8, 10); ctx.fillRect(x + 20, y - 13, 8, 10); ctx.fillStyle = "#ffe06a"; ctx.fillRect(x - 26, y - 16, 3, 3); ctx.fillRect(x + 23, y - 15, 3, 3);
  if (index === 2) { ctx.fillStyle = "#d94f54"; ctx.fillRect(x - 41, y - 25, 10, 25); ctx.fillStyle = "#fff0d0"; ctx.fillRect(x - 38, y - 19, 5, 4); }
  pixelText(ctx, String(index + 1), x, y + 11, "#fff8dc", 7, "center");
}

function drawFlowerBox(ctx: CanvasRenderingContext2D, box: Box) {
  const at = project({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  ctx.fillStyle = "#7d4f43"; ctx.fillRect(at.x - 22, at.y - 4, 44, 9);
  const colors = ["#ff6f91", "#fff36a", "#84e6d2", "#f7f0dc"];
  for (let x = at.x - 18, i = 0; x < at.x + 19; x += 9, i++) {
    ctx.fillStyle = "#2e794f"; ctx.fillRect(x, at.y - 8, 2, 7);
    ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x - 2, at.y - 11 + (i % 2) * 2, 6, 5);
  }
}

function drawParcel(ctx: CanvasRenderingContext2D, point: Point, now: number, reduced: boolean) {
  const bob = reduced ? 0 : Math.round(Math.sin(now / 150) * 2);
  const at = project(point), x = Math.round(at.x), y = Math.round(at.y + bob - 9);
  ctx.fillStyle = "#fff36a"; ctx.fillRect(x - 9, y - 8, 18, 16);
  ctx.fillStyle = "#f09b39"; ctx.fillRect(x - 7, y - 6, 14, 12);
  ctx.fillStyle = "#fff4b0"; ctx.fillRect(x - 2, y - 6, 4, 12); ctx.fillRect(x - 7, y - 2, 14, 4);
  ctx.fillStyle = "#fff"; ctx.fillRect(x - 13, y - 12, 3, 3); ctx.fillRect(x + 10, y - 9, 2, 2); ctx.fillRect(x + 12, y + 8, 3, 3);
}

function drawRfCoin(ctx: CanvasRenderingContext2D, point: Point, index: number, now: number, reduced: boolean) {
  const at = project(point), bob = reduced ? 0 : Math.round(Math.sin(now / 180 + index) * 3);
  const width = reduced ? 11 : Math.max(3, Math.round(12 * Math.abs(Math.cos(now / 165 + index * .7))));
  const x = Math.round(at.x), y = Math.round(at.y - 9 + bob), left = Math.round(x - width / 2);
  diamond(ctx, { x, y: at.y + 1 }, 18, 6, "rgba(43,37,64,.3)");
  const edge = width >= 8 ? 2 : 0;
  ctx.fillStyle = "#7d4720"; ctx.fillRect(left + edge, y - 7, Math.max(1, width - edge * 2), 2); ctx.fillRect(left, y - 5, width, 10); ctx.fillRect(left + edge, y + 5, Math.max(1, width - edge * 2), 2);
  ctx.fillStyle = "#ffd84f"; ctx.fillRect(left + edge, y - 5, Math.max(1, width - edge * 2), 2); ctx.fillRect(left + 1, y - 3, Math.max(1, width - 2), 6); ctx.fillRect(left + edge, y + 3, Math.max(1, width - edge * 2), 2);
  ctx.fillStyle = "#e89b2d"; ctx.fillRect(left + 2, y - 2, Math.max(1, width - 4), 5);
  ctx.fillStyle = "#fff39a"; ctx.fillRect(left + 2, y - 3, Math.max(1, width - 4), 1);
  if (width >= 11) bitmapText(ctx, "RF", x, y - 2, 1, "#7d4720");
  ctx.fillStyle = "#fff8dc";
  if (reduced || (Math.floor(now / 130) + index) % 2) { ctx.fillRect(x - 8, y - 8, 2, 2); ctx.fillRect(x + 6, y - 4, 2, 2); }
}

function drawPowerBuff(ctx: CanvasRenderingContext2D, point: Point, now: number, reduced: boolean) {
  const at = project(point), phase = reduced ? 0 : now / 120;
  const bob = reduced ? 0 : Math.round(Math.sin(phase) * 4), pulse = reduced ? 0 : Math.round((Math.sin(now / 90) + 1) * 2);
  const x = Math.round(at.x), y = Math.round(at.y - 18 + bob);
  diamond(ctx, { x, y: at.y + 3 }, 34 + pulse, 10, "rgba(41,35,64,.46)");
  ctx.fillStyle = "rgba(121,236,255,.28)"; ctx.fillRect(x - 15 - pulse, y - 15 - pulse, 30 + pulse * 2, 30 + pulse * 2);
  ctx.fillStyle = "#292640"; ctx.fillRect(x - 3, y - 14, 6, 28); ctx.fillRect(x - 14, y - 3, 28, 6);
  ctx.fillStyle = "#fff36a"; ctx.fillRect(x - 2, y - 12, 4, 24); ctx.fillRect(x - 12, y - 2, 24, 4);
  ctx.fillStyle = "#ef79ff"; ctx.fillRect(x - 7, y - 7, 14, 14);
  ctx.fillStyle = "#fff8dc"; ctx.fillRect(x - 3, y - 3, 6, 6);
  const orbit = reduced ? [[-18, -12], [18, 12]] : Array.from({ length: 4 }, (_, index) => {
    const angle = phase / 2 + index * Math.PI / 2; return [Math.round(Math.cos(angle) * 21), Math.round(Math.sin(angle) * 12)];
  });
  orbit.forEach(([dx, dy], index) => { ctx.fillStyle = index % 2 ? "#79ecff" : "#fff36a"; ctx.fillRect(x + dx - 2, y + dy - 2, 4, 4); });
}

function drawDeliveryMarker(ctx: CanvasRenderingContext2D, sprites: GenerationSprites, friendId: bigint, point: Point, now: number, reduced: boolean, celebrating: boolean) {
  const at = project(point), pulse = reduced ? 0 : Math.round((Math.sin(now / (celebrating ? 75 : 170)) + 1) * (celebrating ? 3 : 2));
  const bob = reduced ? 0 : celebrating ? -Math.round(Math.abs(Math.sin(now / 95)) * 8) : Math.round(Math.sin(now / 210) * 2);
  diamond(ctx, { x: at.x + 3, y: at.y + 7 }, 66, 24, "rgba(37,31,57,.42)");
  diamond(ctx, { x: at.x, y: at.y + 2 }, 62 + pulse, 25, "#273452");
  diamond(ctx, { x: at.x, y: at.y }, 54, 19, "#e85d55");
  diamond(ctx, { x: at.x, y: at.y - 1 }, 43, 14, "#ffd45c");
  const rows = spriteFrame(sprites, "down", true, reduced ? 0 : Math.floor(now / (celebrating ? 70 : 140)) % 8, "right").frame.rows;
  const y = at.y - 7 + bob, scale = 2, left = Math.round(at.x - 16), top = Math.round(at.y - 43 + bob);
  ctx.fillStyle = "#fff8dc";
  rows.forEach((row, py) => [...row].forEach((pixel, px) => {
    if (pixel !== "#") return;
    const sx = left + px * scale, sy = top + py * scale;
    ctx.fillRect(sx - 1, sy, scale + 2, scale); ctx.fillRect(sx, sy - 1, scale, scale + 2);
  }));
  ctx.fillStyle = "#090a12";
  rows.forEach((row, py) => [...row].forEach((pixel, px) => { if (pixel === "#") ctx.fillRect(left + px * scale, top + py * scale, scale, scale); }));
  const bubbleX = Math.round(at.x + 17), bubbleY = Math.round(y - 51);
  ctx.fillStyle = "#292640"; ctx.fillRect(bubbleX - 2, bubbleY - 2, 30, 23);
  ctx.fillStyle = "#fff8dc"; ctx.fillRect(bubbleX, bubbleY, 26, 19); ctx.fillRect(bubbleX - 4, bubbleY + 15, 7, 7);
  ctx.fillStyle = "#ff526d";
  ctx.fillRect(bubbleX + 7, bubbleY + 5, 4, 4); ctx.fillRect(bubbleX + 15, bubbleY + 5, 4, 4);
  ctx.fillRect(bubbleX + 5, bubbleY + 7, 16, 4); ctx.fillRect(bubbleX + 8, bubbleY + 11, 10, 4); ctx.fillRect(bubbleX + 11, bubbleY + 15, 4, 2);
  ctx.fillStyle = "#fff8c7"; [[-25,-43],[28,-57],[-29,-20],[29,-22]].forEach(([dx,dy], index) => { if (reduced || (Math.floor(now / 180) + index) % 2) ctx.fillRect(at.x + dx, at.y + dy, 3, 3); });
  const labelWidth = 72, labelX = Math.round(at.x - labelWidth / 2), labelY = Math.round(at.y - 73 + bob);
  ctx.fillStyle = "rgba(25,22,42,.42)"; ctx.fillRect(labelX + 2, labelY + 2, labelWidth, 11);
  ctx.fillStyle = "#292640"; ctx.fillRect(labelX, labelY, labelWidth, 11);
  ctx.fillStyle = "#fff8dc"; ctx.fillRect(labelX + 2, labelY + 2, labelWidth - 4, 7);
  ctx.fillStyle = "#ffd84f"; ctx.fillRect(labelX + 4, labelY + 3, 2, 5); ctx.fillRect(labelX + labelWidth - 6, labelY + 3, 2, 5);
  bitmapText(ctx, `FRIEND #${friendId}`, at.x, labelY + 3, 1, "#292640");
  if (celebrating) {
    const burst = reduced ? 0 : Math.round(Math.sin(now / 70) * 2);
    const confetti = [
      [-31, -41, "#ff526d"], [-25, -61, "#55c980"], [-13, -69, "#ffd84f"],
      [13, -69, "#68cbe3"], [28, -60, "#ff8c55"], [34, -39, "#fff36a"],
    ] as const;
    confetti.forEach(([dx, dy, color], index) => {
      const sway = reduced ? 0 : (index % 2 ? burst : -burst);
      ctx.fillStyle = color; ctx.fillRect(Math.round(at.x + dx + sway), Math.round(at.y + dy - bob / 2), 3, 5);
    });
    ctx.fillStyle = "#fff8dc";
    ctx.fillRect(Math.round(at.x - 26 - burst), Math.round(at.y - 51 + bob), 5, 2);
    ctx.fillRect(Math.round(at.x + 22 + burst), Math.round(at.y - 51 + bob), 5, 2);
  }
}

function drawNavigationSigns(ctx: CanvasRenderingContext2D, district: number) {
  const signs = [
    district > 0 ? { side: "left" as const, label: districtNames[district - 1], arrow: "←" } : null,
    district < districtNames.length - 1 ? { side: "right" as const, label: districtNames[district + 1], arrow: "→" } : null,
  ].filter(Boolean) as { side: "left" | "right"; label: string; arrow: string }[];
  signs.forEach(sign => {
    const width = 96, height = 32, x = sign.side === "left" ? 8 : VIEW.width - width - 8, y = 94;
    const arrowX = sign.side === "left" ? x + 5 : x + width - 25;
    const textLeft = sign.side === "left" ? x + 28 : x + 3;
    const words = sign.label.split(" ");
    ctx.fillStyle = "rgba(28,28,46,.45)"; ctx.fillRect(x + 4, y + 5, width, height);
    ctx.fillStyle = "#25253d"; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#f4d68e"; ctx.fillRect(x + 3, y + 3, width - 6, height - 6);
    ctx.fillStyle = "#fff1b8"; ctx.fillRect(x + 5, y + 5, width - 10, 3);
    ctx.fillStyle = "#bd7742"; ctx.fillRect(x + 5, y + height - 7, width - 10, 3);
    ctx.fillStyle = "#2f6f9f"; ctx.fillRect(arrowX, y + 5, 20, 22);
    ctx.fillStyle = "#78c8d6"; ctx.fillRect(arrowX + 3, y + 7, 14, 2);
    pixelText(ctx, sign.arrow, arrowX + 10, y + 22, "#fff8dc", 12, "center");
    pixelText(ctx, "NEXT", textLeft + 32, y + 8, "#9a4b3d", 4, "center");
    pixelText(ctx, words[0], textLeft + 32, y + 17, "#29283e", 6, "center");
    if (words[1]) pixelText(ctx, words.slice(1).join(" "), textLeft + 32, y + 25, "#29283e", 6, "center");
    ctx.fillStyle = "#51382f"; ctx.fillRect(x + 11, y + height, 4, 10); ctx.fillRect(x + width - 15, y + height, 4, 10);
    ctx.fillStyle = "#8f5d3d"; ctx.fillRect(x + 12, y + height, 1, 8); ctx.fillRect(x + width - 14, y + height, 1, 8);
  });
}

function hazardPosition(hazard: Hazard, now: number): Point {
  const wave = Math.sin(now * hazard.speed + hazard.phase) * hazard.range;
  return hazard.axis === "x" ? { x: hazard.x + wave, y: hazard.y } : { x: hazard.x, y: hazard.y + wave };
}

function drawHazard(ctx: CanvasRenderingContext2D, hazard: Hazard, point: Point, now: number, reduced: boolean) {
  const hop = reduced ? 0 : Math.abs(Math.sin(now / 110 + hazard.phase)) * 3;
  const at = project(point), x = Math.round(at.x), y = Math.round(at.y - hop - 6);
  if (hazard.type === "carrot") {
    ctx.fillStyle = "#eb6b3d"; ctx.fillRect(x - 7, y - 8, 14, 16); ctx.fillRect(x - 4, y + 8, 8, 4);
    ctx.fillStyle = "#295c45"; ctx.fillRect(x - 7, y - 13, 5, 6); ctx.fillRect(x, y - 15, 5, 8); ctx.fillRect(x + 5, y - 12, 4, 5);
    ctx.fillStyle = "#38283b"; ctx.fillRect(x - 4, y - 2, 2, 2); ctx.fillRect(x + 3, y - 2, 2, 2);
  } else {
    ctx.fillStyle = "#fff8dc"; ctx.fillRect(x - 10, y - 7, 16, 13); ctx.fillRect(x + 3, y - 11, 9, 11);
    ctx.fillStyle = "#e7a23d"; ctx.fillRect(x + 11, y - 7, 6, 3); ctx.fillRect(x - 6, y + 6, 3, 5); ctx.fillRect(x + 3, y + 6, 3, 5);
    ctx.fillStyle = "#2b2540"; ctx.fillRect(x + 7, y - 8, 2, 2);
  }
}

function drawFriendOnScooter(ctx: CanvasRenderingContext2D, sprites: GenerationSprites, point: Point, facing: SpriteFacing, moving: boolean, now: number, reduced: boolean, invulnerable: boolean, carrying: boolean, boosting: boolean, powered: boolean, equipped: EquippedCosmetics) {
  if (invulnerable && Math.floor(now / 80) % 2) return;
  const side: "left" | "right" = facing === "left" ? "left" : "right";
  const rows = spriteFrame(sprites, facing, moving, reduced ? 0 : Math.floor(now / 120) % 8, side).frame.rows;
  const at = project(point), x = Math.round(at.x), y = Math.round(at.y);
  if (powered) {
    const auraPulse = reduced ? 0 : Math.round((Math.sin(now / 75) + 1) * 3);
    diamond(ctx, { x, y: y - 11 }, 55 + auraPulse, 70 + auraPulse, "rgba(121,236,255,.22)");
    ctx.strokeStyle = Math.floor(now / 100) % 2 ? "#fff36a" : "#79ecff"; ctx.lineWidth = 3;
    ctx.strokeRect(x - 24 - auraPulse / 2, y - 44 - auraPulse / 2, 48 + auraPulse, 56 + auraPulse);
    for (let index = 0; index < 6; index++) {
      const angle = (reduced ? 0 : now / 180) + index * Math.PI / 3, sx = Math.round(x + Math.cos(angle) * 31), sy = Math.round(y - 16 + Math.sin(angle) * 24);
      ctx.fillStyle = index % 2 ? "#ef79ff" : "#fff36a"; ctx.fillRect(sx - 1, sy - 4, 3, 9); ctx.fillRect(sx - 4, sy - 1, 9, 3);
      ctx.fillStyle = "#fff8dc"; ctx.fillRect(sx, sy, 1, 1);
    }
  }
  if (boosting) {
    const direction = facing === "left" ? { x: 1, y: 0 } : facing === "up" ? { x: 0, y: 1 } : facing === "down" ? { x: 0, y: -1 } : { x: -1, y: 0 };
    const pulse = reduced ? 0 : (Math.sin(now / 75) + 1) * 2;
    const trailColor = equipped.trail === "bubble-pop" ? "rgba(74,218,255,.32)" : equipped.trail === "stardust" ? "rgba(225,89,255,.34)" : equipped.trail === "fireflies" ? "rgba(255,230,82,.36)" : "rgba(255,139,61,.3)";
    diamond(ctx, { x: x + 2, y: y + 5 }, 50 + pulse, 17 + pulse / 2, trailColor);
    const coreLength = reduced ? 9 : 11 + Math.round(pulse * 2);
    const coreX = Math.round(x + direction.x * (20 + coreLength / 2));
    const coreY = Math.round(y + 4 + direction.y * (12 + coreLength / 2));
    ctx.fillStyle = "#292640";
    ctx.fillRect(coreX - (direction.x ? coreLength / 2 : 3), coreY - (direction.y ? coreLength / 2 : 3), direction.x ? coreLength : 6, direction.y ? coreLength : 6);
    ctx.fillStyle = equipped.trail === "bubble-pop" ? "#4ad6ff" : equipped.trail === "stardust" ? "#ef79ff" : equipped.trail === "fireflies" ? "#fff36a" : "#ff8b3d";
    ctx.fillRect(coreX - (direction.x ? coreLength / 2 - 2 : 2), coreY - (direction.y ? coreLength / 2 - 2 : 2), direction.x ? coreLength - 4 : 4, direction.y ? coreLength - 4 : 4);
    ctx.fillStyle = "#fff8dc";
    ctx.fillRect(coreX - 1, coreY - 1, 3, 3);
    const streaks = reduced ? 2 : 4;
    for (let index = 0; index < streaks; index++) {
      const lane = (index - 1.5) * 4, travel = reduced ? index * 7 : (now / 12 + index * 17) % 34;
      const streakX = Math.round(x + direction.x * (23 + travel) + (direction.y ? lane : 0));
      const streakY = Math.round(y + 4 + direction.y * (16 + travel * .55) + (direction.x ? lane / 2 : 0));
      ctx.globalAlpha = .78 - index * .1; ctx.fillStyle = index % 2 ? "#fff8dc" : equipped.trail === "stardust" ? "#79ecff" : equipped.trail === "bubble-pop" ? "#a8f5ff" : "#fff36a";
      ctx.fillRect(streakX - (direction.x < 0 ? 10 : 0), streakY, direction.x ? 10 : 2, direction.y ? 8 : 2);
    }
    ctx.globalAlpha = 1;
    const trailCount = reduced ? 3 : 8;
    for (let index = 0; index < trailCount; index++) {
      const travel = reduced ? 11 + index * 10 : (now / 18 + index * 11) % 72;
      const drift = reduced ? (index % 3 - 1) * 4 : Math.sin(now / 105 + index * 1.9) * (5 + index % 3);
      const tailX = Math.round(x + direction.x * (22 + travel) + (direction.y ? drift : 0));
      const tailY = Math.round(y + 4 + direction.y * (14 + travel * .55) + (direction.x ? drift : 0));
      ctx.globalAlpha = Math.max(.18, 1 - travel / 86);
      if (equipped.trail === "fireflies") {
        const size = index % 3 === 0 ? 6 : 4;
        ctx.fillStyle = "rgba(255,230,82,.38)"; ctx.fillRect(tailX - size, tailY - size, size * 2, size * 2);
        ctx.fillStyle = "#292640"; ctx.fillRect(tailX - 3, tailY - 3, 6, 6);
        ctx.fillStyle = index % 2 ? "#fff36a" : "#a8ef72"; ctx.fillRect(tailX - 2, tailY - 2, 4, 4);
        ctx.fillStyle = "#fff8dc"; ctx.fillRect(tailX - 1, tailY - 1, 2, 2);
        if (index % 3 === 0) { ctx.fillStyle = "#fff8dc"; ctx.fillRect(tailX - 6, tailY, 3, 2); ctx.fillRect(tailX + 3, tailY, 3, 2); }
      } else if (equipped.trail === "bubble-pop") {
        const size = 3 + index % 4;
        ctx.fillStyle = index % 2 ? "#a8f5ff" : "#4ad6ff";
        ctx.fillRect(tailX - size, tailY - size + 1, size * 2, 2); ctx.fillRect(tailX - size, tailY + size - 1, size * 2, 2);
        ctx.fillRect(tailX - size, tailY - size, 2, size * 2); ctx.fillRect(tailX + size - 1, tailY - size, 2, size * 2);
        ctx.fillStyle = "#fff8dc"; ctx.fillRect(tailX - size + 2, tailY - size + 2, 2, 2);
      } else if (equipped.trail === "stardust") {
        const arm = index % 3 === 0 ? 6 : 4;
        ctx.fillStyle = index % 3 === 0 ? "#ef79ff" : index % 3 === 1 ? "#79ecff" : "#fff36a";
        ctx.fillRect(tailX - 1, tailY - arm, 3, arm * 2 + 1); ctx.fillRect(tailX - arm, tailY - 1, arm * 2 + 1, 3);
        ctx.fillStyle = "#fff8dc"; ctx.fillRect(tailX - 1, tailY - 1, 3, 3);
      } else {
        const length = 10 + index * 3 + pulse;
        ctx.fillStyle = index % 2 ? "#ff8b3d" : "#fff36a";
        ctx.fillRect(direction.x < 0 ? tailX - length : tailX, direction.y ? tailY - 2 : tailY, direction.x ? length : 3, direction.y ? length : 3);
        ctx.fillStyle = "#fff8dc"; ctx.fillRect(tailX, tailY, 3, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  diamond(ctx, { x: x + 2, y: y + 8 }, 40, 12, "rgba(41,35,57,.32)");
  ctx.fillStyle = "#342c4e"; ctx.fillRect(x - 15, y + 5, 33, 4);
  const scooterPalette = equipped.scooter === "moss-runner" ? ["#638d47", "#b9c96a"] : equipped.scooter === "tide-rider" ? ["#35a9c8", "#a8eee3"] : equipped.scooter === "nebula-glide" ? ["#7747bd", "#ef79ff"] : ["#e65245", "#f59655"];
  ctx.fillStyle = scooterPalette[0]; ctx.fillRect(x - 12, y, 27, 7); ctx.fillRect(x + 11, y - 4, 8, 6); ctx.fillStyle = scooterPalette[1]; ctx.fillRect(x - 9, y + 1, 18, 2);
  if (equipped.scooter === "moss-runner") {
    ctx.fillStyle = "#8b5936"; ctx.fillRect(x - 10, y + 3, 22, 3); ctx.fillStyle = "#a8d66d"; ctx.fillRect(x - 13, y - 2, 5, 4); ctx.fillRect(x + 8, y - 4, 4, 3);
    ctx.fillStyle = "#31583d"; ctx.fillRect(x - 12, y - 3, 2, 4); ctx.fillRect(x + 10, y - 6, 2, 4);
  } else if (equipped.scooter === "tide-rider") {
    ctx.fillStyle = "#d9ffff"; ctx.fillRect(x - 8, y + 2, 15, 2); ctx.fillStyle = "#2377b7"; ctx.fillRect(x + 12, y - 7, 5, 3);
    if (moving) { const splash = reduced ? 0 : Math.floor(now / 90) % 3; ctx.fillStyle = "#a8f5ff"; ctx.fillRect(x - 17 - splash * 2, y + 5 - splash, 3, 3); ctx.fillRect(x - 21 - splash, y + 8, 2, 2); }
  } else if (equipped.scooter === "nebula-glide") {
    ctx.fillStyle = "#25215a"; ctx.fillRect(x - 9, y + 4, 18, 2); ctx.fillStyle = "#79ecff"; ctx.fillRect(x - 7, y + 1, 3, 3); ctx.fillStyle = "#fff8dc"; ctx.fillRect(x + 4, y, 2, 2);
    if (boosting) { ctx.fillStyle = Math.floor(now / 80) % 2 ? "#ef79ff" : "#79ecff"; ctx.fillRect(x + 14, y - 9, 2, 5); ctx.fillRect(x + 12, y - 7, 6, 2); }
  }
  ctx.fillStyle = "#fff36a"; ctx.fillRect(x + 17, y - 6, 3, 3);
  ctx.fillStyle = "#26253a"; ctx.fillRect(x - 10, y + 7, 7, 7); ctx.fillRect(x + 9, y + 7, 7, 7);
  ctx.fillStyle = "#a8e6e1"; ctx.fillRect(x - 8, y + 9, 3, 3); ctx.fillRect(x + 11, y + 9, 3, 3);
  const scale = 2, left = x - 16, top = y - 29;
  ctx.fillStyle = "#fff8dc";
  rows.forEach((row, py) => [...row].forEach((pixel, px) => { if (pixel === "#") { const sx = left + px * scale, sy = top + py * scale; ctx.fillRect(sx - 1, sy, scale + 2, scale); ctx.fillRect(sx, sy - 1, scale, scale + 2); } }));
  ctx.fillStyle = "#090a12";
  rows.forEach((row, py) => [...row].forEach((pixel, px) => { if (pixel === "#") ctx.fillRect(left + px * scale, top + py * scale, scale, scale); }));
  const hatBob = reduced ? 0 : Math.round(Math.sin(now / 170));
  if (equipped.headgear === "leaf-cap") {
    ctx.fillStyle = "#213f34"; ctx.fillRect(x - 12, y - 31, 24, 3);
    const sway = reduced ? 0 : Math.floor(now / 260) % 2;
    ctx.fillStyle = "#5f9b49"; ctx.fillRect(x - 8 + sway, y - 37 + hatBob, 10, 6); ctx.fillRect(x + sway, y - 40 + hatBob, 9, 7);
    ctx.fillStyle = "#a8d66d"; ctx.fillRect(x - 5 + sway, y - 36 + hatBob, 6, 2); ctx.fillRect(x + 2 + sway, y - 39 + hatBob, 5, 2);
    ctx.fillStyle = "#31583d"; ctx.fillRect(x - 9 + sway, y - 35 + hatBob, 3, 3);
  } else if (equipped.headgear === "coral-goggles") {
    ctx.fillStyle = "#342c4e"; ctx.fillRect(x - 12, y - 33, 25, 3);
    ctx.fillStyle = "#ff6b3d"; ctx.fillRect(x - 10, y - 36 + hatBob, 8, 6); ctx.fillRect(x + 4, y - 36 + hatBob, 8, 6);
    ctx.fillStyle = "#39d9ef"; ctx.fillRect(x - 8, y - 35 + hatBob, 4, 3); ctx.fillRect(x + 6, y - 35 + hatBob, 4, 3);
    if (reduced || Math.floor(now / 360) % 3 === 0) { ctx.fillStyle = "#fff8dc"; ctx.fillRect(x - 8, y - 35 + hatBob, 2, 2); ctx.fillRect(x + 6, y - 35 + hatBob, 2, 2); }
  } else if (equipped.headgear === "orbit-halo") {
    const orbit = reduced ? 0 : Math.round(Math.sin(now / 190) * 7);
    ctx.fillStyle = "#f4a83b"; ctx.fillRect(x - 12, y - 39 + hatBob, 24, 2); ctx.fillStyle = "#fff36a"; ctx.fillRect(x - 9, y - 41 + hatBob, 18, 2); ctx.fillRect(x - 15, y - 38 + hatBob, 5, 2); ctx.fillRect(x + 10, y - 38 + hatBob, 5, 2);
    ctx.fillStyle = "#79ecff"; ctx.fillRect(x + orbit - 1, y - 44 + hatBob, 3, 5); ctx.fillRect(x + orbit - 2, y - 43 + hatBob, 5, 3); ctx.fillStyle = "#fff8dc"; ctx.fillRect(x + orbit, y - 42 + hatBob, 1, 1);
  }
  if (carrying) {
    ctx.fillStyle = "#f09b39"; ctx.fillRect(x - 16, y - 10, 9, 8); ctx.fillStyle = "#fff4b0"; ctx.fillRect(x - 13, y - 10, 3, 8);
  }
  if (powered) {
    const flash = reduced ? 0 : Math.floor(now / 80) % 3;
    ctx.fillStyle = "#fff8dc"; ctx.fillRect(x - 20 + flash * 2, y - 42, 4, 4); ctx.fillRect(x + 18 - flash * 2, y - 24, 3, 3);
  }
}

function freshHud(): Hud {
  return { time: ROUTE_SECONDS, score: 0, rf: 0, combo: 1, hearts: 3, deliveries: 0, carrying: false, boost: 100, powerTime: 0, message: "Grab the sparkling parcel!" };
}

export default function SkyParcelPanic({ friendId, ownedFriendIds, client, paused }: GameComponentProps) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shopPreview = useRef<HTMLCanvasElement>(null);
  const sprites = useRef<GenerationSprites | null>(null);
  const recipientRoster = useRef<{ id: bigint; sprites: GenerationSprites }[]>([]);
  const recipientSprites = useRef<GenerationSprites | null>(null);
  const recipientFriendId = useRef(friendId);
  const [initialLayout] = useState(() => createRouteLayout(0));
  const layout = useRef<RouteLayout>(initialLayout);
  const selectedMap = useRef(0);
  const player = useRef<Point>({ ...START });
  const camera = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const game = useRef({ phase: "ready" as Phase, district: 0, time: ROUTE_SECONDS, score: 0, rf: 0, collectedCoins: new Set<number>(), combo: 1, comboClock: 0, hearts: 3, deliveries: 0, carrying: false, target: -1, parcel: 0, boost: 100, lastCoinBoost: 0, invulnerable: 0, powerBuffCollected: false, powerTime: 0, celebrationTarget: -1, celebrationUntil: 0, message: "Grab the sparkling parcel!", result: "", rank: "C" as RouteRank, rankReward: 0 });
  const [phase, setPhase] = useState<Phase>("ready");
  const [district, setDistrict] = useState(0);
  const [hud, setHud] = useState<Hud>(freshHud);
  const [status, setStatus] = useState("Loading your Rare Friend and the floating town…");
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [help, setHelp] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopCategory, setShopCategory] = useState<CosmeticCategory>("headgear");
  const [selectedCosmetic, setSelectedCosmetic] = useState("leaf-cap");
  const [closetBalance, setClosetBalance] = useState(420);
  const [ownedCosmetics, setOwnedCosmetics] = useState<string[]>(["leaf-cap"]);
  const [equippedCosmetics, setEquippedCosmetics] = useState<EquippedCosmetics>({ headgear: "leaf-cap", scooter: "default", trail: null });
  const equippedRef = useRef(equippedCosmetics); equippedRef.current = equippedCosmetics;
  const [reducedMotion, setReducedMotion] = useState(false);
  const live = useRef({ paused, help, shopOpen, reducedMotion }); live.current = { paused, help, shopOpen, reducedMotion };

  const stopInput = () => keys.current.clear();
  const syncHud = () => {
    const value = game.current;
    setHud({ time: Math.max(0, Math.ceil(value.time)), score: value.score, rf: value.rf, combo: value.combo, hearts: value.hearts, deliveries: value.deliveries, carrying: value.carrying, boost: Math.round(value.boost), powerTime: Math.max(0, Math.ceil(value.powerTime)), message: value.message });
  };
  const startRun = (selection: number | "random") => {
    const chosenMap = selection === "random" ? Math.floor(Math.random() * mapOptions.length) : selection;
    selectedMap.current = chosenMap; layout.current = createRouteLayout(chosenMap);
    Object.assign(game.current, { phase: "playing", district: 0, time: ROUTE_SECONDS, score: 0, rf: 0, collectedCoins: new Set<number>(), combo: 1, comboClock: 0, hearts: 3, deliveries: 0, carrying: false, target: -1, parcel: 0, boost: 100, lastCoinBoost: 0, invulnerable: 0, powerBuffCollected: false, powerTime: 0, celebrationTarget: -1, celebrationUntil: 0, message: `Explore ${mapOptions[chosenMap].name} and find the parcel!`, result: "", rank: "C" as RouteRank, rankReward: 0 });
    player.current = { ...START }; stopInput(); setDistrict(0); setPhase("playing"); syncHud(); setHelp(false);
    requestAnimationFrame(() => root.current?.focus());
  };
  const returnToMapSelect = () => {
    game.current.phase = "ready"; stopInput(); setPhase("ready");
  };

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches); update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (paused || help || shopOpen) stopInput(); }, [paused, help, shopOpen]);
  useEffect(() => {
    const node = shopPreview.current, art = sprites.current;
    if (!shopOpen || !node || !art) return;
    const ctx = node.getContext("2d"); if (!ctx) return;
    let frame = 0;
    const paint = (now: number) => {
      ctx.clearRect(0, 0, VIEW.width, VIEW.height); ctx.imageSmoothingEnabled = false;
      ctx.save(); ctx.translate(230, 180); ctx.scale(2.15, 2.15); ctx.translate(-230, -180);
      drawFriendOnScooter(ctx, art, START, "right", true, now, reducedMotion, false, false, equippedCosmetics.trail !== null, false, equippedCosmetics);
      ctx.restore(); frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [shopOpen, equippedCosmetics, reducedMotion]);
  useEffect(() => {
    let cancelled = false;
    setStatus("Loading your Rare Friend and the floating town…"); setFailed(false);
    const reader = createFriendReader();
    const receiverIds = [...new Set(ownedFriendIds.filter(id => id !== friendId))];
    const receivers = Promise.all(receiverIds.map(async id => {
      try { return { id, sprites: await reader.read(id) }; } catch { return null; }
    }));
    void Promise.all([reader.read(friendId), client.read(), receivers]).then(([art, snapshot, receiverArt]) => {
      if (cancelled) return;
      if (snapshot.friendId !== friendId) throw new Error("Selected Friend mismatch");
      const verifiedReceivers = receiverArt.filter((entry): entry is { id: bigint; sprites: GenerationSprites } => entry !== null);
      recipientRoster.current = verifiedReceivers.length ? verifiedReceivers : [{ id: friendId, sprites: art }];
      const firstReceiver = recipientRoster.current[0];
      sprites.current = art; recipientSprites.current = firstReceiver.sprites; recipientFriendId.current = firstReceiver.id; setStatus("");
    }).catch(() => { if (!cancelled) { setFailed(true); setStatus("The town could not load. Check your connection and retry."); } });
    return () => { cancelled = true; };
  }, [friendId, ownedFriendIds, client, revision]);

  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext("2d");
    if (!node || !ctx || !sprites.current || status) return;
    let frame = 0, previous = performance.now(), lastHud = "", facing: SpriteFacing = "right", moving = false;
    const onBlur = () => stopInput();
    const onHidden = () => { if (document.hidden) stopInput(); };
    window.addEventListener("blur", onBlur); document.addEventListener("visibilitychange", onHidden);

    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      const session = game.current, point = player.current, route = layout.current;
      moving = false; let boosting = false, powerActive = session.powerTime > 0;
      if (session.phase === "playing" && !live.current.paused && !live.current.help && !live.current.shopOpen && !document.hidden) {
        const screenDx = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
        const screenDy = Number(keys.current.has("s") || keys.current.has("arrowdown")) - Number(keys.current.has("w") || keys.current.has("arrowup"));
        let dx = screenDx + screenDy, dy = screenDy - screenDx;
        boosting = (keys.current.has(" ") || keys.current.has("shift") || keys.current.has("boost")) && (session.boost > 0 || powerActive);
        if (boosting && !powerActive) session.boost = Math.max(0, session.boost - dt * 34); else if (!boosting) session.boost = Math.min(100, session.boost + dt * 14);
        if (dx || dy) {
          const length = Math.hypot(dx, dy), speed = boosting ? 205 : 138;
          dx /= length; dy /= length; advance(point, dx * speed * dt, dy * speed * dt, session.district); moving = true;
          facing = Math.abs(screenDx) > Math.abs(screenDy) ? screenDx < 0 ? "left" : "right" : screenDy < 0 ? "up" : "down";
        }
        const scenes = mapOptions[selectedMap.current].scenes;
        const screenPoint = project(point);
        const insideSignedGate = screenPoint.y >= 104 && screenPoint.y <= 210;
        if (screenPoint.x >= 428 && insideSignedGate && session.district < scenes.length - 1) {
          session.district += 1; Object.assign(point, unproject({ x: 54, y: clamp(screenPoint.y, 104, 250) })); setDistrict(session.district);
          session.message = `Entered ${scenes[session.district].name}`;
        } else if (screenPoint.x <= 52 && insideSignedGate && session.district > 0) {
          session.district -= 1; Object.assign(point, unproject({ x: 426, y: clamp(screenPoint.y, 104, 250) })); setDistrict(session.district);
          session.message = `Entered ${scenes[session.district].name}`;
        }
        session.time -= dt; session.comboClock = Math.max(0, session.comboClock - dt); session.invulnerable = Math.max(0, session.invulnerable - dt); session.powerTime = Math.max(0, session.powerTime - dt);
        route.rfCoins.forEach((coin, index) => {
          if (coin.district !== session.district || session.collectedCoins.has(index) || distance(point, coin) >= 24) return;
          const reward = (5 + Math.floor(Math.random() * 6)) / 100;
          session.collectedCoins.add(index); session.rf = Math.round((session.rf + reward) * 100) / 100; session.score += 5;
          session.boost = Math.min(100, session.boost + COIN_BOOST_RESTORE); session.lastCoinBoost = COIN_BOOST_RESTORE;
          session.message = `Coin collected — +${reward.toFixed(2)} RF · +${COIN_BOOST_RESTORE} boost!`;
        });
        if (route.powerBuff && !session.powerBuffCollected && route.powerBuff.district === session.district && distance(point, route.powerBuff) < 30) {
          session.powerBuffCollected = true; session.powerTime = POWER_BUFF_DURATION; session.boost = 100; powerActive = true; session.score += 75;
          session.message = `STAR CORE! Free boost and hazard shield for ${POWER_BUFF_DURATION} seconds!`;
        }
        if (!session.carrying && session.district === route.parcels[session.parcel].district && distance(point, route.parcels[session.parcel]) < 30) {
          const freshChoices = recipientRoster.current.filter(entry => entry.id !== recipientFriendId.current);
          const choices = freshChoices.length ? freshChoices : recipientRoster.current;
          const receiver = choices[Math.floor(Math.random() * choices.length)];
          if (receiver) { recipientFriendId.current = receiver.id; recipientSprites.current = receiver.sprites; }
          session.carrying = true; session.target = targetOrder[session.deliveries]; session.score += 25;
          session.message = `Parcel secured — head to ${route.deliveryStops[session.target].name}!`;
        }
        const targetStop = session.target >= 0 ? route.deliveryStops[session.target] : null;
        if (session.carrying && targetStop && session.district === targetStop.district && distance(point, targetStop) < 36) {
          session.celebrationTarget = session.target; session.celebrationUntil = now + 1400;
          session.deliveries += 1; session.combo = session.comboClock > 0 ? Math.min(5, session.combo + 1) : 1; session.comboClock = 12;
          session.score += 100 * session.combo; session.carrying = false; session.target = -1; session.parcel = session.deliveries % route.parcels.length;
          session.message = session.deliveries >= DELIVERY_GOAL ? "Perfect route!" : `Delivery complete — combo x${session.combo}!`;
        }
        for (const hazard of route.hazards) {
          if (hazard.district !== session.district) continue;
          if (!powerActive && session.invulnerable <= 0 && distance(point, hazardPosition(hazard, now)) < 22) {
            session.hearts -= 1; session.time -= 2; session.score = Math.max(0, session.score - 40); session.invulnerable = 2.2;
            session.message = "BONK! Watch the town traffic!"; advance(point, -dx * 18 || -12, -dy * 18 || 8, session.district); break;
          }
        }
        if (session.deliveries >= DELIVERY_GOAL || session.time <= 0 || session.hearts <= 0) {
          const completed = session.deliveries >= DELIVERY_GOAL;
          const grade = rankRoute(Math.ceil(session.time), completed);
          session.phase = "finished";
          session.rank = grade.rank; session.rankReward = grade.reward;
          session.result = completed ? "ROUTE COMPLETE!" : session.hearts <= 0 ? "SCOOTER BONKED!" : "TIME'S UP!";
          if (grade.reward > 0) setClosetBalance(value => value + grade.reward);
          stopInput(); setPhase("finished");
        }
      }

      camera.current.x = 0; camera.current.y = 0;
      const shake = !live.current.reducedMotion && session.invulnerable > 1.05 ? (Math.floor(now / 45) % 2 ? 2 : -2) : 0;
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, VIEW.width, VIEW.height); ctx.save();
      ctx.translate(-camera.current.x + shake, -camera.current.y);
      const layers: { depth: number; paint: () => void }[] = [];
      const celebrating = now < session.celebrationUntil;
      const recipientIndex = session.carrying && session.target >= 0 ? session.target : celebrating ? session.celebrationTarget : -1;
      const recipient = recipientIndex >= 0 ? route.deliveryStops[recipientIndex] : null;
      if (recipient && session.district === recipient.district && recipientSprites.current) {
        layers.push({ depth: recipient.x + recipient.y, paint: () => drawDeliveryMarker(ctx, recipientSprites.current!, recipientFriendId.current, recipient, now, live.current.reducedMotion, celebrating && !session.carrying) });
      }
      route.rfCoins.forEach((coin, index) => {
        if (coin.district === session.district && !session.collectedCoins.has(index)) layers.push({ depth: coin.x + coin.y + 6, paint: () => drawRfCoin(ctx, coin, index, now, live.current.reducedMotion) });
      });
      if (route.powerBuff && !session.powerBuffCollected && route.powerBuff.district === session.district) layers.push({ depth: route.powerBuff.x + route.powerBuff.y + 8, paint: () => drawPowerBuff(ctx, route.powerBuff!, now, live.current.reducedMotion) });
      route.hazards.forEach(hazard => { if (hazard.district !== session.district) return; const at = hazardPosition(hazard, now); layers.push({ depth: at.x + at.y + 12, paint: () => drawHazard(ctx, hazard, at, now, live.current.reducedMotion) }); });
      const parcel = route.parcels[session.parcel];
      const deliveryStop = session.target >= 0 ? route.deliveryStops[session.target] : null;
      if (!session.carrying && session.phase !== "finished" && session.district === parcel.district) layers.push({ depth: parcel.x + parcel.y + 10, paint: () => drawParcel(ctx, parcel, now, live.current.reducedMotion) });
      layers.push({ depth: point.x + point.y + 16, paint: () => drawFriendOnScooter(ctx, sprites.current!, point, facing, moving, now, live.current.reducedMotion, session.invulnerable > 0, session.carrying, boosting, powerActive, equippedRef.current) });
      layers.sort((a, b) => a.depth - b.depth).forEach(layer => layer.paint());
      ctx.restore();
      node.dataset.playerX = point.x.toFixed(2); node.dataset.playerY = point.y.toFixed(2); node.dataset.district = String(session.district);
      node.dataset.routeSeconds = String(ROUTE_SECONDS); node.dataset.rank = session.rank; node.dataset.rankReward = String(session.rankReward);
      node.dataset.powerBuffSpawnRate = String(POWER_BUFF_SPAWN_RATE); node.dataset.powerBuffDuration = String(POWER_BUFF_DURATION); node.dataset.powerBuffSpawned = String(route.powerBuff !== null); node.dataset.powerActive = String(powerActive); node.dataset.powerTime = String(Math.max(0, Math.ceil(session.powerTime)));
      if (route.powerBuff && !session.powerBuffCollected) { node.dataset.powerBuffX = String(route.powerBuff.x); node.dataset.powerBuffY = String(route.powerBuff.y); node.dataset.powerBuffDistrict = String(route.powerBuff.district); } else { delete node.dataset.powerBuffX; delete node.dataset.powerBuffY; delete node.dataset.powerBuffDistrict; }
      node.dataset.headgear = equippedRef.current.headgear ?? "none"; node.dataset.scooterSkin = equippedRef.current.scooter; node.dataset.boostTrail = equippedRef.current.trail ?? "none";
      node.dataset.receiverId = recipientFriendId.current.toString(); node.dataset.rf = String(session.rf); node.dataset.boost = String(Math.round(session.boost)); node.dataset.boosting = String(boosting); node.dataset.coinBoost = String(COIN_BOOST_RESTORE); node.dataset.lastCoinBoost = String(session.lastCoinBoost);
      node.dataset.layoutId = route.id; node.dataset.totalCoins = String(route.rfCoins.length); node.dataset.totalDistricts = String(mapOptions[selectedMap.current].scenes.length); node.dataset.selectedMap = String(selectedMap.current);
      node.dataset.collectedCoins = String(session.collectedCoins.size);
      const visibleCoins = route.rfCoins.filter((coin, index) => coin.district === session.district && !session.collectedCoins.has(index));
      const visibleHazards = route.hazards.filter(hazard => hazard.district === session.district);
      const coinScreens = visibleCoins.map(project), hazardScreens = visibleHazards.map(project);
      const span = (values: number[]) => values.length ? Math.round(Math.max(...values) - Math.min(...values)) : 0;
      node.dataset.visibleCoins = String(visibleCoins.length); node.dataset.visibleHazards = String(visibleHazards.length);
      node.dataset.hazardMinRange = String(Math.min(...visibleHazards.map(hazard => hazard.range)));
      node.dataset.hazardMaxRange = String(Math.max(...visibleHazards.map(hazard => hazard.range)));
      node.dataset.coinSpreadX = String(span(coinScreens.map(coin => coin.x)));
      node.dataset.coinSpreadY = String(span(coinScreens.map(coin => coin.y)));
      node.dataset.hazardSpreadX = String(span(hazardScreens.map(hazard => hazard.x)));
      const exitGate = unproject({ x: 400, y: 160 });
      node.dataset.gateX = exitGate.x.toFixed(2); node.dataset.gateY = exitGate.y.toFixed(2);
      const nextCoin = route.rfCoins.find((coin, index) => coin.district === session.district && !session.collectedCoins.has(index));
      if (nextCoin) { node.dataset.coinX = String(nextCoin.x); node.dataset.coinY = String(nextCoin.y); }
      else { delete node.dataset.coinX; delete node.dataset.coinY; }
      if (!session.carrying) {
        node.dataset.parcelX = String(parcel.x); node.dataset.parcelY = String(parcel.y); node.dataset.parcelDistrict = String(parcel.district);
        delete node.dataset.targetX; delete node.dataset.targetY; delete node.dataset.targetDistrict;
      } else if (deliveryStop) {
        node.dataset.targetX = String(deliveryStop.x); node.dataset.targetY = String(deliveryStop.y); node.dataset.targetDistrict = String(deliveryStop.district);
        delete node.dataset.parcelX; delete node.dataset.parcelY; delete node.dataset.parcelDistrict;
      }
      const nextHud = `${Math.ceil(session.time)}|${session.score}|${session.rf}|${session.combo}|${session.hearts}|${session.deliveries}|${session.carrying}|${Math.round(session.boost / 4)}|${Math.max(0, Math.ceil(session.powerTime))}|${session.message}`;
      if (nextHud !== lastHud) { lastHud = nextHud; syncHud(); }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); stopInput(); window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onHidden); };
  }, [status]);

  const setDirection = (key: string, active: boolean) => { if (phase !== "playing" || paused || help || shopOpen) return; active ? keys.current.add(key) : keys.current.delete(key); root.current?.focus(); };
  const handleKey = (event: React.KeyboardEvent<HTMLElement>, active: boolean) => {
    const key = event.key.toLowerCase(); if (!movementKeys.has(key) || phase !== "playing" || help || shopOpen) return;
    event.preventDefault(); active ? keys.current.add(key) : keys.current.delete(key);
  };
  const chosenCosmetic = cosmetics.find(item => item.id === selectedCosmetic) ?? cosmetics[0];
  const isEquipped = chosenCosmetic.category === "headgear" ? equippedCosmetics.headgear === chosenCosmetic.id : chosenCosmetic.category === "scooter" ? equippedCosmetics.scooter === chosenCosmetic.id : equippedCosmetics.trail === chosenCosmetic.id;
  const itemIsEquipped = (item: Cosmetic) => item.category === "headgear" ? equippedCosmetics.headgear === item.id : item.category === "scooter" ? equippedCosmetics.scooter === item.id : equippedCosmetics.trail === item.id;
  const equipCosmetic = (item: Cosmetic) => setEquippedCosmetics(current => ({ ...current, [item.category]: item.id }));
  const buyCosmetic = (item: Cosmetic) => {
    if (ownedCosmetics.includes(item.id) || closetBalance < item.price) return;
    setClosetBalance(value => value - item.price);
    setOwnedCosmetics(items => [...items, item.id]);
    setSelectedCosmetic(item.id); equipCosmetic(item);
  };
  const activeWorld = mapOptions[selectedMap.current];
  const routeDestinationDistrict = hud.carrying && game.current.target >= 0
    ? layout.current.deliveryStops[game.current.target].district
    : layout.current.parcels[game.current.parcel]?.district ?? district;
  return <main ref={root} className={`parcel-game phase-${phase}`} role="region" aria-label="Sky Parcel Panic game" tabIndex={0}
    onKeyDown={event => handleKey(event, true)} onKeyUp={event => handleKey(event, false)}>
    <img className="postal-plaza" src={activeWorld.scenes[district].image} alt="" aria-hidden="true" />
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} role="img"
      aria-label="Sky Parcel Panic town. Drive with WASD or arrow keys, collect parcels and deliver them to highlighted houses." />

    <header className="parcel-hud">
      <div className="brand"><small>RARE FRIEND #{friendId.toString()}</small><strong>SKY PARCEL PANIC</strong></div>
      <div className="timer" aria-label={`${formatTime(hud.time)} remaining`}><small>ROUTE TIME</small><strong>{formatTime(hud.time)}</strong></div>
      <div className="score"><span>◆ {hud.rf.toFixed(2)} RF</span><b>★ {hud.score.toString().padStart(4, "0")} · COMBO x{hud.combo}</b></div>
      <button type="button" onClick={() => setShopOpen(true)}>Shop</button>
      <button type="button" onClick={() => setHelp(true)}>How to play</button>
    </header>

    <aside className="route-card" aria-live="polite">
      <span>{phase === "playing" ? `RUNNING · ${activeWorld.name} · ${activeWorld.scenes[district].name}` : phase === "finished" ? "ROUTE CLOSED" : "READY"}</span>
      <strong>{hud.carrying ? "▣ PARCEL ON BOARD" : "◇ FIND THE PARCEL"}</strong>
      <p>{hud.message}</p>
      <div className="delivery-pips" aria-label={`${hud.deliveries} of ${DELIVERY_GOAL} deliveries`}>
        {Array.from({ length: DELIVERY_GOAL }, (_, index) => <i key={index} className={index < hud.deliveries ? "done" : ""} />)}
      </div>
    </aside>

    {phase === "playing" && <nav className="map-directions" aria-label="Connected scenes">
      {district > 0 && <div className={`map-sign map-sign-left ${routeDestinationDistrict < district ? "active" : ""}`}>
        <b aria-hidden="true">←</b><span><small>{routeDestinationDistrict < district ? "GO HERE" : "PREVIOUS"}</small><strong>{activeWorld.scenes[district - 1].name}</strong></span>
      </div>}
      {district < activeWorld.scenes.length - 1 && <div className={`map-sign map-sign-right ${routeDestinationDistrict > district ? "active" : ""}`}>
        <span><small>{routeDestinationDistrict > district ? "GO HERE" : "NEXT"}</small><strong>{activeWorld.scenes[district + 1].name}</strong></span><b aria-hidden="true">→</b>
      </div>}
    </nav>}

    <div className="hearts" aria-label={`${hud.hearts} hearts`}>{Array.from({ length: 3 }, (_, index) => <span key={index} className={index < hud.hearts ? "full" : ""}>♥</span>)}</div>

    {phase === "playing" && <>
      {hud.powerTime > 0 && <div className="power-status" role="status"><span aria-hidden="true">✦</span><strong>STAR POWER</strong><b>{hud.powerTime}s</b><small>FREE BOOST · SHIELD</small></div>}
      <div className="touch-pad" aria-label="Touch steering controls">
        <button aria-label="Drive up" onPointerDown={() => setDirection("arrowup", true)} onPointerUp={() => setDirection("arrowup", false)} onPointerCancel={() => setDirection("arrowup", false)}>▲</button>
        <button aria-label="Drive left" onPointerDown={() => setDirection("arrowleft", true)} onPointerUp={() => setDirection("arrowleft", false)} onPointerCancel={() => setDirection("arrowleft", false)}>◀</button>
        <button aria-label="Drive down" onPointerDown={() => setDirection("arrowdown", true)} onPointerUp={() => setDirection("arrowdown", false)} onPointerCancel={() => setDirection("arrowdown", false)}>▼</button>
        <button aria-label="Drive right" onPointerDown={() => setDirection("arrowright", true)} onPointerUp={() => setDirection("arrowright", false)} onPointerCancel={() => setDirection("arrowright", false)}>▶</button>
      </div>
      <button className="boost" type="button" aria-label="Boost scooter" onPointerDown={() => setDirection("boost", true)} onPointerUp={() => setDirection("boost", false)} onPointerCancel={() => setDirection("boost", false)}>
        BOOST <i><span style={{ width: `${hud.boost}%` }} /></i><small>SPACE / SHIFT</small>
      </button>
    </>}

    {status && <section className="parcel-overlay" role={failed ? "alert" : "status"}>
      <div><span className="big-icon">☁</span><h1>SKY PARCEL PANIC</h1><p>{status}</p>{failed && <button type="button" disabled={paused} onClick={() => setRevision(value => value + 1)}>RETRY LOADING</button>}</div>
    </section>}
    {!status && phase === "ready" && <section className="parcel-overlay intro map-select">
      <div><span className="eyebrow">CHOOSE TODAY'S ROUTE</span><h1>PICK A WORLD.</h1><p>Complete all five deliveries within five minutes. Finish faster for a higher rank and a larger RF bonus.</p>
        <div className="map-choice-grid">
          {mapOptions.map((option, index) => <button className="map-choice" type="button" disabled={paused} onClick={() => startRun(index)} aria-label={`Play ${option.name}`} key={option.name}>
            <img src={option.scenes[0].image} alt="" /><span><strong>{option.name}</strong><small>{option.caption}</small></span>
          </button>)}
          <button className="map-choice random-choice" type="button" disabled={paused} onClick={() => startRun("random")} aria-label="Play Random Map">
            <span className="random-preview" aria-hidden="true">?</span><span><strong>RANDOM MAP</strong><small>SURPRISE ROUTE</small></span>
          </button>
        </div><small>WASD / ARROWS · HOLD SPACE TO BOOST</small></div>
    </section>}
    {phase === "finished" && <section className="parcel-overlay result" aria-live="assertive">
      <div><span className="eyebrow">FINAL DELIVERY REPORT · {activeWorld.name}</span><h1>{game.current.result}</h1><div className={`rank-badge rank-${game.current.rank.toLowerCase()}`}><small>ROUTE RANK</small><strong>{game.current.rank}</strong></div><p><b>{hud.deliveries}/{DELIVERY_GOAL}</b> parcels · <b>{formatTime(hud.time)}</b> remaining · <b>{hud.score}</b> points<br /><span className="rank-reward">+{game.current.rankReward} RF rank bonus</span> · {hud.rf.toFixed(2)} RF collected on route</p><div className="result-actions"><button type="button" disabled={paused} onClick={() => startRun(selectedMap.current)}>RIDE AGAIN</button><button type="button" disabled={paused} onClick={returnToMapSelect}>CHOOSE MAP</button></div></div>
    </section>}
    {help && <section className="help-panel" role="dialog" aria-modal="true" aria-label="How to play">
      <div><span className="eyebrow">COURIER HANDBOOK</span><h2>HOW TO PLAY</h2><ol><li>Choose a world or Random.</li><li>Complete five deliveries before the five-minute countdown ends.</li><li>Find the glowing delivery Friend.</li><li>Dodge moving hazards and build a ×5 combo.</li></ol><p>Boost is faster but drains its meter. Every RF coin restores {COIN_BOOST_RESTORE} boost. A rare Star Core grants {POWER_BUFF_DURATION} seconds of free boost and hazard immunity. Finish with 3:00 for S, 2:00 for A, 1:00 for B, or under 1:00 for C.</p><label><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduce motion</label><button type="button" onClick={() => { setHelp(false); requestAnimationFrame(() => root.current?.focus()); }}>BACK TO ROUTE</button></div>
    </section>}
    {shopOpen && <section className="closet-panel" role="dialog" aria-modal="true" aria-label="Courier Closet">
      <div className="closet-window interactive-closet">
        <header className="closet-header"><span className="closet-mark" aria-hidden="true">▥</span><div><h2>COURIER CLOSET</h2><p>FRESH LOOKS FOR FARTHER ROUTES</p></div><strong aria-label={`${closetBalance} RF available`}>◆ {closetBalance} RF</strong></header>
        <div className="closet-body">
          <div className="closet-preview-column">
            <div className="closet-preview" aria-label="Live equipped outfit preview" style={{ backgroundImage: `linear-gradient(rgba(30,35,52,.08),rgba(30,35,52,.08)),url(${activeWorld.scenes[district].image})` }}><canvas ref={shopPreview} width={VIEW.width} height={VIEW.height} aria-hidden="true" /></div>
            <div className="equipped-title"><i />LIVE OUTFIT<i /></div>
            <div className="equipped-summary">
              {(["headgear", "scooter", "trail"] as CosmeticCategory[]).map(category => {
                const id = equippedCosmetics[category], item = cosmetics.find(entry => entry.id === id);
                return <div key={category}>{item ? <img className="item-art" src={item.image} alt="" /> : <span className="item-art item-art-empty" />}<small>{category === "trail" ? "BOOST TRAIL" : category.toUpperCase()}</small><b>{item?.name ?? (category === "scooter" ? "CLASSIC" : "NONE")}</b></div>;
              })}
            </div>
          </div>
          <div className="closet-catalogue">
            <nav className="closet-tabs" aria-label="Cosmetic categories">
              {(["headgear", "scooter", "trail"] as CosmeticCategory[]).map(category => {
                const label = category === "headgear" ? "HEADGEAR" : category === "scooter" ? "SCOOTER" : "BOOST TRAIL";
                return <button type="button" className={shopCategory === category ? "active" : ""} aria-pressed={shopCategory === category} onClick={() => { setShopCategory(category); setSelectedCosmetic(cosmetics.find(item => item.category === category)!.id); }} key={category}>{label}</button>;
              })}
            </nav>
            <div className="closet-grid interactive-grid">
              {cosmetics.filter(item => item.category === shopCategory).map(item => {
                const owned = ownedCosmetics.includes(item.id), equipped = itemIsEquipped(item);
                return <article className={`cosmetic-card rarity-${item.rarity.toLowerCase()} ${selectedCosmetic === item.id ? "selected" : ""}`} key={item.id}>
                  <button className="cosmetic-select" type="button" aria-label={`Select ${item.name}`} onClick={() => setSelectedCosmetic(item.id)}><img className="item-art" src={item.image} alt="" /><strong>{item.name}</strong><span>◆ {item.price} RF</span><em>{item.rarity}</em></button>
                  <button className={equipped ? "equipped" : ""} type="button" disabled={equipped || (!owned && closetBalance < item.price)} aria-label={owned ? `Equip ${item.name}` : `Buy ${item.name} for ${item.price} RF`} onClick={() => owned ? equipCosmetic(item) : buyCosmetic(item)}>{equipped ? "EQUIPPED" : owned ? "EQUIP" : closetBalance < item.price ? "NEED RF" : "BUY"}</button>
                </article>;
              })}
            </div>
            <div className="selected-readout"><span><small>SELECTED</small><strong>{chosenCosmetic.name}</strong></span><b>{ownedCosmetics.includes(chosenCosmetic.id) ? "OWNED" : `◆ ${chosenCosmetic.price} RF`}</b></div>
            <div className="closet-actions"><button type="button" disabled={isEquipped || !ownedCosmetics.includes(chosenCosmetic.id)} aria-label={`Equip selected ${chosenCosmetic.name}`} onClick={() => equipCosmetic(chosenCosmetic)}>{isEquipped ? "EQUIPPED" : "EQUIP"}</button><button type="button" onClick={() => { setShopOpen(false); requestAnimationFrame(() => root.current?.focus()); }}>BACK TO ROUTE</button></div>
          </div>
        </div>
      </div>
    </section>}
  </main>;
}
