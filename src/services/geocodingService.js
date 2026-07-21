'use strict';
// Reverse geocoding con Google Maps: convierte lat/lng en direccion legible.
const axios = require('axios');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function componente(comps, tipo) {
  const c = (comps || []).find((x) => x.types.includes(tipo));
  return c ? c.long_name : null;
}

async function reverseGeocode(lat, lng) {
  const fallback = {
    descripcion: `${lat}, ${lng}`,
    direccionCompleta: `${lat}, ${lng}`,
    lat, lng,
    mapsUrl: mapsUrl(lat, lng),
  };

  if (!API_KEY) return fallback;

  try {
    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { latlng: `${lat},${lng}`, key: API_KEY, language: 'es' },
      timeout: 8000,
    });

    if (data.status !== 'OK' || !data.results || !data.results.length) return fallback;

    const best = data.results[0];
    const comps = best.address_components;
    const calle   = componente(comps, 'route');
    const numero  = componente(comps, 'street_number');
    const sector  = componente(comps, 'sublocality') || componente(comps, 'neighborhood');
    const ciudad  = componente(comps, 'locality') || componente(comps, 'administrative_area_level_2');
    const provincia = componente(comps, 'administrative_area_level_1');

    const partesCorta = [
      [calle, numero].filter(Boolean).join(' '),
      sector,
    ].filter(Boolean);
    const descripcion = partesCorta.length ? partesCorta.join(', ') : best.formatted_address;

    const partesLarga = [
      [calle, numero].filter(Boolean).join(' '),
      sector, ciudad, provincia,
    ].filter(Boolean);
    const direccionCompleta = partesLarga.length ? partesLarga.join(', ') : best.formatted_address;

    return { descripcion, direccionCompleta, lat, lng, mapsUrl: mapsUrl(lat, lng) };
  } catch (err) {
    console.error('[geocoding] error:', err.message);
    return fallback;
  }
}

module.exports = { reverseGeocode, mapsUrl };
