"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import "./style.css";
import plazaMapUrl from "./assets/postal-plaza-v3.png";
import gardenMapUrl from "./assets/garden-market-v3.png";
import windmillMapUrl from "./assets/windmill-route-v3.png";

type Point = { x: number; y: number };
type DistrictPoint = Point & { district: number; name: string };
type Box = Point & { width: number; height: number };
type Phase = "ready" | "playing" | "finished";
type Hud = { time: number; score: number; rf: number; combo: number; hearts: number; deliveries: number; carrying: boolean; boost: number; message: string };

const VIEW = { width: 480, height: 320 };
const WORLD = { width: 960, height: 640 };
const ISO = { originX: 197.5, originY: 76.25, width: VIEW.width, height: VIEW.height };
const TILE = 32;
const PLAYER_RADIUS = 12;
const START: Point = { x: 480, y: 350 };
const ROUTE_SECONDS = 45;
const DELIVERY_GOAL = 5;
const movementKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"]);

const houses = [
  { x: 90, y: 262, color: "#ff7c62", roof: "#d94e58", name: "Sky Post Office" },
] as const;

const districtMaps = [plazaMapUrl, gardenMapUrl, windmillMapUrl];
const districtNames = ["POSTAL PLAZA", "BLOOM MARKET", "WINDMILL ROUTE"];
const parcels: DistrictPoint[] = [
  { x: 480, y: 190, district: 0, name: "Plaza Parcel" },
  { x: 700, y: 290, district: 1, name: "Garden Parcel" },
  { x: 540, y: 330, district: 2, name: "Bridge Parcel" },
  { x: 720, y: 190, district: 2, name: "Mill Parcel" },
  { x: 540, y: 490, district: 1, name: "Market Parcel" },
];
const targetOrder = [0, 1, 2, 3, 4];
const rfCoins: DistrictPoint[] = [
  { x: 480, y: 300, district: 0, name: "Plaza Coin" },
  { x: 340, y: 360, district: 0, name: "Post Coin" },
  { x: 590, y: 390, district: 0, name: "Fountain Coin" },
  { x: 300, y: 310, district: 1, name: "Flower Coin" },
  { x: 450, y: 245, district: 1, name: "Market Coin" },
  { x: 610, y: 340, district: 1, name: "Garden Coin" },
  { x: 710, y: 430, district: 1, name: "East Coin" },
  { x: 250, y: 300, district: 2, name: "Bridge Coin" },
  { x: 410, y: 420, district: 2, name: "Cloud Coin" },
  { x: 570, y: 270, district: 2, name: "Mill Coin" },
  { x: 700, y: 370, district: 2, name: "Wind Coin" },
];
const deliveryStops: DistrictPoint[] = [
  { x: 225, y: 365, district: 1, name: "Bloom Market" },
  { x: 120, y: 270, district: 2, name: "Blue Cottage" },
  { x: 620, y: 50, district: 2, name: "Windmill Station" },
  { x: 900, y: 250, district: 1, name: "East Parcel Stall" },
  { x: 90, y: 300, district: 0, name: "Sky Post Office" },
];
const ponds: Box[] = [
  { x: 350, y: 620, width: 62, height: 58 },
];
const flowerBoxes: Box[] = [];
const obstacles: Box[] = [
  ...ponds,
];
const trees: Point[] = [];
const hazards = [
  { type: "carrot", x: 210, y: 540, axis: "x", range: 62, speed: .0014, phase: 0 },
  { type: "bird", x: 730, y: 340, axis: "y", range: 64, speed: .0012, phase: 2 },
  { type: "carrot", x: 660, y: 130, axis: "x", range: 54, speed: .0016, phase: 4 },
  { type: "bird", x: 180, y: 370, axis: "y", range: 48, speed: .0015, phase: 1 },
] as const;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const doorOf = (index: number): DistrictPoint => deliveryStops[index];
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

function hazardPosition(hazard: typeof hazards[number], now: number): Point {
  const wave = Math.sin(now * hazard.speed + hazard.phase) * hazard.range;
  return hazard.axis === "x" ? { x: hazard.x + wave, y: hazard.y } : { x: hazard.x, y: hazard.y + wave };
}

function drawHazard(ctx: CanvasRenderingContext2D, hazard: typeof hazards[number], point: Point, now: number, reduced: boolean) {
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

function drawFriendOnScooter(ctx: CanvasRenderingContext2D, sprites: GenerationSprites, point: Point, facing: SpriteFacing, moving: boolean, now: number, reduced: boolean, invulnerable: boolean, carrying: boolean) {
  if (invulnerable && Math.floor(now / 80) % 2) return;
  const side: "left" | "right" = facing === "left" ? "left" : "right";
  const rows = spriteFrame(sprites, facing, moving, reduced ? 0 : Math.floor(now / 120) % 8, side).frame.rows;
  const at = project(point), x = Math.round(at.x), y = Math.round(at.y);
  diamond(ctx, { x: x + 2, y: y + 8 }, 40, 12, "rgba(41,35,57,.32)");
  ctx.fillStyle = "#342c4e"; ctx.fillRect(x - 15, y + 5, 33, 4);
  ctx.fillStyle = "#e65245"; ctx.fillRect(x - 12, y, 27, 7); ctx.fillRect(x + 11, y - 4, 8, 6); ctx.fillStyle = "#f59655"; ctx.fillRect(x - 9, y + 1, 18, 2);
  ctx.fillStyle = "#fff36a"; ctx.fillRect(x + 17, y - 6, 3, 3);
  ctx.fillStyle = "#26253a"; ctx.fillRect(x - 10, y + 7, 7, 7); ctx.fillRect(x + 9, y + 7, 7, 7);
  ctx.fillStyle = "#a8e6e1"; ctx.fillRect(x - 8, y + 9, 3, 3); ctx.fillRect(x + 11, y + 9, 3, 3);
  const scale = 2, left = x - 16, top = y - 29;
  ctx.fillStyle = "#fff8dc";
  rows.forEach((row, py) => [...row].forEach((pixel, px) => { if (pixel === "#") { const sx = left + px * scale, sy = top + py * scale; ctx.fillRect(sx - 1, sy, scale + 2, scale); ctx.fillRect(sx, sy - 1, scale, scale + 2); } }));
  ctx.fillStyle = "#090a12";
  rows.forEach((row, py) => [...row].forEach((pixel, px) => { if (pixel === "#") ctx.fillRect(left + px * scale, top + py * scale, scale, scale); }));
  if (carrying) {
    ctx.fillStyle = "#f09b39"; ctx.fillRect(x - 16, y - 10, 9, 8); ctx.fillStyle = "#fff4b0"; ctx.fillRect(x - 13, y - 10, 3, 8);
  }
}

function freshHud(): Hud {
  return { time: ROUTE_SECONDS, score: 0, rf: 0, combo: 1, hearts: 3, deliveries: 0, carrying: false, boost: 100, message: "Grab the sparkling parcel!" };
}

export default function SkyParcelPanic({ friendId, ownedFriendIds, client, paused }: GameComponentProps) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sprites = useRef<GenerationSprites | null>(null);
  const recipientRoster = useRef<{ id: bigint; sprites: GenerationSprites }[]>([]);
  const recipientSprites = useRef<GenerationSprites | null>(null);
  const recipientFriendId = useRef(friendId);
  const player = useRef<Point>({ ...START });
  const camera = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const game = useRef({ phase: "ready" as Phase, district: 0, time: ROUTE_SECONDS, score: 0, rf: 0, collectedCoins: new Set<number>(), combo: 1, comboClock: 0, hearts: 3, deliveries: 0, carrying: false, target: -1, parcel: 0, boost: 100, invulnerable: 0, celebrationTarget: -1, celebrationUntil: 0, message: "Grab the sparkling parcel!", result: "" });
  const [phase, setPhase] = useState<Phase>("ready");
  const [district, setDistrict] = useState(0);
  const [hud, setHud] = useState<Hud>(freshHud);
  const [status, setStatus] = useState("Loading your Rare Friend and the floating town…");
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [help, setHelp] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const live = useRef({ paused, help, reducedMotion }); live.current = { paused, help, reducedMotion };

  const stopInput = () => keys.current.clear();
  const syncHud = () => {
    const value = game.current;
    setHud({ time: Math.max(0, Math.ceil(value.time)), score: value.score, rf: value.rf, combo: value.combo, hearts: value.hearts, deliveries: value.deliveries, carrying: value.carrying, boost: Math.round(value.boost), message: value.message });
  };
  const startRun = () => {
    Object.assign(game.current, { phase: "playing", district: 0, time: ROUTE_SECONDS, score: 0, rf: 0, collectedCoins: new Set<number>(), combo: 1, comboClock: 0, hearts: 3, deliveries: 0, carrying: false, target: -1, parcel: 0, boost: 100, invulnerable: 0, celebrationTarget: -1, celebrationUntil: 0, message: "Grab the sparkling parcel!", result: "" });
    player.current = { ...START }; stopInput(); setDistrict(0); setPhase("playing"); syncHud(); setHelp(false);
    requestAnimationFrame(() => root.current?.focus());
  };

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches); update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (paused || help) stopInput(); }, [paused, help]);
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
      const session = game.current, point = player.current;
      moving = false;
      if (session.phase === "playing" && !live.current.paused && !live.current.help && !document.hidden) {
        const screenDx = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
        const screenDy = Number(keys.current.has("s") || keys.current.has("arrowdown")) - Number(keys.current.has("w") || keys.current.has("arrowup"));
        let dx = screenDx + screenDy, dy = screenDy - screenDx;
        const boosting = (keys.current.has(" ") || keys.current.has("shift") || keys.current.has("boost")) && session.boost > 0;
        if (boosting) session.boost = Math.max(0, session.boost - dt * 34); else session.boost = Math.min(100, session.boost + dt * 14);
        if (dx || dy) {
          const length = Math.hypot(dx, dy), speed = boosting ? 205 : 138;
          dx /= length; dy /= length; advance(point, dx * speed * dt, dy * speed * dt, session.district); moving = true;
          facing = Math.abs(screenDx) > Math.abs(screenDy) ? screenDx < 0 ? "left" : "right" : screenDy < 0 ? "up" : "down";
        }
        const screenPoint = project(point);
        const insideSignedGate = screenPoint.y >= 104 && screenPoint.y <= 210;
        if (screenPoint.x >= 428 && insideSignedGate && session.district < districtMaps.length - 1) {
          session.district += 1; Object.assign(point, unproject({ x: 54, y: clamp(screenPoint.y, 104, 250) })); setDistrict(session.district);
          session.message = `Entered ${districtNames[session.district]}`;
        } else if (screenPoint.x <= 52 && insideSignedGate && session.district > 0) {
          session.district -= 1; Object.assign(point, unproject({ x: 426, y: clamp(screenPoint.y, 104, 250) })); setDistrict(session.district);
          session.message = `Entered ${districtNames[session.district]}`;
        }
        session.time -= dt; session.comboClock = Math.max(0, session.comboClock - dt); session.invulnerable = Math.max(0, session.invulnerable - dt);
        rfCoins.forEach((coin, index) => {
          if (coin.district !== session.district || session.collectedCoins.has(index) || distance(point, coin) >= 24) return;
          const reward = (5 + Math.floor(Math.random() * 6)) / 100;
          session.collectedCoins.add(index); session.rf = Math.round((session.rf + reward) * 100) / 100; session.score += 5;
          session.message = `Coin collected — +${reward.toFixed(2)} RF!`;
        });
        if (!session.carrying && session.district === parcels[session.parcel].district && distance(point, parcels[session.parcel]) < 30) {
          const freshChoices = recipientRoster.current.filter(entry => entry.id !== recipientFriendId.current);
          const choices = freshChoices.length ? freshChoices : recipientRoster.current;
          const receiver = choices[Math.floor(Math.random() * choices.length)];
          if (receiver) { recipientFriendId.current = receiver.id; recipientSprites.current = receiver.sprites; }
          session.carrying = true; session.target = targetOrder[session.deliveries]; session.score += 25;
          session.message = `Parcel secured — head to ${deliveryStops[session.target].name}!`;
        }
        if (session.carrying && session.target >= 0 && session.district === doorOf(session.target).district && distance(point, doorOf(session.target)) < 36) {
          session.celebrationTarget = session.target; session.celebrationUntil = now + 1400;
          session.deliveries += 1; session.combo = session.comboClock > 0 ? Math.min(5, session.combo + 1) : 1; session.comboClock = 12;
          session.score += 100 * session.combo; session.time += 3; session.carrying = false; session.target = -1; session.parcel = session.deliveries % parcels.length;
          session.message = session.deliveries >= DELIVERY_GOAL ? "Perfect route!" : `Delivery complete — combo x${session.combo}!`;
        }
        for (const hazard of hazards) {
          if (session.invulnerable <= 0 && distance(point, hazardPosition(hazard, now)) < 27) {
            session.hearts -= 1; session.time -= 2; session.score = Math.max(0, session.score - 40); session.invulnerable = 1.4;
            session.message = "BONK! Watch the town traffic!"; advance(point, -dx * 18 || -12, -dy * 18 || 8, session.district); break;
          }
        }
        if (session.deliveries >= DELIVERY_GOAL || session.time <= 0 || session.hearts <= 0) {
          session.phase = "finished";
          session.result = session.deliveries >= DELIVERY_GOAL ? "ROUTE COMPLETE!" : session.hearts <= 0 ? "SCOOTER BONKED!" : "TIME'S UP!";
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
      if (recipientIndex >= 0 && session.district === doorOf(recipientIndex).district && recipientSprites.current) {
        const recipient = doorOf(recipientIndex);
        layers.push({ depth: recipient.x + recipient.y, paint: () => drawDeliveryMarker(ctx, recipientSprites.current!, recipientFriendId.current, recipient, now, live.current.reducedMotion, celebrating && !session.carrying) });
      }
      rfCoins.forEach((coin, index) => {
        if (coin.district === session.district && !session.collectedCoins.has(index)) layers.push({ depth: coin.x + coin.y + 6, paint: () => drawRfCoin(ctx, coin, index, now, live.current.reducedMotion) });
      });
      hazards.forEach(hazard => { const at = hazardPosition(hazard, now); layers.push({ depth: at.x + at.y + 12, paint: () => drawHazard(ctx, hazard, at, now, live.current.reducedMotion) }); });
      if (!session.carrying && session.phase !== "finished" && session.district === parcels[session.parcel].district) layers.push({ depth: parcels[session.parcel].x + parcels[session.parcel].y + 10, paint: () => drawParcel(ctx, parcels[session.parcel], now, live.current.reducedMotion) });
      layers.push({ depth: point.x + point.y + 16, paint: () => drawFriendOnScooter(ctx, sprites.current!, point, facing, moving, now, live.current.reducedMotion, session.invulnerable > 0, session.carrying) });
      layers.sort((a, b) => a.depth - b.depth).forEach(layer => layer.paint());
      ctx.restore();
      node.dataset.playerX = point.x.toFixed(2); node.dataset.playerY = point.y.toFixed(2); node.dataset.district = String(session.district);
      node.dataset.receiverId = recipientFriendId.current.toString(); node.dataset.rf = String(session.rf);
      const nextHud = `${Math.ceil(session.time)}|${session.score}|${session.rf}|${session.combo}|${session.hearts}|${session.deliveries}|${session.carrying}|${Math.round(session.boost / 4)}|${session.message}`;
      if (nextHud !== lastHud) { lastHud = nextHud; syncHud(); }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); stopInput(); window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onHidden); };
  }, [status]);

  const setDirection = (key: string, active: boolean) => { if (phase !== "playing" || paused || help) return; active ? keys.current.add(key) : keys.current.delete(key); root.current?.focus(); };
  const handleKey = (event: React.KeyboardEvent<HTMLElement>, active: boolean) => {
    const key = event.key.toLowerCase(); if (!movementKeys.has(key) || phase !== "playing" || help) return;
    event.preventDefault(); active ? keys.current.add(key) : keys.current.delete(key);
  };
  const routeDestinationDistrict = hud.carrying && game.current.target >= 0
    ? doorOf(game.current.target).district
    : parcels[game.current.parcel]?.district ?? district;

  return <main ref={root} className={`parcel-game phase-${phase}`} role="region" aria-label="Sky Parcel Panic game" tabIndex={0}
    onKeyDown={event => handleKey(event, true)} onKeyUp={event => handleKey(event, false)}>
    <img className="postal-plaza" src={districtMaps[district]} alt="" aria-hidden="true" />
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} role="img"
      aria-label="Sky Parcel Panic town. Drive with WASD or arrow keys, collect parcels and deliver them to highlighted houses." />

    <header className="parcel-hud">
      <div className="brand"><small>RARE FRIEND #{friendId.toString()}</small><strong>SKY PARCEL PANIC</strong></div>
      <div className="timer"><small>ROUTE TIME</small><strong>{String(hud.time).padStart(2, "0")}</strong></div>
      <div className="score"><span>◆ {hud.rf.toFixed(2)} RF</span><b>★ {hud.score.toString().padStart(4, "0")} · COMBO x{hud.combo}</b></div>
      <button type="button" onClick={() => setHelp(true)}>How to play</button>
    </header>

    <aside className="route-card" aria-live="polite">
      <span>{phase === "playing" ? `RUNNING · ${districtNames[district]}` : phase === "finished" ? "ROUTE CLOSED" : "READY"}</span>
      <strong>{hud.carrying ? "▣ PARCEL ON BOARD" : "◇ FIND THE PARCEL"}</strong>
      <p>{hud.message}</p>
      <div className="delivery-pips" aria-label={`${hud.deliveries} of ${DELIVERY_GOAL} deliveries`}>
        {Array.from({ length: DELIVERY_GOAL }, (_, index) => <i key={index} className={index < hud.deliveries ? "done" : ""} />)}
      </div>
    </aside>

    <nav className="map-directions" aria-label="Neighboring districts">
      {district > 0 && <div className={`map-sign map-sign-left ${routeDestinationDistrict === district - 1 ? "active" : ""}`}>
        <b aria-hidden="true">←</b><span><small>{routeDestinationDistrict === district - 1 ? "GO HERE" : "NEXT ROUTE"}</small><strong>{districtNames[district - 1]}</strong></span>
      </div>}
      {district < districtNames.length - 1 && <div className={`map-sign map-sign-right ${routeDestinationDistrict === district + 1 ? "active" : ""}`}>
        <span><small>{routeDestinationDistrict === district + 1 ? "GO HERE" : "NEXT ROUTE"}</small><strong>{districtNames[district + 1]}</strong></span><b aria-hidden="true">→</b>
      </div>}
    </nav>

    <div className="hearts" aria-label={`${hud.hearts} hearts`}>{Array.from({ length: 3 }, (_, index) => <span key={index} className={index < hud.hearts ? "full" : ""}>♥</span>)}</div>

    {phase === "playing" && <>
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
    {!status && phase === "ready" && <section className="parcel-overlay intro">
      <div><span className="eyebrow">TODAY'S EXPRESS ROUTE</span><h1>FIVE PARCELS.<br />ONE TINY SCOOTER.</h1><p>Grab the glowing box, follow the highlighted house and dodge the wonderfully unhelpful town traffic.</p><button type="button" disabled={paused} onClick={startRun}>START DELIVERY RUN</button><small>WASD / ARROWS · HOLD SPACE TO BOOST</small></div>
    </section>}
    {phase === "finished" && <section className="parcel-overlay result" aria-live="assertive">
      <div><span className="eyebrow">FINAL DELIVERY REPORT</span><h1>{game.current.result}</h1><p><b>{hud.deliveries}/{DELIVERY_GOAL}</b> parcels · <b>{hud.score}</b> points · <b>{hud.rf.toFixed(2)} RF</b> collected</p><button type="button" disabled={paused} onClick={startRun}>RIDE AGAIN</button></div>
    </section>}
    {help && <section className="help-panel" role="dialog" aria-modal="true" aria-label="How to play">
      <div><span className="eyebrow">COURIER HANDBOOK</span><h2>HOW TO PLAY</h2><ol><li>Drive over the sparkling parcel.</li><li>Find the glowing delivery house.</li><li>Dodge carrots, birds and ponds.</li><li>Deliver quickly to build a ×5 combo.</li></ol><p>Boost is faster but drains its meter. Driving off the road is slower. Each delivery adds three seconds.</p><label><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduce motion</label><button type="button" onClick={() => { setHelp(false); requestAnimationFrame(() => root.current?.focus()); }}>BACK TO ROUTE</button></div>
    </section>}
  </main>;
}
