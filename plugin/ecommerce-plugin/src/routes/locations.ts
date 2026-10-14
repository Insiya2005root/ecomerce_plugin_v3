import Location from '../models/Location';
const http = require('http');
const https = require('https');

async function geocodeAddress(addressStr: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}`;
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/ecommerce-plugin' } }, (resp: any) => {
            let body = '';
            resp.on('data', (chunk: any) => body += chunk);
            resp.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data && data.length > 0) {
                        resolve({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
                    } else {
                        resolve(null);
                    }
                } catch (err) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

export = (app: any) => {
  app.get('/locations', async (req: any, res: any) => {
    try {
      const LocationModel = Location.getModel();
      const locations = await LocationModel.find({ tenantId: 'default_tenant' }).sort({ priority: -1, createdAt: -1 });
      res.json({ success: true, locations });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/locations', async (req: any, res: any) => {
    try {
      const LocationModel = Location.getModel();
      const data = { ...req.body, tenantId: 'default_tenant' };
      
      if (!data.latitude || !data.longitude) {
          const addressStr = `${data.addressLine1} ${data.city} ${data.state} ${data.postalCode} ${data.country}`;
          const coords: any = await geocodeAddress(addressStr);
          if (coords) {
              data.latitude = coords.lat;
              data.longitude = coords.lon;
          }
      }
      
      const loc = await LocationModel.create(data);
      res.json({ success: true, location: loc });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/locations/:id', async (req: any, res: any) => {
    try {
      const LocationModel = Location.getModel();
      const loc = await LocationModel.findById(req.params.id);
      if (!loc) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, location: loc });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.put('/locations/:id', async (req: any, res: any) => {
    try {
      const LocationModel = Location.getModel();
      const loc = await LocationModel.findById(req.params.id);
      if (!loc) return res.status(404).json({ success: false, message: 'Not found' });
      
      const oldAddress = `${loc.addressLine1} ${loc.city} ${loc.state} ${loc.postalCode} ${loc.country}`;
      Object.assign(loc, req.body);
      
      const newAddress = `${loc.addressLine1} ${loc.city} ${loc.state} ${loc.postalCode} ${loc.country}`;
      
      if (oldAddress !== newAddress || (!loc.latitude || !loc.longitude)) {
          const coords: any = await geocodeAddress(newAddress);
          if (coords) {
              loc.latitude = coords.lat;
              loc.longitude = coords.lon;
          }
      }
      
      await loc.save();
      res.json({ success: true, location: loc });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  
  app.delete('/locations/:id', async (req: any, res: any) => {
    try {
      const LocationModel = Location.getModel();
      await LocationModel.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
};
