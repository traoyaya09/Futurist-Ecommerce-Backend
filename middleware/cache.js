const redis = require('redis');
const client = redis.createClient();

async function cache(req, res, next) {
  const key = `__express__${req.originalUrl || req.url}`;
  
  client.get(key, (err, data) => {
    if (err) throw err;
    
    if (data !== null) {
      res.send(JSON.parse(data));
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        client.setex(key, 3600, JSON.stringify(body)); // Cache for 1 hour
        res.sendResponse(body);
      };
      next();
    }
  });
}

module.exports = cache;
