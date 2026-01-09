// backend/middleware/authorize.js

function requireRole(...allowed) {
  return function (req, res, next) {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: "Unauthorized" });
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

function isOrgAdmin(user) {
  return user?.role === "owner" || user?.role === "admin";
}

/**
 * Jobs: allow owners/admins to edit any job.
 * Staff: only allowed if assigned to that job.
 */
function canEditJob(reqUser, job) {
  if (!reqUser || !job) return false;
  if (isOrgAdmin(reqUser)) return true;
  return String(job.assignedTo || "") === String(reqUser.id || "");
}

/**
 * Assignments: restrict who can assign jobs.
 * (You can loosen this later if you want staff assigning to themselves.)
 */
function canAssignJob(reqUser) {
  return isOrgAdmin(reqUser);
}

module.exports = {
  requireRole,
  isOrgAdmin,
  canEditJob,
  canAssignJob,
};