function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'deny');
  // Commenting out the CSP header for development purposes
  // res.setHeader(
  //   'Content-Security-Policy',
  //   "default-src 'self'; connect-src 'self' http://localhost:8080; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  // );
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
}

module.exports = securityHeaders;
