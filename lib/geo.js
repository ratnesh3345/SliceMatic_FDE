// lib/geo.js
export const OUTLET = { lat: 28.5907, lng: 77.3045 };
export const MAX_KM = 5;
export const SERVED_PINCODES = ["110096","110091","110092","110051","110032","110020","201301","201304"];
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
export function checkDeliverable(geo, pincode) {
  if (geo && geo.lat && geo.lng) {
    const km = haversineKm(parseFloat(geo.lat), parseFloat(geo.lng), OUTLET.lat, OUTLET.lng);
    if (km <= MAX_KM) return { ok: true, km: +km.toFixed(1) };
    return { ok: false, km: +km.toFixed(1), reason: "Your location is " + km.toFixed(1) + " km away - we deliver up to " + MAX_KM + " km from New Ashok Nagar only." };
  }
  const pin = String(pincode ?? "").trim();
  if (SERVED_PINCODES.includes(pin)) return { ok: true };
  return { ok: false, reason: "We don't deliver to pincode " + pin + " yet. We serve New Ashok Nagar and nearby areas within 5 km." };
}
