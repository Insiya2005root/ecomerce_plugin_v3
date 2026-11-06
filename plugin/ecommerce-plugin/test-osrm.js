async function test() {
    const lat1 = "21.1702"; // Surat
    const lon1 = "72.8311";
    const lat2 = "19.0760"; // Mumbai
    const lon2 = "72.8777";
    const ratePerKm = 1;

    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));

    const distanceMeters = data.routes[0].distance;
    const distanceKm = distanceMeters / 1000;
    const roundedKm = Math.ceil(distanceKm);
    const calculatedCost = roundedKm * (Number(ratePerKm) || 0);

    console.log({ distanceKm, roundedKm, calculatedCost });
}
test().catch(console.error);
