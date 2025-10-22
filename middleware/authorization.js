const authorize = (roles = []) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!Array.isArray(roles)) {
        roles = [roles];
      }
  
      // Optionally normalize roles to lower case for case-insensitive comparison
      const userRole = req.user.role ? req.user.role.toLowerCase() : "";
      const allowedRoles = roles.map(role => role.toLowerCase());
  
      console.log("User role:", userRole, "Allowed roles:", allowedRoles);
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: `Access denied. Required role(s): ${roles.join(", ")}`,
        });
      }
      next();
    };
  };
  
  // Middleware to allow only Admin users
  const isAdmin = authorize(["Admin"]);
  
  // Middleware to allow only Customer users
  const isCustomer = authorize(["Customer"]);
  
  // Middleware to allow both Admin and Customer users
  const hasAccess = authorize(["Admin", "Customer"]);
  
  module.exports = { authorize, isAdmin, isCustomer, hasAccess };
  