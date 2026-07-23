'use strict';
// Determina en que sector (poligono) cae una ubicacion, usando ray casting.
const sectoresRepo = require('../repositories/sectoresRepo');

// ¿El punto (lat,lng) esta dentro del poligono? poligono = [{lat,lng}, ...]
// Algoritmo ray casting: cuenta cruces de un rayo horizontal con las aristas.
function pointInPolygon(lat, lng, poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].lng, yi = poligono[i].lat;
    const xj = poligono[j].lng, yj = poligono[j].lat;
    const cruza = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// Devuelve el nombre del sector que contiene la ubicacion, o null si ninguno.
async function encontrarSector(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const sectores = await sectoresRepo.listar();
  for (const s of sectores) {
    if (pointInPolygon(lat, lng, s.coordenadas || [])) return s.nombreSector;
  }
  return null;
}

module.exports = { pointInPolygon, encontrarSector };
